import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Pause, Play, RefreshCw } from 'lucide-react';
import { createPlan, runScheduler, setPlanActive, upcomingOccurrences, useCurrentUser, useDb, userById } from '../lib/store';
import { can } from '../lib/permissions';
import { attempt, Button, Card, cx, Field, Input, Modal, PageHeader, PriorityBadge, Select, StatusBadge, Tabs, toast, Unauthorized } from '../components/ui';
import { addDays, fmtDate, pkDate, weekday, fmtTime, pkAt } from '../lib/time';
import type { Frequency, Priority, WOType } from '../lib/types';

type View = 'calendar' | 'plans';

export default function Schedules() {
  const user = useCurrentUser()!;
  const db = useDb();
  const [view, setView] = useState<View>('calendar');
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);
  if (!can(user, 'plan.manage')) return <Unauthorized />;
  const today = pkDate();

  const run = () => {
    const r = runScheduler(user.id);
    toast(`Scheduler ran: ${r.created} new work order${r.created === 1 ? '' : 's'} generated · ${r.skipped} occurrence${r.skipped === 1 ? '' : 's'} already existed (duplicates prevented)${r.overdueAlerts ? ` · ${r.overdueAlerts} overdue alert(s)` : ''}`, 'info');
  };

  return (
    <div>
      <PageHeader
        title={<>Maintenance <em>calendar</em></>}
        subtitle="Recurring plans automatically generate work orders (Asia/Karachi time). Overdue work never disappears when the next occurrence is generated."
        actions={<><Button onClick={run}><RefreshCw size={16} />Run scheduler now</Button><Button variant="primary" onClick={() => setOpen(true)}><CalendarPlus size={16} />New maintenance plan</Button></>}
      />
      <Tabs<View> value={view} onChange={setView} tabs={[{ value: 'calendar', label: 'Calendar' }, { value: 'plans', label: 'Maintenance plans', count: db.plans.length }]} />
      <div className="mt-5">
        {view === 'calendar' && (
          <>
            <div className="mb-4 flex gap-2">{[7, 14, 30].map((n) => <button key={n} onClick={() => setDays(n)} className={cx('rounded-full px-3 py-1 text-sm ring-1', days === n ? 'bg-forest-800 text-white ring-forest-800' : 'bg-white text-ink-700 ring-ivory-300')}>Next {n} days</button>)}</div>
            <div className="space-y-3">
              {Array.from({ length: days + 2 }, (_, i) => addDays(today, i - 2)).map((d) => {
                const existing = db.workOrders.filter((w) => pkDate(w.scheduledFor) === d && w.status !== 'cancelled');
                const previews = d > today ? db.plans.filter((p) => p.active && upcomingOccurrences(p, d, 1).length && !existing.some((w) => w.planId === p.id)) : [];
                if (!existing.length && !previews.length) return null;
                return (
                  <div key={d} className={cx('rounded-xl border bg-white shadow-card', d === today ? 'border-gold-400' : 'border-ivory-300/80')}>
                    <div className={cx('flex items-center gap-3 border-b px-4 py-2.5', d === today ? 'border-gold-200 bg-gold-50' : 'border-ivory-200 bg-ivory-50')}>
                      <span className="font-serif text-[22px] leading-tight text-forest-900">{weekday(d)} {fmtDate(d)}</span>
                      {d === today && <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold uppercase text-white">Today</span>}
                      {d < today && <span className="text-xs text-ink-500">Past</span>}
                    </div>
                    <ul className="divide-y divide-ivory-200">
                      {existing.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)).map((w) => (
                        <li key={w.id}>
                          <Link to={`/work-orders/${w.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-ivory-50">
                            <span className="w-12 text-sm tabular-nums text-ink-500">{fmtTime(w.scheduledFor)}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{w.title}</span>
                            <span className="text-xs text-ink-500">{userById(db, w.leadTechId)?.name ?? 'Unassigned'}</span>
                            <StatusBadge status={w.status} wo={w} />
                          </Link>
                        </li>
                      ))}
                      {previews.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 opacity-70">
                          <span className="w-12 text-sm tabular-nums text-ink-500">{p.dueTime}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{p.name}</span>
                          <span className="text-xs text-ink-500">{userById(db, p.assigneeId)?.name}</span>
                          <span className="rounded-full border border-dashed border-ink-400 px-2 py-0.5 text-xs text-ink-500">Preview — generated on the day</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {view === 'plans' && (
          <div className="overflow-x-auto rounded-[20px] border border-ivory-200 bg-white shadow-card">
            <table className="tbl">
              <thead><tr><th>Plan</th><th>Asset</th><th>Recurrence</th><th>Assignee</th><th>Priority</th><th>Next</th><th>Generated</th><th /></tr></thead>
              <tbody>
                {db.plans.map((p) => {
                  const a = db.assets.find((x) => x.id === p.assetId);
                  const next = upcomingOccurrences(p, addDays(today, 1), 60)[0];
                  const gen = db.workOrders.filter((w) => w.planId === p.id).length;
                  return (
                    <tr key={p.id} className={p.active ? '' : 'opacity-60'}>
                      <td><div className="font-medium text-ink-900">{p.name}</div><div className="text-xs text-ink-500">{db.templates.find((t) => t.id === p.templateId)?.name}</div></td>
                      <td><Link to={`/assets/${p.assetId}`} className="text-forest-700 hover:underline">{a?.code}</Link></td>
                      <td className="whitespace-nowrap capitalize">{p.frequency === 'every_n_days' ? `Every ${p.interval} days` : p.frequency} · {p.dueTime}</td>
                      <td className="whitespace-nowrap">{userById(db, p.assigneeId)?.name}</td>
                      <td><PriorityBadge p={p.priority} /></td>
                      <td className="whitespace-nowrap">{p.active && next ? fmtDate(next) : '—'}</td>
                      <td className="tabular-nums">{gen}</td>
                      <td>
                        <Button size="sm" variant="ghost" onClick={() => attempt(() => setPlanActive(user, p.id, !p.active), p.active ? 'Plan suspended' : 'Plan resumed')}>{p.active ? <><Pause size={14} />Suspend</> : <><Play size={14} />Resume</>}</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <NewPlan open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewPlan({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser()!;
  const db = useDb();
  const [f, setF] = useState({ name: '', assetId: '', templateId: '', type: 'inspection' as WOType, frequency: 'daily' as Frequency, interval: 7, startDate: pkDate(), dueTime: '09:00', windowHours: 4, assigneeId: '', supervisorId: user.role === 'supervisor' || user.role === 'manager' ? user.id : db.users.find((u) => u.role === 'supervisor' && u.status === 'active')?.id ?? db.users.find((u) => u.role === 'manager')?.id ?? '', priority: 'medium' as Priority, requiresApproval: true });
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const asset = db.assets.find((a) => a.id === f.assetId);
  const tpl = db.templates.find((t) => t.id === f.templateId);
  const preview = f.assetId && f.templateId ? upcomingOccurrences({ ...f, id: 'x', active: true, createdById: '', createdAt: '', propertyId: '' }, f.startDate, 21).slice(0, 6) : [];
  const save = () => {
    let res: { created: number; skipped: number } | undefined;
    const ok = attempt(() => { res = createPlan(user, { ...f, name: f.name || (asset && tpl ? `${asset.code} ${tpl.name}` : '') }); });
    if (ok) {
      toast(res && res.created ? `Plan created — ${res.created} work order generated for today and assigned` : 'Plan created — work orders will be generated on each occurrence');
      onClose();
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="New maintenance plan" wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Create plan</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Asset" required><Select value={f.assetId} onChange={(e) => up('assetId', e.target.value)}><option value="">Select…</option>{db.assets.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</Select></Field>
        <Field label="Checklist template" required><Select value={f.templateId} onChange={(e) => up('templateId', e.target.value)}><option value="">Select…</option>{db.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <Field label="Plan name" hint={asset && tpl ? `Default: ${asset.code} ${tpl.name}` : undefined} className="sm:col-span-2"><Input value={f.name} onChange={(e) => up('name', e.target.value)} placeholder={asset && tpl ? `${asset.code} ${tpl.name}` : 'e.g. GEN-001 Weekly Fluid Check'} /></Field>
        <Field label="Recurrence">
          <Select value={f.frequency} onChange={(e) => up('frequency', e.target.value as Frequency)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="every_n_days">Custom interval (days)</option></Select>
        </Field>
        {f.frequency === 'every_n_days' ? <Field label="Every N days"><Input type="number" min={1} value={f.interval} onChange={(e) => up('interval', Number(e.target.value))} /></Field> : <Field label="Type"><Select value={f.type} onChange={(e) => up('type', e.target.value as WOType)}><option value="inspection">Routine inspection</option><option value="preventive">Preventive maintenance</option></Select></Field>}
        <Field label="Start date"><Input type="date" value={f.startDate} onChange={(e) => up('startDate', e.target.value)} /></Field>
        <Field label="Start time (Asia/Karachi)"><Input type="time" value={f.dueTime} onChange={(e) => up('dueTime', e.target.value)} /></Field>
        <Field label="Completion window" hint="Hours after start time before it is overdue"><Input type="number" min={1} value={f.windowHours} onChange={(e) => up('windowHours', Number(e.target.value))} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={(e) => up('priority', e.target.value as Priority)}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
        <Field label="Assigned technician" required><Select value={f.assigneeId} onChange={(e) => up('assigneeId', e.target.value)}><option value="">Select…</option>{db.users.filter((u) => u.role === 'technician' && u.status === 'active').map((u) => <option key={u.id} value={u.id}>{u.name}{u.skills.length ? ` — ${u.skills.join(', ')}` : ''}</option>)}</Select></Field>
        <Field label="Reviewing supervisor"><Select value={f.supervisorId} onChange={(e) => up('supervisorId', e.target.value)}><option value="">Select…</option>{db.users.filter((u) => u.role === 'supervisor' || u.role === 'manager').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
      </div>
      {preview.length > 0 && (
        <div className="rounded-lg bg-ivory-50 p-3 ring-1 ring-ivory-200">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">Next occurrences</div>
          <div className="flex flex-wrap gap-1.5">{preview.map((d) => <span key={d} className="rounded bg-white px-2 py-0.5 text-xs text-ink-700 ring-1 ring-ivory-300">{weekday(d)} {fmtDate(d)} {f.dueTime}{d === pkDate() && pkAt(d, f.dueTime) ? ' (today)' : ''}</span>)}</div>
        </div>
      )}
    </Modal>
  );
}
