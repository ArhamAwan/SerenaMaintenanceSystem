import { Link } from 'react-router-dom';
import { Siren, ChevronRight } from 'lucide-react';
import { assetById, locationPath, useCurrentUser, useDb, userById } from '../lib/store';
import { cx, EmptyState, LinkButton, PageHeader, PriorityBadge } from '../components/ui';
import { fmtDateTime, relative } from '../lib/time';
import type { WorkOrder } from '../lib/types';

const STEPS = ['Reported', 'Assigned', 'In repair', 'Repaired', 'Confirmed'];
function stepOf(w: WorkOrder) {
  if (w.status === 'closed') return 4;
  if (w.status === 'completed') return 3;
  if (['in_progress', 'submitted', 'rework', 'on_hold'].includes(w.status)) return 2;
  if (w.status === 'assigned') return 1;
  return 0;
}

export default function MyRequests({ home }: { home?: boolean }) {
  const user = useCurrentUser()!;
  const db = useDb();
  const mine = db.workOrders.filter((w) => w.requestedById === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const awaiting = mine.filter((w) => w.status === 'completed');
  const open = mine.filter((w) => !['closed', 'cancelled', 'completed'].includes(w.status));
  const done = mine.filter((w) => ['closed', 'cancelled'].includes(w.status));

  const Row = ({ w }: { w: WorkOrder }) => {
    const s = stepOf(w);
    const a = assetById(db, w.assetId);
    return (
      <Link to={`/work-orders/${w.id}`} className={cx('block rounded-xl border bg-white p-4 shadow-card transition hover:border-gold-300', w.status === 'completed' ? 'border-forest-300 ring-2 ring-forest-100' : 'border-ivory-300/80')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><PriorityBadge p={w.priority} /><span className="text-xs text-ink-500">{w.number} · {relative(w.createdAt)}</span></div>
            <div className="mt-1 font-medium text-ink-900">{w.title}</div>
            <div className="text-sm text-ink-500">{a ? `${a.code} · ` : ''}{locationPath(db, w.locationId)}</div>
          </div>
          <ChevronRight size={18} className="mt-1 text-ink-400" />
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1">
          {STEPS.map((st, i) => (
            <div key={st}>
              <div className={cx('h-1.5 rounded-full', i <= s ? (w.status === 'rework' && i === 2 ? 'bg-orange-500' : 'bg-forest-600') : 'bg-ivory-200')} />
              <div className={cx('mt-1 text-[10px] sm:text-[11px]', i === s ? 'font-semibold text-forest-800' : 'text-ink-400')}>{st}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-ink-500">
          {w.status === 'completed' ? <span className="font-semibold text-forest-700">Repaired — please confirm the issue is resolved</span> : w.leadTechId ? `Technician: ${userById(db, w.leadTechId)?.name}` : 'Waiting for engineering to assign'}
          {w.closedAt && ` · closed ${fmtDateTime(w.closedAt)}`}
        </div>
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={home ? `Welcome, ${user.name.split(' ')[0]}` : undefined} title={home ? db.departments.find((d) => d.id === user.departmentId)?.name ?? 'My requests' : 'My requests'} subtitle="Maintenance requests you've raised with Engineering." actions={<LinkButton to="/report-fault" variant="primary" size="lg"><Siren size={18} />Report a fault</LinkButton>} />
      {awaiting.length > 0 && <section className="mb-6"><h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-forest-700">Needs your confirmation</h2><div className="space-y-2.5">{awaiting.map((w) => <Row key={w.id} w={w} />)}</div></section>}
      <section className="mb-6"><h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">In progress</h2>{open.length ? <div className="space-y-2.5">{open.map((w) => <Row key={w.id} w={w} />)}</div> : <EmptyState title="No open requests" body="Report a fault and you can follow it here." />}</section>
      {done.length > 0 && <section><h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Resolved</h2><div className="space-y-2.5">{done.map((w) => <Row key={w.id} w={w} />)}</div></section>}
    </div>
  );
}
