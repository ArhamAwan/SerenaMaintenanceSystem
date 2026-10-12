import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, FileText, Printer, QrCode, Siren, Wrench, CalendarClock } from 'lucide-react';
import { locationPath, setAssetCondition, submissionsFor, templateFields, upcomingOccurrences, useCurrentUser, useDb, userById } from '../lib/store';
import { can } from '../lib/permissions';
import { CRIT_META } from '../lib/meta';
import { attempt, Button, Card, ConditionBadge, cx, EmptyState, Field, KV, LinkButton, Modal, Select, Tabs, Textarea } from '../components/ui';
import { Timeline, WOTable } from '../components/wo';
import { demoPhoto } from '../lib/photos';
import { rangeText } from '../lib/rules';
import { durationMin, fmtDate, fmtDateShort, fmtDateTime, fmtDuration, nowIso, pkDate, weekday } from '../lib/time';
import type { Condition, Db, TemplateField } from '../lib/types';

type Tab = 'overview' | 'history' | 'readings' | 'documents' | 'activity';

export default function AssetDetail() {
  const { id } = useParams();
  const db = useDb();
  const user = useCurrentUser()!;
  const [tab, setTab] = useState<Tab>('overview');
  const [qr, setQr] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [cond, setCond] = useState<Condition>('operational');
  const [reason, setReason] = useState('');
  const a = db.assets.find((x) => x.id === id);
  const url = `${location.origin}${location.pathname}#/assets/${id}`;
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#173022', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [url]);

  const wos = useMemo(() => db.workOrders.filter((w) => w.assetId === id), [db, id]);
  if (!a) return <EmptyState title="Asset not found" action={<LinkButton to="/assets">All assets</LinkButton>} />;
  if (!can(user, 'asset.view')) return <EmptyState title="Access restricted" />;

  const active = wos.filter((w) => !['closed', 'cancelled', 'completed'].includes(w.status)).sort((x, y) => x.dueAt.localeCompare(y.dueAt));
  const history = wos.filter((w) => ['closed', 'completed', 'cancelled'].includes(w.status)).sort((x, y) => (y.completedAt ?? y.createdAt).localeCompare(x.completedAt ?? x.createdAt));
  const plans = db.plans.filter((p) => p.assetId === a.id);
  const faults = wos.filter((w) => w.source === 'fault');
  const downtimeMin = faults.filter((w) => w.fault && !w.fault.equipmentOperational).reduce((s, w) => s + (durationMin(w.createdAt, w.returnedToServiceAt ?? nowIso()) ?? 0), 0);
  const events = db.audit.filter((e) => e.entityId === a.id || wos.some((w) => w.id === e.entityId)).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 40);
  const lastDone = history.find((w) => w.completedAt);
  const sup = userById(db, a.supervisorId);

  return (
    <div>
      <Link to="/assets" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft size={15} />Assets</Link>
      <div className="mb-6 overflow-hidden rounded-2xl border border-ivory-300/80 bg-white shadow-card md:flex">
        <img src={demoPhoto(`${a.code} · ${a.name}`, a.category.length * 23, a.code.charCodeAt(0) % 4)} alt="" className="h-48 w-full object-cover md:h-auto md:w-72" />
        <div className="flex-1 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold tracking-wide text-gold-700">{a.code} · {a.category}</div>
              <h1 className="font-serif text-[2.6rem] leading-[1] text-forest-900">{a.name}</h1>
              <div className="mt-1 text-sm text-ink-500">{locationPath(db, a.locationId)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowQr(true)}><QrCode size={14} />QR code</Button>
              {can(user, 'wo.create') && <LinkButton size="sm" to={`/work-orders/new?asset=${a.id}`}><Wrench size={14} />New work order</LinkButton>}
              {can(user, 'fault.report') && <LinkButton size="sm" variant="danger" to={`/report-fault?asset=${a.id}`}><Siren size={14} />Report fault</LinkButton>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-ink-500">Condition</div><div className="mt-0.5 flex items-center gap-2"><ConditionBadge c={a.condition} />{(can(user, 'asset.manage') || can(user, 'wo.review')) && <button onClick={() => { setCond(a.condition); setCondOpen(true); }} className="text-xs text-forest-700 hover:underline">Change</button>}</div></div>
            <div><div className="text-xs text-ink-500">Maintenance status</div><div className="mt-0.5 font-medium">{active.some((w) => w.status === 'in_progress') ? 'Under maintenance' : active.some((w) => w.status === 'on_hold') ? 'Awaiting parts' : active.some((w) => w.status === 'submitted') ? 'Awaiting approval' : active.length ? 'Work scheduled' : 'No active work'}</div></div>
            <div><div className="text-xs text-ink-500">Criticality</div><div className={cx('mt-0.5 font-semibold capitalize', CRIT_META[a.criticality].cls)}>{a.criticality}</div></div>
            <div><div className="text-xs text-ink-500">Responsible</div><div className="mt-0.5 font-medium">{sup?.name}</div></div>
            <div><div className="text-xs text-ink-500">Last service</div><div className="mt-0.5 font-medium">{fmtDate(lastDone?.completedAt)}</div></div>
            <div><div className="text-xs text-ink-500">Open work</div><div className="mt-0.5 font-medium">{active.length}</div></div>
            <div><div className="text-xs text-ink-500">Faults (all time)</div><div className="mt-0.5 font-medium">{faults.length}</div></div>
            <div><div className="text-xs text-ink-500">Recorded downtime</div><div className="mt-0.5 font-medium">{fmtDuration(downtimeMin)}</div></div>
          </div>
        </div>
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'history', label: 'Maintenance history', count: history.length }, { value: 'readings', label: 'Readings & trends' }, { value: 'documents', label: 'Documents', count: a.documents.length }, { value: 'activity', label: 'Activity' }]} />
      <div className="mt-5">
        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div>
                <h3 className="mb-3 font-serif text-[25px] leading-tight text-forest-900">Active work orders</h3>
                <WOTable db={db} rows={active} empty="No active work on this asset." />
              </div>
              <Card title={<span className="flex items-center gap-2"><CalendarClock size={15} />Maintenance plans & next 14 days</span>}>
                {plans.length === 0 ? <div className="text-sm text-ink-500">No maintenance plan configured.</div> : (
                  <div className="space-y-3">
                    {plans.map((p) => {
                      const occ = upcomingOccurrences(p, pkDate(), 14);
                      return (
                        <div key={p.id} className="rounded-lg border border-ivory-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-ink-900">{p.name}</span><span className={cx('text-xs', p.active ? 'text-forest-700' : 'text-ink-400')}>{p.active ? 'Active' : 'Suspended'} · {p.frequency === 'every_n_days' ? `every ${p.interval} days` : p.frequency} at {p.dueTime}</span></div>
                          <div className="mt-2 flex flex-wrap gap-1.5">{occ.slice(0, 14).map((d) => <span key={d} className="rounded bg-ivory-100 px-2 py-0.5 text-xs text-ink-700">{weekday(d)} {fmtDateShort(d)}</span>)}{occ.length === 0 && <span className="text-xs text-ink-500">No occurrences in the next 14 days</span>}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
            <div className="space-y-6">
              <Card title="Identity & specifications">
                <dl>
                  <KV k="Manufacturer" v={a.manufacturer} />
                  <KV k="Model" v={a.model} />
                  <KV k="Serial number" v={a.serial} />
                  <KV k="Installed" v={fmtDate(a.installDate)} />
                  <KV k="Warranty until" v={<span className={a.warrantyUntil < pkDate() ? 'text-ink-500' : 'text-forest-700'}>{fmtDate(a.warrantyUntil)}{a.warrantyUntil < pkDate() ? ' (expired)' : ''}</span>} />
                  <KV k="Vendor" v={a.vendor} />
                  <KV k="Department" v={db.departments.find((d) => d.id === a.departmentId)?.name} />
                  {Object.entries(a.specs).map(([k, v]) => <KV key={k} k={k} v={v} />)}
                </dl>
              </Card>
            </div>
          </div>
        )}
        {tab === 'history' && <WOTable db={db} rows={history} empty="No completed maintenance yet." />}
        {tab === 'readings' && <Readings db={db} assetId={a.id} />}
        {tab === 'documents' && (
          <Card>
            <ul className="divide-y divide-ivory-200">
              {a.documents.map((d) => <li key={d.name} className="flex items-center gap-3 py-3 text-sm"><FileText size={18} className="text-gold-600" /><span className="flex-1 text-ink-800">{d.name}</span><span className="text-xs text-ink-500">{d.size}</span><span className="rounded bg-ivory-200 px-2 py-0.5 text-[11px] text-ink-600">Private · signed URL</span></li>)}
            </ul>
            <p className="mt-3 text-xs text-ink-500">Demo: document files are placeholders. In production they are stored in private object storage and served through short-lived signed links.</p>
          </Card>
        )}
        {tab === 'activity' && <Card><Timeline db={db} events={events} /></Card>}
      </div>

      <Modal open={showQr} onClose={() => setShowQr(false)} title={`${a.code} — QR label`} footer={<Button variant="primary" onClick={() => window.print()}><Printer size={16} />Print label</Button>}>
        <div className="flex flex-col items-center rounded-xl border-2 border-forest-800 p-5 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-gold-700">Islamabad Serena Hotel · Engineering</div>
          {qr && <img src={qr} alt="QR code" className="my-3 h-56 w-56" />}
          <div className="font-serif text-[30px] text-forest-900">{a.code}</div>
          <div className="text-sm text-ink-600">{a.name}</div>
        </div>
        <p className="text-xs text-ink-500">Scanning opens this asset's page after sign-in. The QR code identifies equipment only — it never grants access.</p>
      </Modal>
      <Modal open={condOpen} onClose={() => setCondOpen(false)} title="Change asset condition" footer={<><Button onClick={() => setCondOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => attempt(() => setAssetCondition(user, a.id, cond, reason), 'Condition updated') && (setCondOpen(false), setReason(''))}>Save</Button></>}>
        <Field label="Physical condition"><Select value={cond} onChange={(e) => setCond(e.target.value as Condition)}>{['operational', 'degraded', 'faulty', 'out_of_service', 'decommissioned'].map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</Select></Field>
        <Field label="Reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {cond === 'decommissioned' && <p className="text-xs text-ink-500">Decommissioning keeps the full service history.</p>}
      </Modal>
    </div>
  );
}

function Readings({ db, assetId }: { db: Db; assetId: string }) {
  const wos = db.workOrders.filter((w) => w.assetId === assetId && w.templateId);
  const points: { field: TemplateField; at: string; value: number; status: string; woId: string; version: number }[] = [];
  for (const w of wos) {
    const subs = submissionsFor(db, w.id);
    const latest = subs[subs.length - 1];
    if (!latest) continue;
    const fields = templateFields(db, latest.templateId, latest.templateVersion);
    for (const f of fields) {
      if (f.type !== 'number') continue;
      const v = latest.answers[f.id];
      if (v === null || v === undefined || v === '') continue;
      points.push({ field: f, at: latest.submittedAt, value: Number(v), status: w.status, woId: w.id, version: latest.version });
    }
  }
  const byField = new Map<string, typeof points>();
  points.forEach((p) => byField.set(p.field.id, [...(byField.get(p.field.id) ?? []), p]));
  if (!byField.size) return <EmptyState title="No readings recorded yet" body="Numeric checklist readings appear here once inspections are submitted." />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {Array.from(byField.values()).map((pts) => {
        const f = pts[0].field;
        const data = pts.sort((x, y) => x.at.localeCompare(y.at)).map((p) => ({ t: fmtDateShort(p.at), v: p.value, at: p.at }));
        const breaches = pts.filter((p) => (f.normalMin !== undefined && p.value < f.normalMin) || (f.normalMax !== undefined && p.value > f.normalMax));
        const vals = data.map((d) => d.v);
        const lo = Math.min(...vals, f.normalMin ?? Infinity, f.critMin ?? Infinity);
        const hi = Math.max(...vals, f.normalMax ?? -Infinity, f.critMax ?? -Infinity);
        const pad = (hi - lo) * 0.12 || 1;
        const span = hi - lo + 2 * pad;
        const step = span > 1000 ? 10 : span > 50 ? 10 : span > 10 ? 2 : 0.5;
        const y0 = Math.floor((lo - pad) / step) * step;
        const y1 = Math.ceil((hi + pad) / step) * step;
        const hasRange = f.normalMin !== undefined || f.normalMax !== undefined;
        return (
          <Card key={f.id} title={`${f.label}${f.unit ? ` · ${f.unit}` : ''}`} action={<span className="text-xs text-ink-500">{pts.length} readings{breaches.length ? <span className="text-amber-700"> · {breaches.length} out of range</span> : ''}</span>}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 6, right: 10, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#ece6d8" />
                  {hasRange && <ReferenceArea y1={f.normalMin ?? y0} y2={f.normalMax ?? y1} fill="#2f5a3d" fillOpacity={0.07} />}
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6b6860' }} tickLine={false} axisLine={{ stroke: '#e3dccb' }} minTickGap={16} />
                  <YAxis domain={[y0, y1]} allowDecimals={step < 1} tick={{ fontSize: 10, fill: '#6b6860' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e9e2d1', fontSize: 12 }} formatter={(v: number) => [`${v} ${f.unit ?? ''}`, f.label]} labelFormatter={(_, p) => (p?.[0] ? fmtDateTime((p[0].payload as { at: string }).at) : '')} />
                  <Line isAnimationActive={false} type="monotone" dataKey="v" stroke="#264a33" strokeWidth={2} dot={(props: { cx?: number; cy?: number; payload?: { v: number }; index?: number }) => {
                    const v = props.payload?.v ?? 0;
                    const bad = (f.normalMin !== undefined && v < f.normalMin) || (f.normalMax !== undefined && v > f.normalMax);
                    return <circle key={props.index} cx={props.cx} cy={props.cy} r={bad ? 5 : 3} fill={bad ? '#d97706' : '#264a33'} stroke="#fff" strokeWidth={1.5} />;
                  }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-ink-500">{hasRange ? `Shaded band: normal range ${rangeText(f)} (demo thresholds)` : 'Meter reading — no threshold configured'}</div>
            {breaches.length > 0 && (
              <div className="mt-2 space-y-1">
                {breaches.map((b) => <Link key={b.woId} to={`/work-orders/${b.woId}`} className="block text-xs text-amber-800 hover:underline">⚠ {b.value} {f.unit} on {fmtDateTime(b.at)} (v{b.version})</Link>)}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
