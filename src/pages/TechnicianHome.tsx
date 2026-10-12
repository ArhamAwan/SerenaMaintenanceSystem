import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Play, QrCode, RotateCcw, ShieldAlert, Siren } from 'lucide-react';
import { assetById, isOverdue, startWork, useCurrentUser, useDb, userById } from '../lib/store';
import { addDays, durationMin, fmtDateShort, fmtDuration, fmtTime, pkDate, relative } from '../lib/time';
import { attempt, Button, ConditionBadge, CountUp, cx, Eyebrow, PriorityBadge, Stat, StatusBadge } from '../components/ui';
import type { WorkOrder } from '../lib/types';

/** Technician "My day": a personal overview — what's next, how my shift looks, how I'm doing, what my supervisor said.
 *  The full actionable queue lives on My Tasks. */
export default function TechnicianHome() {
  const user = useCurrentUser()!;
  const db = useDb();
  const nav = useNavigate();
  const today = pkDate();

  const mine = useMemo(() => db.workOrders.filter((w) => w.leadTechId === user.id || w.helperIds.includes(user.id)), [db, user.id]);
  const active = mine.filter((w) => ['assigned', 'in_progress', 'rework', 'on_hold'].includes(w.status));

  // what to do next: rework > in progress > overdue/critical > earliest due
  const rank = (w: WorkOrder) => (w.status === 'rework' ? 0 : w.status === 'in_progress' ? 1 : w.priority === 'critical' ? 2 : isOverdue(w) ? 3 : 4);
  const next = [...active].filter((w) => w.status !== 'on_hold').sort((a, b) => rank(a) - rank(b) || a.dueAt.localeCompare(b.dueAt))[0];

  // today's shift timeline
  const timeline = mine
    .filter((w) => w.status !== 'cancelled' && (pkDate(w.scheduledFor) === today || (w.completedAt && pkDate(w.completedAt) === today) || (active.includes(w) && isOverdue(w))))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

  // personal performance (last 30 days)
  const since = Date.now() - 30 * 86400_000;
  const done30 = mine.filter((w) => w.completedAt && new Date(w.completedAt).getTime() >= since);
  const subs30 = db.submissions.filter((s) => s.submittedById === user.id && new Date(s.submittedAt).getTime() >= since);
  const firstSubs = done30.map((w) => db.submissions.filter((s) => s.woId === w.id).sort((a, b) => a.version - b.version)[0]).filter(Boolean);
  const onTime = done30.length ? Math.round((firstSubs.filter((s, i) => s!.submittedAt <= done30[i].dueAt).length / done30.length) * 100) : 100;
  const firstTime = done30.length ? Math.round((done30.filter((w) => w.reworkCount === 0).length / done30.length) * 100) : 100;
  const avgMin = subs30.length ? Math.round(subs30.reduce((s, x) => s + (durationMin(x.startedAt, x.submittedAt) ?? 0), 0) / subs30.length) : 0;
  const weekDone = mine.filter((w) => w.completedAt && new Date(w.completedAt).getTime() >= Date.now() - 7 * 86400_000).length;
  const perDay = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => mine.filter((w) => w.completedAt && pkDate(w.completedAt) === d).length);

  // supervisor feedback on my work
  const feedback = db.reviews
    .filter((r) => mine.some((w) => w.id === r.woId) && (r.comment || r.decision !== 'approved'))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);

  // equipment I look after
  const assetIds = Array.from(new Set([...mine].sort((a, b) => (b.completedAt ?? b.scheduledFor).localeCompare(a.completedAt ?? a.scheduledFor)).map((w) => w.assetId).filter(Boolean))) as string[];
  const myAssets = assetIds.slice(0, 5).map((id) => assetById(db, id)!).filter(Boolean);

  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false }).format(new Date()));
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const begin = (w: WorkOrder) => {
    if (w.status === 'assigned' || w.status === 'rework') {
      if (attempt(() => startWork(user, w.id))) nav(`/work-orders/${w.id}/execute`);
    } else nav(`/work-orders/${w.id}/execute`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 pt-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Eyebrow className="mb-2 text-gold-700">{greet} · {user.shift} shift · {user.designation}</Eyebrow>
          <h1 className="font-serif text-[2.8rem] leading-[0.95] text-forest-900 sm:text-[3.8rem]">My <em>day</em>, {user.name.split(' ')[0]}</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link to="/scan" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gold-400 px-5 font-semibold text-forest-950 shadow-[0_8px_18px_-10px_rgba(166,130,63,.8)] transition active:scale-[0.98]"><QrCode size={18} />Scan asset</Link>
          <Link to="/report-fault" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 font-semibold text-ink-900 ring-1 ring-inset ring-ivory-300 transition hover:ring-gold-300 active:scale-[0.98]"><Siren size={18} />Report fault</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Next up */}
        <section className="grain relative overflow-hidden rounded-[26px] p-6 text-ivory-50 shadow-lift lg:col-span-7" style={{ backgroundColor: '#133426', backgroundImage: 'radial-gradient(100% 90% at 100% 0%, rgba(201,164,100,.30) 0%, rgba(201,164,100,0) 55%), radial-gradient(80% 80% at 0% 100%, #1F4D38 0%, rgba(19,52,38,0) 70%), var(--grain)' }}>
          <Eyebrow className="text-gold-300">Next up</Eyebrow>
          {next ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PriorityBadge p={next.priority} />
                <span className="font-mono text-[11px] text-ivory-200/60">{next.number}</span>
                {next.status === 'rework' && <span className="flex items-center gap-1 rounded-full bg-gold-300/20 px-2 py-0.5 text-[11px] text-gold-200"><RotateCcw size={11} />Rework requested</span>}
                {isOverdue(next) && <span className="rounded-full bg-rose-400/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-100">Overdue</span>}
              </div>
              <Link to={`/work-orders/${next.id}`} className="mt-2 block font-serif text-[2.1rem] leading-[1.05] text-ivory-50 hover:text-gold-200 sm:text-[2.5rem]">{next.title}</Link>
              <div className="mt-1.5 text-sm text-ivory-200/75">
                {assetById(db, next.assetId) && <><span className="font-mono text-ivory-100">{assetById(db, next.assetId)!.code}</span> · {assetById(db, next.assetId)!.name} · </>}
                due {pkDate(next.dueAt) === today ? fmtTime(next.dueAt) : `${fmtDateShort(next.dueAt)} ${fmtTime(next.dueAt)}`} ({relative(next.dueAt)})
              </div>
              {next.status === 'rework' && (() => {
                const r = db.reviews.filter((x) => x.woId === next.id).sort((a, b) => b.at.localeCompare(a.at))[0];
                return r ? <p className="mt-3 rounded-2xl bg-white/[0.07] p-3 text-[13.5px] leading-relaxed text-ivory-100 ring-1 ring-inset ring-white/10">“{r.comment}” <span className="text-ivory-200/60">— {userById(db, r.reviewerId)?.name}</span></p> : null;
              })()}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="gold" size="lg" onClick={() => begin(next)}><Play size={17} />{next.status === 'in_progress' ? 'Continue report' : next.status === 'rework' ? 'Start rework' : 'Start now'}</Button>
                <Link to={`/work-orders/${next.id}`} className="inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-[15px] font-medium text-ivory-100 ring-1 ring-inset ring-white/15 transition hover:bg-white/[0.06]">Details <ArrowRight size={15} /></Link>
              </div>
            </>
          ) : (
            <div className="mt-3">
              <div className="font-serif text-[2.2rem] leading-tight text-ivory-50">All clear <em className="!text-gold-300">for now.</em></div>
              <p className="mt-1 text-sm text-ivory-200/70">New assignments appear here and you’ll be notified.</p>
            </div>
          )}
        </section>

        {/* Shift timeline */}
        <section className="rounded-[22px] border border-ivory-200 bg-white p-5 shadow-card lg:col-span-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-[26px] text-forest-900">Today’s <em>shift</em></h2>
            <Link to="/tasks" className="inline-flex items-center gap-1 text-[13px] font-medium text-forest-700 hover:text-forest-900">All my tasks <ArrowRight size={14} /></Link>
          </div>
          {timeline.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">Nothing scheduled for today.</p>
          ) : (
            <ol className="relative mt-4 space-y-3.5 border-l border-ivory-300 pl-5">
              {timeline.map((w) => {
                const done = ['closed', 'completed', 'submitted'].includes(w.status);
                const late = isOverdue(w);
                return (
                  <li key={w.id} className="relative">
                    <span className={cx('absolute -left-[27px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white', done ? 'bg-forest-600' : late ? 'bg-rose-600' : w.status === 'in_progress' ? 'bg-gold-500' : 'bg-ivory-300')} />
                    <Link to={`/work-orders/${w.id}`} className="group block">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-ink-500"><Clock size={11} />{fmtTime(w.scheduledFor)}{pkDate(w.scheduledFor) !== today && ` · ${fmtDateShort(w.scheduledFor)}`}</div>
                      <div className={cx('text-[14px] font-medium group-hover:text-forest-700', done ? 'text-ink-500 line-through decoration-ink-300' : 'text-ink-900')}>{w.title}</div>
                      <div className="mt-1"><StatusBadge status={w.status} wo={w} /></div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* My performance */}
      <div>
        <h2 className="mb-3 font-serif text-[26px] text-forest-900">My <em>performance</em> <span className="font-sans text-sm text-ink-500">· last 30 days</span></h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Completed · 7 days" value={<CountUp value={weekDone} />} hint={`${done30.length} in the last 30 days`} spark={perDay} />
          <Stat label="On time" value={<CountUp value={onTime} suffix="%" />} hint="First report before the deadline" tone={onTime >= 90 ? 'good' : 'warn'} />
          <Stat label="Approved first time" value={<CountUp value={firstTime} suffix="%" />} hint="No rework requested" tone={firstTime >= 90 ? 'good' : 'warn'} />
          <Stat label="Avg time on task" value={avgMin ? fmtDuration(avgMin) : '—'} hint={`${subs30.length} reports submitted`} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Feedback */}
        <section className="rounded-[22px] border border-ivory-200 bg-white p-5 shadow-card lg:col-span-7">
          <h2 className="font-serif text-[26px] text-forest-900">Supervisor <em>feedback</em></h2>
          {feedback.length === 0 ? <p className="mt-3 text-sm text-ink-500">No comments yet.</p> : (
            <ul className="mt-3 space-y-2.5">
              {feedback.map((r) => {
                const w = db.workOrders.find((x) => x.id === r.woId)!;
                const ok = r.decision === 'approved';
                return (
                  <li key={r.id}>
                    <Link to={`/work-orders/${w.id}`} className={cx('block rounded-2xl border p-3.5 transition hover:shadow-card', ok ? 'border-forest-100 bg-forest-50/50' : 'border-gold-200 bg-gold-50')}>
                      <div className="flex items-center gap-2 text-xs">
                        {ok ? <CheckCircle2 size={14} className="text-forest-600" /> : <RotateCcw size={14} className="text-gold-700" />}
                        <span className={cx('font-semibold', ok ? 'text-forest-800' : 'text-gold-800')}>{ok ? 'Approved' : r.decision === 'evidence' ? 'More evidence requested' : 'Rework requested'}</span>
                        <span className="text-ink-500">· {w.title} · {relative(r.at)}</span>
                      </div>
                      {r.comment && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-800">“{r.comment}” <span className="text-ink-500">— {userById(db, r.reviewerId)?.name}</span></p>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Equipment */}
        <section className="rounded-[22px] border border-ivory-200 bg-white p-5 shadow-card lg:col-span-5">
          <h2 className="font-serif text-[26px] text-forest-900">Equipment <em>I look after</em></h2>
          <ul className="mt-3 divide-y divide-ivory-200/70">
            {myAssets.map((a) => {
              const last = mine.filter((w) => w.assetId === a.id && w.completedAt).sort((x, y) => y.completedAt!.localeCompare(x.completedAt!))[0];
              return (
                <li key={a.id}>
                  <Link to={`/assets/${a.id}`} className="flex items-center justify-between gap-3 py-2.5 transition hover:text-forest-700">
                    <span className="min-w-0">
                      <span className="block font-mono text-[13px] text-ink-900">{a.code}</span>
                      <span className="block truncate text-xs text-ink-500">{a.name}{last ? ` · last serviced ${relative(last.completedAt)}` : ''}</span>
                    </span>
                    <ConditionBadge c={a.condition} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-gold-200 bg-gold-50 p-3.5 text-[13.5px] text-gold-900">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-gold-700" />
        <span><b className="font-semibold">Safety:</b> hearing protection in the generator hall and plant rooms. Lockout/tagout before opening any panel.</span>
      </div>
    </div>
  );
}
