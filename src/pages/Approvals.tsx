import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Camera, ClipboardCheck, RotateCcw } from 'lucide-react';
import { assetById, submissionsFor, useCurrentUser, useDb, userById } from '../lib/store';
import { can } from '../lib/permissions';
import { Avatar, EmptyState, PageHeader, PriorityBadge, Tabs, Unauthorized, cx } from '../components/ui';
import { fmtDateTime, relative } from '../lib/time';

type F = 'all' | 'flagged' | 'resubmitted' | 'critical' | 'late';

export default function Approvals() {
  const user = useCurrentUser()!;
  const db = useDb();
  const [f, setF] = useState<F>('all');
  const [scope, setScope] = useState<'mine' | 'all'>(user.role === 'manager' ? 'all' : 'mine');
  if (!can(user, 'wo.review')) return <Unauthorized />;

  const base = db.workOrders
    .filter((w) => w.status === 'submitted' && (scope === 'all' || w.supervisorId === user.id))
    .map((w) => ({ w, s: submissionsFor(db, w.id).slice(-1)[0], a: assetById(db, w.assetId) }))
    .sort((x, y) => (x.s?.submittedAt ?? '').localeCompare(y.s?.submittedAt ?? ''));
  const pred: Record<F, (r: (typeof base)[number]) => boolean> = {
    all: () => true,
    flagged: (r) => !!r.s?.flags.length,
    resubmitted: (r) => (r.s?.version ?? 1) > 1,
    critical: (r) => r.a?.criticality === 'critical' || r.w.priority === 'critical',
    late: (r) => !!r.s && Date.now() - new Date(r.s.submittedAt).getTime() > 4 * 3600_000,
  };
  const rows = base.filter(pred[f]);

  return (
    <div>
      <PageHeader
        title={<>Pending <em>review</em></>}
        subtitle="Submitted inspections and repairs waiting for approval. Oldest first."
        actions={
          <div className="inline-flex rounded-lg bg-white p-1 ring-1 ring-ivory-300">
            {(['mine', 'all'] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)} className={cx('rounded-md px-3 py-1.5 text-sm', scope === s ? 'bg-forest-800 text-white' : 'text-ink-600')}>{s === 'mine' ? 'Assigned to me' : 'All supervisors'}</button>
            ))}
          </div>
        }
      />
      <Tabs<F>
        value={f}
        onChange={setF}
        tabs={[
          { value: 'all', label: 'All pending', count: base.length },
          { value: 'flagged', label: 'Abnormal readings', count: base.filter(pred.flagged).length },
          { value: 'resubmitted', label: 'Rework resubmitted', count: base.filter(pred.resubmitted).length },
          { value: 'critical', label: 'Critical equipment', count: base.filter(pred.critical).length },
          { value: 'late', label: 'Waiting > 4 h', count: base.filter(pred.late).length },
        ]}
      />
      <div className="mt-4 space-y-2.5">
        {rows.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={30} />} title="Nothing waiting for review" body="When technicians submit work, it will appear here and you'll get a notification." />
        ) : (
          rows.map(({ w, s, a }) => (
            <Link key={w.id} to={`/work-orders/${w.id}/review`} className="flex flex-col gap-3 rounded-xl border border-ivory-300/80 bg-white p-4 shadow-card transition hover:border-gold-300 sm:flex-row sm:items-center">
              <Avatar name={userById(db, s?.submittedById)?.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge p={w.priority} />
                  <span className="text-xs text-ink-500">{w.number}</span>
                  {s && s.version > 1 && <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800"><RotateCcw size={11} />v{s.version}</span>}
                  {s && s.flags.length > 0 && <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200"><AlertTriangle size={11} />{s.flags.map((x) => `${x.label} ${x.value}`).join('; ')}</span>}
                </div>
                <div className="mt-1 font-medium text-ink-900">{w.title}</div>
                <div className="text-sm text-ink-500">{a ? `${a.code} · ` : ''}{userById(db, s?.submittedById)?.name} · submitted {relative(s?.submittedAt)} ({fmtDateTime(s?.submittedAt)})</div>
              </div>
              <div className="flex items-center gap-4 text-sm text-ink-500">
                <span className="flex items-center gap-1"><Camera size={14} />{s?.photos.length ?? 0}</span>
                <span className="inline-flex items-center gap-1 font-medium text-forest-700">Review <ArrowRight size={15} /></span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
