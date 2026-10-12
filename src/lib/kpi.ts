import type { Db } from './types';
import { isOverdue } from './store';
import { addDays, pkDate } from './time';

export const KPI_DEFINITIONS: { name: string; formula: string }[] = [
  { name: 'PM / inspection compliance (30 d)', formula: 'Scheduled work orders due in the last 30 days that were approved on or before their due time ÷ all scheduled work orders due in that window.' },
  { name: 'Overdue work', formula: 'Open work orders (triage, assigned, in progress, on hold, rework) whose due time has passed.' },
  { name: 'Rework rate (30 d)', formula: 'Review decisions returning work (rework or more evidence) ÷ all review decisions in the last 30 days.' },
  { name: 'Mean time to repair', formula: 'Average of (approval time − fault report time) for fault work orders approved in the last 90 days.' },
  { name: 'Equipment downtime (30 d)', formula: 'Sum of (return-to-service − fault report time) for faults that took equipment out of service; open faults count until now.' },
];

export function computeKpis(db: Db) {
  const now = Date.now();
  const since30 = now - 30 * 86400_000;
  const since90 = now - 90 * 86400_000;

  const scheduledDue = db.workOrders.filter((w) => w.source === 'schedule' && new Date(w.dueAt).getTime() >= since30 && new Date(w.dueAt).getTime() <= now);
  const onTime = scheduledDue.filter((w) => (w.status === 'closed' || w.status === 'completed') && w.submittedAt && new Date(w.submittedAt).getTime() <= new Date(w.dueAt).getTime());
  const compliance = scheduledDue.length ? Math.round((onTime.length / scheduledDue.length) * 100) : 100;

  const reviews30 = db.reviews.filter((r) => new Date(r.at).getTime() >= since30);
  const returned = reviews30.filter((r) => r.decision !== 'approved').length;
  const reworkRate = reviews30.length ? Math.round((returned / reviews30.length) * 1000) / 10 : 0;

  const repaired = db.workOrders.filter((w) => w.source === 'fault' && w.completedAt && new Date(w.completedAt).getTime() >= since90);
  const mttrH = repaired.length ? repaired.reduce((s, w) => s + (new Date(w.completedAt!).getTime() - new Date(w.createdAt).getTime()), 0) / repaired.length / 3600_000 : 0;

  const downFaults = db.workOrders.filter((w) => w.source === 'fault' && w.fault && !w.fault.equipmentOperational && w.status !== 'cancelled');
  const downtimeH = downFaults.reduce((s, w) => {
    const start = Math.max(new Date(w.createdAt).getTime(), since30);
    const end = w.returnedToServiceAt ? new Date(w.returnedToServiceAt).getTime() : now;
    return s + Math.max(0, end - start) / 3600_000;
  }, 0);

  const open = db.workOrders.filter((w) => ['triage', 'assigned', 'in_progress', 'on_hold', 'submitted', 'rework'].includes(w.status));
  return {
    totalAssets: db.assets.filter((a) => a.condition !== 'decommissioned').length,
    operational: db.assets.filter((a) => a.condition === 'operational').length,
    outOfService: db.assets.filter((a) => a.condition === 'out_of_service' || a.condition === 'faulty').length,
    degraded: db.assets.filter((a) => a.condition === 'degraded').length,
    compliance,
    complianceN: `${onTime.length}/${scheduledDue.length}`,
    overdue: db.workOrders.filter((w) => isOverdue(w)).length,
    openEmergencies: open.filter((w) => w.type === 'emergency').length,
    awaitingApproval: open.filter((w) => w.status === 'submitted').length,
    awaitingParts: open.filter((w) => w.status === 'on_hold' && w.holdReason?.startsWith('Awaiting parts')).length,
    reworkRate,
    mttrH,
    downtimeH,
    open: open.length,
  };
}

export function activitySeries(db: Db, days = 14) {
  const today = pkDate();
  const out: { day: string; Inspection: number; Preventive: number; Corrective: number; Emergency: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const row = { day: d.slice(5).split('-').reverse().join('/'), Inspection: 0, Preventive: 0, Corrective: 0, Emergency: 0 };
    db.workOrders.forEach((w) => {
      if (!w.completedAt || pkDate(w.completedAt) !== d) return;
      const k = { inspection: 'Inspection', preventive: 'Preventive', corrective: 'Corrective', emergency: 'Emergency' }[w.type] as keyof typeof row;
      (row[k] as number) += 1;
    });
    out.push(row);
  }
  return out;
}

KPI_DEFINITIONS.unshift({ name: 'Facility health index', formula: '0.4 × PM compliance + 0.6 × availability score. Availability starts at 100 and loses 15 / 10 / 5 points per critical / high / other asset that is faulty or out of service, 3 per degraded asset, 4 per overdue job on critical equipment and 2 per other overdue job.' });

const endOf = (d: string) => new Date(`${d}T23:59:59+05:00`).getTime();

export function healthIndex(db: Db) {
  const k = computeKpis(db);
  let avail = 100;
  for (const a of db.assets) {
    if (a.condition === 'out_of_service' || a.condition === 'faulty') avail -= a.criticality === 'critical' ? 15 : a.criticality === 'high' ? 10 : 5;
    else if (a.condition === 'degraded') avail -= 3;
  }
  for (const w of db.workOrders) {
    if (!isOverdue(w)) continue;
    const crit = w.priority === 'critical' || db.assets.find((a) => a.id === w.assetId)?.criticality === 'critical';
    avail -= crit ? 4 : 2;
  }
  avail = Math.max(0, Math.min(100, avail));
  return Math.round(0.4 * k.compliance + 0.6 * avail);
}

/** Daily trend series (oldest → today) reconstructed from record timestamps. */
export function trendSeries(db: Db, days = 14) {
  const today = pkDate();
  const out = { overdue: [] as number[], review: [] as number[], compliance: [] as number[], completed: [] as number[] };
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const end = Math.min(endOf(d), Date.now());
    out.overdue.push(db.workOrders.filter((w) => {
      if (w.status === 'cancelled' || new Date(w.createdAt).getTime() > end) return false;
      const due = new Date(w.dueAt).getTime();
      const done = w.submittedAt ? new Date(w.submittedAt).getTime() : Infinity;
      return due < end && done > end;
    }).length);
    out.review.push(db.submissions.filter((s) => {
      const t = new Date(s.submittedAt).getTime();
      if (t > end) return false;
      const r = db.reviews.find((x) => x.submissionId === s.id);
      return !r || new Date(r.at).getTime() > end;
    }).length);
    const winStart = end - 7 * 86400_000;
    const due = db.workOrders.filter((w) => w.source === 'schedule' && new Date(w.dueAt).getTime() <= end && new Date(w.dueAt).getTime() > winStart);
    const ok = due.filter((w) => w.submittedAt && w.submittedAt <= w.dueAt && new Date(w.submittedAt).getTime() <= end);
    out.compliance.push(due.length ? Math.round((ok.length / due.length) * 100) : 100);
    out.completed.push(db.workOrders.filter((w) => w.completedAt && pkDate(w.completedAt) === d).length);
  }
  return out;
}
