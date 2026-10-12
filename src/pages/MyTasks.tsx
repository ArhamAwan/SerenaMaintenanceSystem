import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, QrCode, Siren } from 'lucide-react';
import { isOverdue, useCurrentUser, useDb } from '../lib/store';
import { pkDate } from '../lib/time';
import { TaskCard } from '../components/wo';
import { EmptyState, PageHeader, Tabs, Unauthorized } from '../components/ui';
import { can } from '../lib/permissions';
import type { WorkOrder } from '../lib/types';

type Filter = 'open' | 'rework' | 'overdue' | 'today' | 'upcoming' | 'review' | 'done';

/** My Tasks — the technician's full work queue (the dashboard is the "My day" overview). */
export default function MyTasks() {
  const user = useCurrentUser()!;
  const db = useDb();
  const [f, setF] = useState<Filter>('open');
  if (!can(user, 'wo.execute')) return <Unauthorized message="My Tasks is for technicians. Use Work Orders instead." />;
  const today = pkDate();
  const mine = db.workOrders.filter((w) => w.leadTechId === user.id || w.helperIds.includes(user.id));
  const active = mine.filter((w) => ['assigned', 'in_progress', 'rework', 'on_hold'].includes(w.status)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const rework = active.filter((w) => w.status === 'rework');
  const overdue = active.filter((w) => w.status !== 'rework' && isOverdue(w));
  const todays = active.filter((w) => w.status !== 'rework' && !isOverdue(w) && pkDate(w.scheduledFor) <= today);
  const upcoming = active.filter((w) => w.status !== 'rework' && !isOverdue(w) && pkDate(w.scheduledFor) > today);
  const inReview = mine.filter((w) => w.status === 'submitted');
  const done = mine.filter((w) => w.status === 'closed' || w.status === 'completed').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 20);

  const Section = ({ title, items, tone }: { title: string; items: WorkOrder[]; tone?: string }) =>
    items.length ? (
      <section className="mt-6 first:mt-0">
        <h2 className={`mb-3 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] ${tone ?? 'text-ink-500'}`}>{title}<span className="rounded-full bg-ivory-200 px-1.5 text-ink-600">{items.length}</span></h2>
        <div className="grid gap-2.5 md:grid-cols-2">{items.map((w) => <TaskCard key={w.id} db={db} w={w} />)}</div>
      </section>
    ) : null;

  const lists: Record<Filter, WorkOrder[]> = { open: active, rework, overdue, today: todays, upcoming, review: inReview, done };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={<>My <em>tasks</em></>}
        subtitle={`${active.length} open · ${rework.length} rework · ${overdue.length} overdue · ${inReview.length} awaiting review`}
        actions={<>
          <Link to="/scan" className="inline-flex h-10 items-center gap-2 rounded-full bg-gold-400 px-4 text-sm font-semibold text-forest-950 transition active:scale-[0.98]"><QrCode size={16} />Scan</Link>
          <Link to="/report-fault" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-ink-900 ring-1 ring-inset ring-ivory-300 transition hover:ring-gold-300"><Siren size={16} />Report fault</Link>
        </>}
      />
      <Tabs<Filter>
        value={f}
        onChange={setF}
        tabs={[
          { value: 'open', label: 'All open', count: active.length },
          { value: 'rework', label: 'Rework', count: rework.length },
          { value: 'overdue', label: 'Overdue', count: overdue.length },
          { value: 'today', label: 'Today', count: todays.length },
          { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { value: 'review', label: 'In review', count: inReview.length },
          { value: 'done', label: 'Completed', count: done.length },
        ]}
      />
      <div className="mt-5">
        {f === 'open' ? (
          active.length ? (
            <>
              <Section title="Rework required" items={rework} tone="text-gold-800" />
              <Section title="Overdue" items={overdue} tone="text-rose-700" />
              <Section title="Today" items={todays} />
              <Section title="Upcoming" items={upcoming} />
            </>
          ) : <EmptyState icon={<CheckCircle2 size={22} />} title="You're all caught up" body="New assignments will appear here and you'll be notified." />
        ) : lists[f].length ? (
          <div className="grid gap-2.5 md:grid-cols-2">{lists[f].map((w) => <TaskCard key={w.id} db={db} w={w} />)}</div>
        ) : (
          <EmptyState title="Nothing here" body="No tasks in this view right now." />
        )}
      </div>
    </div>
  );
}
