import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, ArrowUpRight, ClipboardCheck, Info, Siren, Timer, Wrench, Users, ListChecks, Building2, CalendarClock } from 'lucide-react';
import { assetById, isOverdue, useCurrentUser, useDb, userById } from '../lib/store';
import { activitySeries, computeKpis, healthIndex, KPI_DEFINITIONS, trendSeries } from '../lib/kpi';
import { Avatar, Card, ConditionBadge, CountUp, cx, EmptyState, Eyebrow, LinkButton, PriorityBadge, Ring, Stat, StatusBadge } from '../components/ui';
import { WOTable } from '../components/wo';
import { fmtDuration, relative } from '../lib/time';
import TechnicianHome from './TechnicianHome';
import MyRequests from './MyRequests';
import { GettingStarted } from '../components/GettingStarted';
import type { Db, User, WorkOrder } from '../lib/types';

export default function Dashboard() {
  const user = useCurrentUser()!;
  if (user.role === 'technician') return <TechnicianHome />;
  if (user.role === 'requester') return <MyRequests home />;
  if (user.role === 'supervisor') return <SupervisorDashboard user={user} />;
  return <EngineeringDashboard user={user} />;
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Hero({ eyebrow, title, sub, actions }: { eyebrow: string; title: React.ReactNode; sub: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-5 pt-3 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <Eyebrow className="mb-3 text-gold-700">{eyebrow}</Eyebrow>
        <h1 className="font-serif text-[2.9rem] leading-[0.95] text-forest-900 sm:text-[4rem]">{title}</h1>
        <p className="mt-3 max-w-2xl text-[14.5px] text-ink-600">{sub}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function slaOf(w: WorkOrder) {
  const start = new Date(w.createdAt).getTime();
  const due = new Date(w.dueAt).getTime();
  const now = Date.now();
  const pct = Math.max(4, Math.min(100, ((now - start) / Math.max(1, due - start)) * 100));
  const left = Math.round((due - now) / 60000);
  const label = left < 0 ? `Overdue ${fmtDuration(-left)}` : `${fmtDuration(left)} left`;
  const color = left < 0 ? '#B4432E' : pct > 70 ? '#C9A464' : '#2A6247';
  return { pct, label, color, late: left < 0 };
}

function SlaBar({ w }: { w: WorkOrder }) {
  const s = slaOf(w);
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-ink-500">
        <span>SLA</span>
        <span className={s.late ? 'text-rose-700' : 'text-ink-700'}>{s.label}</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-ivory-200">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${s.pct}%`, background: s.color }} />
      </div>
    </div>
  );
}

function AttentionList({ db, rows }: { db: Db; rows: WorkOrder[] }) {
  if (!rows.length) return <div className="px-5 pb-5 text-sm text-ink-500">Nothing critical right now. Calm waters.</div>;
  return (
    <ul>
      {rows.map((w) => (
        <li key={w.id} className="border-t border-ivory-200/70 first:border-t-0">
          <Link to={`/work-orders/${w.id}`} className="grid grid-cols-[minmax(0,1fr)] items-center gap-3 px-5 py-3.5 transition hover:bg-gold-50/50 sm:grid-cols-[84px_minmax(0,1fr)_170px] sm:gap-4">
            <div className="hidden sm:block"><PriorityBadge p={w.priority} /></div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-ink-900">{w.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                <span className="font-mono text-ink-800">{assetById(db, w.assetId)?.code ?? w.number}</span>·<span>{userById(db, w.leadTechId)?.name ?? 'Unassigned'}</span>·<StatusBadge status={w.status} />
                {w.escalated && <span className="font-mono text-[10px] uppercase tracking-wider text-rose-700">escalated</span>}
              </div>
            </div>
            <SlaBar w={w} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Workload({ db, techs }: { db: Db; techs: User[] }) {
  const rows = techs.map((t) => {
    const open = db.workOrders.filter((w) => (w.leadTechId === t.id || w.helperIds.includes(t.id)) && ['assigned', 'in_progress', 'rework', 'on_hold'].includes(w.status));
    return { t, n: open.length, overdue: open.filter((w) => isOverdue(w)).length };
  });
  const max = Math.max(4, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="text-sm text-ink-500">No technicians yet. <Link to="/team" className="font-medium text-forest-700 hover:underline">Invite your team</Link> to see their workload here.</p>;
  return (
    <ul className="space-y-4">
      {rows.map(({ t, n, overdue }) => (
        <li key={t.id} className="flex items-center gap-3">
          <Avatar name={t.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between text-[13.5px]">
              <span className="truncate font-medium text-ink-900">{t.name}</span>
              <span className="font-mono text-[11.5px] text-ink-600">{n} open{overdue ? <span className="text-rose-700"> · {overdue} late</span> : ''}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ivory-200">
              <div className={cx('h-full rounded-full transition-[width] duration-700', n >= 4 ? 'bg-gold-500' : 'bg-forest-700')} style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
            </div>
            <div className="mt-1 truncate text-[11px] text-ink-500">{t.shift} shift · {t.skills.join(' · ')}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SupervisorDashboard({ user }: { user: User }) {
  const db = useDb();
  const trend = useMemo(() => trendSeries(db, 10), [db]);
  const mine = db.workOrders.filter((w) => w.supervisorId === user.id);
  const review = mine.filter((w) => w.status === 'submitted');
  const triage = db.workOrders.filter((w) => w.status === 'triage');
  const overdue = mine.filter((w) => isOverdue(w));
  const inProgress = mine.filter((w) => w.status === 'in_progress');
  const rework = mine.filter((w) => w.status === 'rework');
  const parts = mine.filter((w) => w.status === 'on_hold');
  const flaggedAssets = db.assets.filter((a) => a.supervisorId === user.id && a.condition !== 'operational');
  const team = db.users.filter((u) => u.role === 'technician');
  const urgent = db.workOrders.filter((w) => (w.supervisorId === user.id || w.status === 'triage') && ['triage', 'assigned', 'in_progress', 'rework', 'on_hold'].includes(w.status) && (w.priority === 'critical' || w.priority === 'high' || isOverdue(w))).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 5);

  return (
    <div className="space-y-6">
      <Hero
        eyebrow={`${greeting()}, ${user.name.split(' ')[0]}`}
        title={<>Your team, <em>today</em></>}
        sub={`${review.length} report${review.length === 1 ? '' : 's'} waiting for your eye · ${triage.length} fault${triage.length === 1 ? '' : 's'} to triage · ${overdue.length} overdue`}
        actions={<><LinkButton to="/schedules"><CalendarClock size={16} />Schedules</LinkButton><LinkButton to="/work-orders/new" variant="primary"><Wrench size={16} />New work order</LinkButton></>}
      />
      <GettingStarted user={user} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="To review" value={<CountUp value={review.length} />} tone={review.length ? 'warn' : 'default'} to="/approvals" spark={trend.review} />
        <Stat label="To triage" value={<CountUp value={triage.length} />} tone={triage.length ? 'bad' : 'default'} to="/work-orders?status=triage" icon={<Siren size={15} />} />
        <Stat label="Overdue" value={<CountUp value={overdue.length} />} tone={overdue.length ? 'bad' : 'good'} to="/work-orders?overdue=1" spark={trend.overdue} />
        <Stat label="In progress" value={<CountUp value={inProgress.length} />} to="/work-orders?status=in_progress" />
        <Stat label="Out for rework" value={<CountUp value={rework.length} />} to="/work-orders?status=rework" />
        <Stat label="On hold / parts" value={<CountUp value={parts.length} />} to="/work-orders?status=on_hold" />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          {triage.length > 0 && (
            <section className="overflow-hidden rounded-[22px] border border-rose-200 bg-white shadow-card">
              <header className="flex items-center justify-between px-5 pb-2 pt-4">
                <h2 className="font-serif text-[26px] text-forest-900">New requests to <em>triage</em></h2>
                <span className="rounded-full bg-rose-700 px-2.5 py-0.5 font-mono text-[11px] text-white">{triage.length}</span>
              </header>
              <ul>
                {triage.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((w) => (
                  <li key={w.id} className="border-t border-ivory-200/70">
                    <Link to={`/work-orders/${w.id}`} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-rose-50/40">
                      <PriorityBadge p={w.priority} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink-900">{w.title}</span>
                        <span className="block text-xs text-ink-500"><span className="font-mono text-ink-700">{assetById(db, w.assetId)?.code ?? 'Facility'}</span> · reported by {userById(db, w.requestedById)?.name} · {relative(w.createdAt)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-forest-900 px-3 py-1.5 text-xs font-medium text-ivory-50 transition group-hover:bg-forest-800">Triage & assign <ArrowRight size={13} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="overflow-hidden rounded-[22px] border border-ivory-200 bg-white shadow-card">
            <header className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="font-serif text-[26px] text-forest-900">Review <em>queue</em></h2>
              <Link to="/approvals" className="inline-flex items-center gap-1 text-[13px] font-medium text-forest-700 hover:text-forest-900">Open queue <ArrowRight size={14} /></Link>
            </header>
            {review.length === 0 ? (
              <div className="p-5 pt-1"><EmptyState icon={<ClipboardCheck size={22} />} title="Queue is clear" body="New submissions from your team will land here." /></div>
            ) : (
              <ul>
                {review.map((w) => {
                  const subs = db.submissions.filter((s) => s.woId === w.id);
                  const last = subs[subs.length - 1];
                  return (
                    <li key={w.id} className="border-t border-ivory-200/70">
                      <Link to={`/work-orders/${w.id}/review`} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-gold-50/50">
                        <Avatar name={userById(db, last?.submittedById)?.name} size={38} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 truncate text-[14px] font-medium text-ink-900">{w.title}{last && last.version > 1 && <span className="rounded-full bg-gold-100 px-2 py-px font-mono text-[10px] uppercase text-gold-800">v{last.version}</span>}</span>
                          <span className="block text-xs text-ink-500"><span className="font-mono text-ink-700">{w.number}</span> · {userById(db, last?.submittedById)?.name} · {relative(last?.submittedAt)}</span>
                        </span>
                        {last && last.flags.length > 0 && <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 sm:flex"><AlertTriangle size={12} />{last.flags.length} flag{last.flags.length > 1 ? 's' : ''}</span>}
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ivory-100 text-ink-600 transition group-hover:bg-forest-900 group-hover:text-gold-300"><ArrowUpRight size={15} /></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="overflow-hidden rounded-[22px] border border-ivory-200 bg-white shadow-card">
            <header className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="font-serif text-[26px] text-forest-900">Needs <em>attention</em></h2>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-500">critical · high · overdue</span>
            </header>
            <AttentionList db={db} rows={urgent} />
          </section>
          <div>
            <h3 className="mb-3 font-serif text-[26px] text-forest-900">Open work — <em>my team</em></h3>
            <WOTable db={db} rows={mine.filter((w) => ['assigned', 'in_progress', 'rework', 'on_hold'].includes(w.status)).sort((a, b) => a.dueAt.localeCompare(b.dueAt))} />
          </div>
        </div>
        <div className="space-y-5 xl:col-span-4">
          <Card title={<>Team <em>on shift</em></>}><Workload db={db} techs={team} /></Card>
          <Card title={<>Equipment <em>to watch</em></>} pad={false}>
            {flaggedAssets.length === 0 ? <div className="px-5 pb-5 text-sm text-ink-500">All your equipment is operational.</div> : (
              <ul className="pb-2">
                {flaggedAssets.map((a) => (
                  <li key={a.id}>
                    <Link to={`/assets/${a.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 transition hover:bg-gold-50/50">
                      <span><span className="block font-mono text-[13px] text-ink-900">{a.code}</span><span className="block text-xs text-ink-500">{a.name}</span></span>
                      <ConditionBadge c={a.condition} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function EngineeringDashboard({ user }: { user: User }) {
  const db = useDb();
  const k = useMemo(() => computeKpis(db), [db]);
  const health = useMemo(() => healthIndex(db), [db]);
  const trend = useMemo(() => trendSeries(db, 14), [db]);
  const series = useMemo(() => activitySeries(db, 14), [db]);
  const [showDefs, setShowDefs] = useState(false);
  const critical = db.workOrders
    .filter((w) => !['closed', 'cancelled', 'completed', 'submitted'].includes(w.status) && (w.type === 'emergency' || w.escalated || w.priority === 'critical' || (isOverdue(w) && (w.priority === 'high' || assetById(db, w.assetId)?.criticality === 'critical'))))
    .concat(db.workOrders.filter((w) => w.status === 'rework' && w.priority === 'high'))
    .filter((w, i, arr) => arr.findIndex((x) => x.id === w.id) === i)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 5);
  const techs = db.users.filter((u) => u.role === 'technician');
  const repeat = db.assets
    .map((a) => ({ a, n: db.workOrders.filter((w) => w.assetId === a.id && w.source === 'fault' && Date.now() - new Date(w.createdAt).getTime() < 90 * 86400_000).length }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n);
  const top = repeat[0];
  const onShift = techs.filter((t) => t.status === 'active').length;

  return (
    <div className="space-y-5">
      <Hero
        eyebrow={`${greeting()}, ${user.name.split(' ')[0]}`}
        title={user.role === 'admin' ? <>Administration, <em>at a glance</em></> : <>Engineering, <em>at a glance</em></>}
        sub={`${db.property.name} — ${k.totalAssets} registered assets, ${onShift} technicians on the roster, ${k.openEmergencies} emergenc${k.openEmergencies === 1 ? 'y' : 'ies'} open.`}
        actions={<>
          <button onClick={() => setShowDefs((s) => !s)} className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm text-ink-600 transition hover:bg-ivory-200/70"><Info size={16} />How KPIs are calculated</button>
          {user.role !== 'admin' && <LinkButton to="/work-orders/new" variant="primary"><Wrench size={16} />New work order</LinkButton>}
        </>}
      />
      <GettingStarted user={user} />
      {showDefs && (
        <Card className="animate-pop" title={<>KPI <em>definitions</em></>}>
          <dl className="grid gap-4 sm:grid-cols-2">
            {KPI_DEFINITIONS.map((d) => <div key={d.name}><dt className="text-sm font-semibold text-ink-900">{d.name}</dt><dd className="mt-0.5 text-sm text-ink-600">{d.formula}</dd></div>)}
          </dl>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="grain relative overflow-hidden rounded-[26px] p-6 text-ivory-100 shadow-lift lg:col-span-5" style={{ backgroundColor: '#133426', backgroundImage: 'radial-gradient(90% 80% at 100% 0%, rgba(201,164,100,.30) 0%, rgba(201,164,100,0) 55%), radial-gradient(70% 70% at 0% 100%, #1F4D38 0%, rgba(19,52,38,0) 70%), var(--grain)' }}>
          <div className="flex items-center justify-between">
            <Eyebrow className="text-gold-300">Facility health index</Eyebrow>
            <Link to="/assets" className="inline-flex items-center gap-1 text-xs text-ivory-200/70 transition hover:text-white">Assets <ArrowUpRight size={13} /></Link>
          </div>
          <div className="mt-5 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <Ring value={k.totalAssets ? health : 0} size={172} stroke={13}>
              <div className="font-serif text-[68px] leading-[0.85] text-ivory-50">{k.totalAssets ? <CountUp value={health} /> : '—'}</div>
              <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ivory-200/60">of 100</div>
            </Ring>
            <div className="w-full flex-1 space-y-3">
              {[
                ['Operational', k.operational, '#6FC596'],
                ['Degraded', k.degraded, '#E3B04B'],
                ['Faulty / out of service', k.outOfService, '#E0705A'],
              ].map(([l, v, c]) => (
                <div key={l as string} className="flex items-center justify-between text-[14px]">
                  <span className="flex items-center gap-2.5"><span className="h-2 w-2 rounded-full" style={{ background: c as string }} />{l}</span>
                  <span className="font-mono">{v}</span>
                </div>
              ))}
              <div className="h-px bg-white/10" />
              <p className="text-xs leading-relaxed text-ivory-200/60">Blends PM compliance with equipment availability, weighted by criticality.</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 lg:col-span-7">
          <Stat label="PM compliance · 30d" value={<CountUp value={k.compliance} suffix="%" />} hint={`${k.complianceN} scheduled tasks on time`} tone={k.compliance >= 90 ? 'good' : 'warn'} spark={trend.compliance} />
          <Stat label="Overdue work" value={<CountUp value={k.overdue} />} hint="Open work past its due time" tone={k.overdue ? 'bad' : 'good'} to="/work-orders?overdue=1" spark={trend.overdue} chip={k.overdue ? 'Escalating' : 'Clear'} chipTone={k.overdue ? 'bad' : 'good'} />
          <Stat label="Awaiting approval" value={<CountUp value={k.awaitingApproval} />} hint={`Rework rate ${k.reworkRate}% (30 d)`} to="/approvals" spark={trend.review} tone={k.awaitingApproval ? 'warn' : 'default'} />
          <Stat label="Mean time to repair" value={k.mttrH ? `${Math.floor(k.mttrH)}h ${Math.round((k.mttrH % 1) * 60)}m` : '—'} hint={`Downtime 30 d · ${Math.round(k.downtimeH)} h`} spark={trend.completed} chip={`${k.openEmergencies} emergency`} chipTone={k.openEmergencies ? 'bad' : 'good'} />
        </div>

        <section className="overflow-hidden rounded-[22px] border border-ivory-200 bg-white shadow-card lg:col-span-7">
          <header className="flex items-center justify-between px-5 pb-2 pt-4">
            <h2 className="font-serif text-[26px] text-forest-900">Needs <em>attention</em></h2>
            <Link to="/work-orders" className="inline-flex items-center gap-1 text-[13px] font-medium text-forest-700 hover:text-forest-900">All work orders <ArrowRight size={14} /></Link>
          </header>
          <AttentionList db={db} rows={critical} />
        </section>

        <Card className="lg:col-span-5" title={<>Team <em>on shift</em></>}><Workload db={db} techs={techs} /></Card>

        <section className="rounded-[22px] border border-ivory-200 bg-white p-5 shadow-card lg:col-span-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-[26px] text-forest-900">Completed work, <em>14 days</em></h2>
            <div className="flex flex-wrap gap-3 text-xs text-ink-600">
              {[['Inspection', '#1F4D38'], ['Preventive', '#C9A464'], ['Corrective', '#9DBFA8'], ['Emergency', '#B4432E']].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />{l}</span>
              ))}
            </div>
          </div>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#EFE9DA" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8D8676', fontFamily: 'Geist Mono' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#8D8676', fontFamily: 'Geist Mono' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#F4F0E6' }} contentStyle={{ borderRadius: 14, border: '1px solid #E4DCC8', fontSize: 12, boxShadow: '0 12px 24px -16px rgba(16,41,31,.4)' }} />
                <Bar isAnimationActive={false} dataKey="Inspection" stackId="a" fill="#1F4D38" />
                <Bar isAnimationActive={false} dataKey="Preventive" stackId="a" fill="#C9A464" />
                <Bar isAnimationActive={false} dataKey="Corrective" stackId="a" fill="#9DBFA8" />
                <Bar isAnimationActive={false} dataKey="Emergency" stackId="a" fill="#B4432E" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[22px] border border-gold-200 bg-gold-50 p-5 shadow-card lg:col-span-4">
          <Eyebrow className="text-gold-700">Repeat failures · 90 days</Eyebrow>
          {top ? (
            <>
              <div className="font-serif text-[30px] leading-[1.05] text-forest-900"><span className="font-mono text-[24px] not-italic">{top.a.code}</span> has failed <em>{top.n === 1 ? 'once' : top.n === 2 ? 'twice' : `${top.n} times`}</em> this quarter.</div>
              <p className="text-[13px] leading-relaxed text-ink-600">{top.a.name}. {top.n >= 2 ? 'A root-cause review is recommended before the next failure.' : 'Monitoring — no pattern yet.'}</p>
              <ul className="mt-1 space-y-1.5">
                {repeat.slice(1, 4).map(({ a, n }) => (
                  <li key={a.id} className="flex items-center justify-between text-[13px]"><Link to={`/assets/${a.id}`} className="font-mono text-ink-800 hover:text-forest-700">{a.code}</Link><span className="flex items-center gap-2"><ConditionBadge c={a.condition} /><span className="font-mono text-ink-600">{n}</span></span></li>
                ))}
              </ul>
              <LinkButton to={`/assets/${top.a.id}`} className="mt-auto self-start" size="sm">Open asset history <ArrowRight size={13} /></LinkButton>
            </>
          ) : <p className="text-sm text-ink-600">No faults recorded in the last 90 days.</p>}
        </section>

        <section className="overflow-hidden rounded-[22px] border border-ivory-200 bg-white shadow-card lg:col-span-12">
          <header className="px-5 pb-1 pt-4"><h2 className="font-serif text-[26px] text-forest-900">By <em>department</em></h2></header>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Department</th><th className="text-right">Open</th><th className="text-right">Overdue</th><th className="text-right">Closed · 30 d</th><th className="w-1/3">Load</th></tr></thead>
              <tbody>
                {db.departments.filter((d) => d.isEngineering).map((d) => {
                  const ws = db.workOrders.filter((w) => w.departmentId === d.id);
                  const open = ws.filter((w) => !['closed', 'cancelled', 'completed'].includes(w.status)).length;
                  const late = ws.filter((w) => isOverdue(w)).length;
                  return (
                    <tr key={d.id}>
                      <td className="font-medium text-ink-900">{d.name}</td>
                      <td className="text-right font-mono">{open}</td>
                      <td className={cx('text-right font-mono', late ? 'text-rose-700' : 'text-ink-400')}>{late || '—'}</td>
                      <td className="text-right font-mono">{ws.filter((w) => w.closedAt && Date.now() - new Date(w.closedAt).getTime() < 30 * 86400_000).length}</td>
                      <td><div className="h-1.5 overflow-hidden rounded-full bg-ivory-200"><div className="h-full rounded-full bg-forest-700" style={{ width: `${Math.min(100, open * 20)}%` }} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {user.role === 'admin' && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Active users" value={db.users.filter((u) => u.status === 'active').length} to="/team" icon={<Users size={15} />} />
          <Stat label="Departments" value={db.departments.length} to="/team?tab=departments" icon={<Building2 size={15} />} />
          <Stat label="Checklist templates" value={db.templates.length} to="/templates" icon={<ListChecks size={15} />} />
          <Stat label="Audit events" value={db.audit.length} to="/audit" icon={<Timer size={15} />} />
        </div>
      )}
    </div>
  );
}

export { Siren };
