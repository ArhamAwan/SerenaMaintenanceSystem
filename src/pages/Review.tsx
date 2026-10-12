import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Columns2, FilePlus2, RotateCcw, Camera, ShieldAlert, AlertTriangle } from 'lucide-react';
import { assetById, isFieldVisible, locationPath, reviewSubmission, submissionsFor, templateFields, useCurrentUser, useDb, userById } from '../lib/store';
import { can } from '../lib/permissions';
import { attempt, Button, Card, cx, EmptyState, Field, Input, LinkButton, PriorityBadge, StatusBadge, Textarea, Unauthorized } from '../components/ui';
import { PhotoGrid, ReviewNote, SubmissionView } from '../components/submission';
import { FlagList } from '../components/wo';
import { addHours, durationMin, fmtDateTime, fmtDuration, nowIso } from '../lib/time';
import type { Db, Submission } from '../lib/types';

type Decision = 'approved' | 'rework' | 'evidence';

export default function Review() {
  const { id } = useParams();
  const db = useDb();
  const user = useCurrentUser()!;
  const nav = useNavigate();
  const [decision, setDecision] = useState<Decision>('approved');
  const [comment, setComment] = useState('');
  const [due, setDue] = useState(() => new Date(new Date(addHours(nowIso(), 4)).getTime() + 5 * 3600_000).toISOString().slice(0, 16));
  const [compare, setCompare] = useState(false);
  const wo = db.workOrders.find((w) => w.id === id);
  if (!can(user, 'wo.review')) return <Unauthorized message="Only supervisors and the Chief Engineer can review submissions." />;
  if (!wo) return <EmptyState title="Work order not found" />;
  const subs = submissionsFor(db, wo.id);
  const latest = subs[subs.length - 1];
  const prevSub = subs[subs.length - 2];
  if (!latest) return <EmptyState title="Nothing submitted yet" action={<LinkButton to={`/work-orders/${wo.id}`}>View work order</LinkButton>} />;
  if (wo.status !== 'submitted') {
    return <EmptyState title="This submission has already been reviewed" body={`Current status: ${wo.status.replace('_', ' ')}`} action={<LinkButton to={`/work-orders/${wo.id}`} variant="primary">Open work order</LinkButton>} />;
  }
  const asset = assetById(db, wo.assetId);
  const reviews = db.reviews.filter((r) => r.woId === wo.id).sort((a, b) => a.at.localeCompare(b.at));
  const selfReview = latest.submittedById === user.id || wo.leadTechId === user.id || wo.helperIds.includes(user.id);
  const history = db.workOrders.filter((w) => w.assetId === wo.assetId && w.id !== wo.id && (w.status === 'closed' || w.status === 'completed')).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 5);
  const chips = ['Photo is unclear — please retake', 'Close-up photo needed', 'Reading missing or not legible', 'Please re-check the reading', 'Add more detail to remarks'];

  const submit = () => {
    const ok = attempt(() => reviewSubmission(user, wo.id, decision, comment, decision === 'approved' ? undefined : new Date(`${due}:00+05:00`).toISOString()), decision === 'approved' ? 'Approved — report finalised and added to asset history' : 'Returned to technician with your instructions');
    if (ok) nav('/approvals');
  };

  return (
    <div>
      <Link to="/approvals" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft size={15} />Review queue</Link>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium text-gold-700">{wo.number}</span><StatusBadge status={wo.status} wo={wo} /><PriorityBadge p={wo.priority} />{latest.version > 1 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Resubmission v{latest.version}</span>}</div>
          <h1 className="mt-1.5 font-serif text-[2.6rem] leading-[1] text-forest-900"><em>Reviewing</em> {wo.title}</h1>
          <div className="mt-0.5 text-sm text-ink-500">{asset ? `${asset.code} · ${asset.name} · ` : ''}{locationPath(db, wo.locationId)}</div>
        </div>
        <Link to={`/work-orders/${wo.id}`} className="text-sm text-forest-700 hover:underline">Full work order →</Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <div><div className="text-xs text-ink-500">Technician</div><div className="font-medium">{userById(db, latest.submittedById)?.name}</div></div>
              <div><div className="text-xs text-ink-500">Scheduled</div><div className="font-medium">{fmtDateTime(wo.scheduledFor)}</div></div>
              <div><div className="text-xs text-ink-500">Submitted</div><div className={cx('font-medium', latest.submittedAt > wo.dueAt && 'text-rose-700')}>{fmtDateTime(latest.submittedAt)}{latest.submittedAt > wo.dueAt && ' (late)'}</div></div>
              <div><div className="text-xs text-ink-500">Time on task</div><div className="font-medium">{fmtDuration(durationMin(latest.startedAt, latest.submittedAt))}</div></div>
              <div><div className="text-xs text-ink-500">Photos</div><div className="font-medium">{latest.photos.length}</div></div>
              <div><div className="text-xs text-ink-500">Rework cycles</div><div className={cx('font-medium', wo.reworkCount >= 2 && 'text-rose-700')}>{wo.reworkCount}{wo.reworkCount >= 2 && ' — repeated'}</div></div>
            </div>
            <div className="mt-4 rounded-lg bg-ivory-50 px-3 py-2 text-sm text-ink-700 ring-1 ring-ivory-200"><b>Original instructions:</b> {wo.instructions}</div>
          </Card>

          {latest.flags.length > 0 && (
            <Card title={<span className="flex items-center gap-2"><AlertTriangle size={15} className="text-amber-600" />Detected abnormalities</span>}>
              <FlagList flags={latest.flags} />
              <div className="mt-3 flex flex-wrap gap-2">
                <LinkButton to={`/work-orders/new?asset=${wo.assetId}&type=corrective&from=${wo.id}`} size="sm"><FilePlus2 size={14} />Create corrective work order</LinkButton>
              </div>
            </Card>
          )}

          <Card
            title={compare && prevSub ? `Compare v${prevSub.version} ↔ v${latest.version}` : `Submission v${latest.version}`}
            action={prevSub && <Button size="sm" variant={compare ? 'primary' : 'secondary'} onClick={() => setCompare((c) => !c)}><Columns2 size={14} />{compare ? 'Single view' : `Compare with v${prevSub.version}`}</Button>}
          >
            {compare && prevSub ? <Compare db={db} a={prevSub} b={latest} /> : <SubmissionView db={db} sub={latest} />}
          </Card>

          {reviews.length > 0 && (
            <Card title="Previous review decisions">
              <div className="space-y-2">{reviews.map((r) => <ReviewNote key={r.id} db={db} r={r} />)}</div>
            </Card>
          )}

          {history.length > 0 && (
            <Card title={`Recent history — ${asset?.code}`} pad={false}>
              <ul className="divide-y divide-ivory-200">
                {history.map((h) => {
                  const s = submissionsFor(db, h.id).slice(-1)[0];
                  return (
                    <li key={h.id}>
                      <Link to={`/work-orders/${h.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-ivory-50">
                        <CheckCircle2 size={15} className="text-forest-600" />
                        <span className="flex-1 truncate">{h.title}</span>
                        {s && s.flags.length > 0 && <span className="text-xs text-amber-700">{s.flags.length} flag</span>}
                        <span className="text-xs text-ink-500">{fmtDateTime(h.completedAt)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card title="Your decision">
            {selfReview ? (
              <div className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-900"><ShieldAlert size={16} className="mt-0.5 shrink-0" />You worked on this job, so you cannot approve it. Another authorised reviewer must review it.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2">
                  {([
                    ['approved', 'Approve', 'Finalise the report and add it to asset history', <CheckCircle2 size={18} key="a" />],
                    ['rework', 'Request rework', 'Return to technician with corrective instructions', <RotateCcw size={18} key="b" />],
                    ['evidence', 'Request more evidence', 'Ask for photos, readings or missing details', <Camera size={18} key="c" />],
                  ] as const).map(([v, l, d, icon]) => (
                    <button key={v} onClick={() => setDecision(v)} className={cx('flex items-start gap-3 rounded-xl border-2 p-3 text-left transition', decision === v ? (v === 'approved' ? 'border-forest-600 bg-forest-50' : 'border-orange-400 bg-orange-50') : 'border-ivory-300 bg-white hover:border-ivory-300')}>
                      <span className={cx('mt-0.5', decision === v ? (v === 'approved' ? 'text-forest-700' : 'text-orange-700') : 'text-ink-400')}>{icon}</span>
                      <span><span className="block text-sm font-semibold text-ink-900">{l}</span><span className="block text-xs text-ink-500">{d}</span></span>
                    </button>
                  ))}
                </div>
                {decision !== 'approved' && (
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((c) => <button key={c} type="button" onClick={() => setComment((x) => (x ? `${x} ${c}.` : `${c}.`))} className="rounded-full bg-ivory-200 px-2.5 py-1 text-xs text-ink-700 hover:bg-ivory-300">+ {c}</button>)}
                  </div>
                )}
                <Field label={decision === 'approved' ? 'Comment (optional)' : 'Instructions for the technician'} required={decision !== 'approved'}>
                  <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={decision === 'approved' ? 'Optional note' : 'Be specific: what to check, which photos to take, which readings to record'} />
                </Field>
                {decision !== 'approved' && <Field label="New deadline"><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>}
                <Button variant={decision === 'approved' ? 'primary' : 'gold'} size="lg" className="w-full" onClick={submit}>
                  {decision === 'approved' ? 'Approve submission' : 'Send back to technician'}
                </Button>
                <p className="text-center text-xs text-ink-500">Your identity and the time are recorded in the audit trail.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Compare({ db, a, b }: { db: Db; a: Submission; b: Submission }) {
  const fields = templateFields(db, b.templateId, b.templateVersion).filter((f) => f.type !== 'photo' && (isFieldVisible(f, a.answers) || isFieldVisible(f, b.answers)));
  const show = (s: Submission, id: string, unit?: string) => {
    const v = s.answers[id];
    return v === null || v === undefined || v === '' ? '—' : `${v}${unit ? ' ' + unit : ''}`;
  };
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Item</th><th>v{a.version} · {fmtDateTime(a.submittedAt)}</th><th>v{b.version} · {fmtDateTime(b.submittedAt)}</th></tr></thead>
          <tbody>
            {fields.map((f) => {
              const changed = show(a, f.id) !== show(b, f.id);
              return (
                <tr key={f.id} className={changed ? 'bg-gold-50' : ''}>
                  <td className="text-ink-600">{f.label}</td>
                  <td className={cx(changed && 'text-ink-500 line-through decoration-ink-300')}>{show(a, f.id, f.unit)}</td>
                  <td className={cx('font-medium', changed && 'text-forest-800')}>{show(b, f.id, f.unit)}{changed && <span className="ml-1.5 text-[10px] font-bold uppercase text-gold-700">changed</span>}</td>
                </tr>
              );
            })}
            <tr><td className="text-ink-600">Notes</td><td>{a.notes || '—'}</td><td className="font-medium">{b.notes || '—'}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">v{a.version} evidence ({a.photos.length})</div><PhotoGrid photos={a.photos} cols={2} /></div>
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-forest-700">v{b.version} evidence ({b.photos.length})</div><PhotoGrid photos={b.photos} cols={2} /></div>
      </div>
    </div>
  );
}
