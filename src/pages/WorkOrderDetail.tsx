import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Ban, CheckCircle2, ClipboardCheck, FileText, Flag, MessageSquare, Pause, Play, Printer, RotateCcw, ShieldAlert, ThumbsDown, ThumbsUp, UserCog, Wrench, PowerOff, Power,
} from 'lucide-react';
import {
  addComment, assetById, cancelWO, closeWO, confirmResolution, escalate, holdWork, isOverdue, locationPath, reassign, resumeWork, returnToService, startWork,
  submissionsFor, triageAndAssign, useCurrentUser, useDb, userById,
} from '../lib/store';
import { can, canViewWO } from '../lib/permissions';
import { TYPE_LABEL } from '../lib/meta';
import { durationMin, fmtDateTime, fmtDuration, addHours, nowIso } from '../lib/time';
import { attempt, Avatar, Button, Card, ConditionBadge, cx, EmptyState, Field, Input, KV, LinkButton, Modal, Pill, PriorityBadge, Select, StatusBadge, Textarea } from '../components/ui';
import { Timeline } from '../components/wo';
import { PhotoGrid, ReviewNote, SubmissionView } from '../components/submission';
import type { Db, Priority, User, WorkOrder } from '../lib/types';

type ModalKind = null | 'triage' | 'reassign' | 'hold' | 'cancel' | 'escalate' | 'close' | 'confirm' | 'reopen' | 'rts';

export default function WorkOrderDetail() {
  const { id } = useParams();
  const db = useDb();
  const user = useCurrentUser()!;
  const nav = useNavigate();
  const [modal, setModal] = useState<ModalKind>(null);
  const [comment, setComment] = useState('');
  const [openVersion, setOpenVersion] = useState<number | null>(null);
  const wo = db.workOrders.find((w) => w.id === id);
  if (!wo) return <EmptyState title="Work order not found" action={<LinkButton to="/">Back</LinkButton>} />;
  if (!canViewWO(user, wo)) return <EmptyState title="Access restricted" body="This work order is not assigned to you." action={<LinkButton to="/">Back</LinkButton>} />;

  const asset = assetById(db, wo.assetId);
  const subs = submissionsFor(db, wo.id);
  const reviews = db.reviews.filter((r) => r.woId === wo.id).sort((a, b) => a.at.localeCompare(b.at));
  const lastReview = reviews[reviews.length - 1];
  const isAssignee = wo.leadTechId === user.id || wo.helperIds.includes(user.id);
  const isSup = can(user, 'wo.assign');
  const events = db.audit.filter((e) => e.entityId === wo.id).sort((a, b) => b.at.localeCompare(a.at));
  const comments = db.comments.filter((c) => c.woId === wo.id).sort((a, b) => a.at.localeCompare(b.at));
  const shownVersion = openVersion ?? subs[subs.length - 1]?.version;

  const actions: React.ReactNode[] = [];
  if (isAssignee && can(user, 'wo.execute')) {
    if (wo.status === 'assigned') actions.push(<Button key="start" variant="primary" size="lg" onClick={() => attempt(() => startWork(user, wo.id)) && nav(`/work-orders/${wo.id}/execute`)}><Play size={18} />Start work</Button>);
    if (wo.status === 'rework') actions.push(<Button key="rw" variant="gold" size="lg" onClick={() => attempt(() => startWork(user, wo.id)) && nav(`/work-orders/${wo.id}/execute`)}><RotateCcw size={18} />Start rework</Button>);
    if (wo.status === 'in_progress') actions.push(<LinkButton key="cont" to={`/work-orders/${wo.id}/execute`} variant="primary" size="lg"><ClipboardCheck size={18} />{wo.draft ? 'Continue report' : 'Open checklist'}</LinkButton>);
    if (wo.status === 'in_progress') actions.push(<Button key="hold" size="lg" onClick={() => setModal('hold')}><Pause size={18} />Pause / hold</Button>);
    if (wo.status === 'on_hold') actions.push(<Button key="res" variant="primary" size="lg" onClick={() => attempt(() => resumeWork(user, wo.id), 'Work resumed')}><Play size={18} />Resume</Button>);
  }
  if (isSup) {
    if (wo.status === 'triage') actions.push(<Button key="tri" variant="primary" onClick={() => setModal('triage')}><UserCog size={16} />Triage & assign</Button>);
    if (wo.status === 'submitted' && can(user, 'wo.review')) actions.push(<LinkButton key="rev" to={`/work-orders/${wo.id}/review`} variant="gold"><ClipboardCheck size={16} />Review submission</LinkButton>);
    if (wo.status === 'completed' && wo.source === 'fault' && asset && !wo.returnedToServiceAt && asset.condition !== 'operational') actions.push(<Button key="rts" variant="success" onClick={() => setModal('rts')}><Power size={16} />Return to service</Button>);
    if (wo.status === 'completed') actions.push(<Button key="close" onClick={() => setModal('close')}><CheckCircle2 size={16} />Close</Button>);
    if (['assigned', 'in_progress', 'on_hold', 'rework'].includes(wo.status)) actions.push(<Button key="re" onClick={() => setModal('reassign')}><UserCog size={16} />Reassign</Button>);
    if (wo.status === 'on_hold') actions.push(<Button key="res2" onClick={() => attempt(() => resumeWork(user, wo.id), 'Work resumed')}><Play size={16} />Resume</Button>);
  }
  if (wo.requestedById === user.id && wo.status === 'completed') {
    actions.push(<Button key="conf" variant="success" size="lg" onClick={() => setModal('confirm')}><ThumbsUp size={18} />Confirm resolved</Button>);
    actions.push(<Button key="reo" variant="danger" size="lg" onClick={() => setModal('reopen')}><ThumbsDown size={18} />Issue persists</Button>);
  }
  const secondary: React.ReactNode[] = [];
  if (!['closed', 'cancelled'].includes(wo.status) && (isSup || isAssignee) && !wo.escalated) secondary.push(<Button key="esc" variant="ghost" size="sm" onClick={() => setModal('escalate')}><Flag size={14} />Escalate</Button>);
  if (can(user, 'wo.cancel') && !['closed', 'cancelled', 'completed'].includes(wo.status)) secondary.push(<Button key="can" variant="ghost" size="sm" onClick={() => setModal('cancel')}><Ban size={14} />Cancel</Button>);
  if (subs.length) secondary.push(<LinkButton key="pr" to={`/work-orders/${wo.id}/print`} variant="ghost" size="sm"><Printer size={14} />Report / PDF</LinkButton>);

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft size={15} />Back</button>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-gold-700">{wo.number}</span>
            <StatusBadge status={wo.status} wo={wo} />
            <PriorityBadge p={wo.priority} />
            <Pill>{TYPE_LABEL[wo.type]}</Pill>
            {wo.reworkCount > 0 && <Pill className="bg-orange-100 text-orange-800"><RotateCcw size={11} />Rework ×{wo.reworkCount}</Pill>}
            {wo.escalated && <Pill className="bg-rose-100 text-rose-800"><Flag size={11} />Escalated</Pill>}
          </div>
          <h1 className="mt-2 font-serif text-[2.6rem] leading-[1] text-forest-900">{wo.title}</h1>
          <div className="mt-1 text-sm text-ink-500">
            {asset ? <Link to={`/assets/${asset.id}`} className="font-medium text-forest-700 hover:underline">{asset.code} · {asset.name}</Link> : 'Facility'} · {locationPath(db, wo.locationId)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{secondary}</div>
      </div>

      {wo.status === 'rework' && lastReview && lastReview.decision !== 'approved' && (
        <div className="mb-5 rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-900"><RotateCcw size={16} />{wo.requesterConfirmation === 'reopened' ? 'Reopened by requester' : lastReview.decision === 'evidence' ? 'Supervisor requested more evidence' : 'Supervisor requested rework'}</div>
          <p className="mt-1.5 text-[15px] text-orange-950">“{wo.requesterConfirmation === 'reopened' ? events.find((e) => e.action.startsWith('Reopened'))?.reason : lastReview.comment}”</p>
          <div className="mt-1 text-xs text-orange-800">{userById(db, lastReview.reviewerId)?.name} · {fmtDateTime(lastReview.at)}{lastReview.newDueAt && ` · new deadline ${fmtDateTime(lastReview.newDueAt)}`}</div>
        </div>
      )}
      {wo.status === 'on_hold' && wo.holdReason && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 p-4 text-sm text-stone-800"><Pause size={16} /><b>On hold:</b> {wo.holdReason}</div>
      )}
      {wo.status === 'completed' && wo.requestedById === user.id && (
        <div className="mb-5 rounded-xl border-2 border-forest-300 bg-forest-50 p-4 text-sm text-forest-900"><b>Engineering has completed this repair.</b> Please check and confirm whether the issue is resolved.</div>
      )}
      {wo.status === 'completed' && isSup && wo.source === 'fault' && (
        <div className="mb-5 rounded-xl border border-gold-200 bg-gold-50 p-4 text-sm text-gold-900">
          Repair approved. {asset && asset.condition !== 'operational' && !wo.returnedToServiceAt ? <>Equipment is still marked <b>{asset.condition.replace(/_/g, ' ')}</b> — return it to service once verified. </> : null}
          {wo.requesterConfirmation ? 'Requester has confirmed.' : 'Awaiting requester confirmation.'}
        </div>
      )}

      {actions.length > 0 && (
        <div className="sticky top-[84px] z-10 mb-5 flex flex-wrap gap-2 rounded-[20px] border border-white/70 bg-ivory-50/80 p-2.5 shadow-lift backdrop-blur-xl">
          {actions}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Instructions">
            {wo.description && <p className="mb-3 text-sm text-ink-700">{wo.description}</p>}
            <p className="text-sm text-ink-800">{wo.instructions || '—'}</p>
            {wo.safety && <div className="mt-3 flex gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-900 ring-1 ring-rose-100"><ShieldAlert size={16} className="mt-0.5 shrink-0" /><span><b>Safety:</b> {wo.safety}</span></div>}
            {asset && (
              <div className="mt-3 flex flex-wrap gap-2">
                {asset.documents.map((d) => <Pill key={d.name}><FileText size={12} />{d.name}</Pill>)}
              </div>
            )}
          </Card>

          {wo.fault && (
            <Card title={<span className="flex items-center gap-2"><AlertTriangle size={15} className="text-rose-600" />Fault report</span>}>
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <KV k="Reported by" v={userById(db, wo.requestedById)?.name} />
                <KV k="Reported at" v={fmtDateTime(wo.fault.reportedAt)} />
                <KV k="Equipment operational" v={wo.fault.equipmentOperational ? 'Yes' : <span className="text-rose-700">No</span>} />
                <KV k="Guest impact" v={wo.fault.guestImpact ? <span className="text-orange-700">Yes</span> : 'No'} />
                <KV k="Safety concern" v={wo.fault.safetyConcern ? <span className="text-rose-700">Yes</span> : 'No'} />
                <KV k="Response target" v={fmtDateTime(wo.dueAt)} />
              </dl>
              {wo.fault.immediateAction && <p className="mt-3 text-sm text-ink-700"><b>Immediate action:</b> {wo.fault.immediateAction}</p>}
              {wo.fault.photos.length > 0 && <div className="mt-3"><PhotoGrid photos={wo.fault.photos} /></div>}
            </Card>
          )}

          {(subs.length > 0 || reviews.length > 0) && (
            <Card title={`Submissions & reviews (${subs.length} version${subs.length === 1 ? '' : 's'})`}>
              {subs.length > 1 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {subs.map((s) => (
                    <button key={s.id} onClick={() => setOpenVersion(s.version)} className={cx('rounded-full px-3 py-1 text-sm ring-1', shownVersion === s.version ? 'bg-forest-800 text-white ring-forest-800' : 'bg-white text-ink-700 ring-ivory-300')}>
                      v{s.version}{s.version === subs.length ? ' (latest)' : ''}
                    </button>
                  ))}
                </div>
              )}
              {subs.filter((s) => s.version === shownVersion).map((s) => (
                <div key={s.id} className="space-y-3">
                  <SubmissionView db={db} sub={s} />
                  {reviews.filter((r) => r.submissionId === s.id).map((r) => <ReviewNote key={r.id} db={db} r={r} />)}
                </div>
              ))}
              <p className="mt-4 text-xs text-ink-500">Submissions are immutable — every resubmission is stored as a new version alongside the original.</p>
            </Card>
          )}

          {wo.draft && isAssignee && wo.status === 'in_progress' && (
            <div className="rounded-xl border border-dashed border-ivory-300 bg-white p-4 text-sm text-ink-600">Draft saved {fmtDateTime(wo.draft.savedAt)} — not yet submitted. <Link to={`/work-orders/${wo.id}/execute`} className="font-medium text-forest-700 hover:underline">Continue →</Link></div>
          )}

          <Card title={<span className="flex items-center gap-2"><MessageSquare size={15} />Discussion</span>}>
            <div className="space-y-3">
              {comments.length === 0 && <div className="text-sm text-ink-500">No comments yet.</div>}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar name={userById(db, c.userId)?.name} size={30} />
                  <div className="min-w-0 flex-1 rounded-lg bg-ivory-50 px-3 py-2 ring-1 ring-ivory-200">
                    <div className="text-xs text-ink-500"><b className="text-ink-800">{userById(db, c.userId)?.name}</b> · {fmtDateTime(c.at)}</div>
                    <div className="mt-0.5 text-sm text-ink-800">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            {!['closed', 'cancelled'].includes(wo.status) && (
              <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (attempt(() => addComment(user, wo.id, comment))) setComment(''); }}>
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note for the team…" />
                <Button variant="primary" disabled={!comment.trim()}>Post</Button>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Assignment">
            <People db={db} wo={wo} />
          </Card>
          <Card title="Schedule & time">
            <dl>
              <KV k="Scheduled" v={fmtDateTime(wo.scheduledFor)} />
              <KV k="Due" v={<span className={isOverdue(wo) ? 'text-rose-700' : ''}>{fmtDateTime(wo.dueAt)}</span>} />
              <KV k="Started" v={fmtDateTime(wo.startedAt)} />
              <KV k="Submitted" v={fmtDateTime(wo.submittedAt)} />
              <KV k="Approved" v={fmtDateTime(wo.completedAt)} />
              {wo.returnedToServiceAt && <KV k="Returned to service" v={fmtDateTime(wo.returnedToServiceAt)} />}
              <KV k="Closed" v={fmtDateTime(wo.closedAt)} />
              {wo.source === 'fault' && <KV k="Downtime" v={wo.fault?.equipmentOperational ? 'Not down' : fmtDuration(durationMin(wo.createdAt, wo.returnedToServiceAt ?? nowIso()))} />}
              <KV k="Approval required" v={wo.requiresApproval ? 'Yes' : 'No'} />
              {wo.planId && <KV k="Source" v={<Link to="/schedules" className="text-forest-700 hover:underline">{db.plans.find((p) => p.id === wo.planId)?.name}</Link>} />}
            </dl>
          </Card>
          {asset && (
            <Card title="Equipment">
              <Link to={`/assets/${asset.id}`} className="block">
                <div className="font-medium text-ink-900">{asset.code} · {asset.name}</div>
                <div className="mt-1 text-xs text-ink-500">{asset.manufacturer} {asset.model} · S/N {asset.serial}</div>
                <div className="mt-2"><ConditionBadge c={asset.condition} /></div>
              </Link>
            </Card>
          )}
          <Card title="Activity timeline"><Timeline db={db} events={events} /></Card>
        </div>
      </div>

      <WOModals kind={modal} close={() => setModal(null)} db={db} wo={wo} user={user} />
    </div>
  );
}

function People({ db, wo }: { db: Db; wo: WorkOrder }) {
  const Row = ({ id, label }: { id?: string; label: string }) => {
    const u = userById(db, id);
    return (
      <div className="flex items-center gap-3 py-1.5">
        <Avatar name={u?.name ?? '?'} size={30} />
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-medium text-ink-900">{u?.name ?? <span className="text-rose-700">Unassigned</span>}</div>
          <div className="text-xs text-ink-500">{label}{u ? ` · ${u.designation}` : ''}</div>
        </div>
      </div>
    );
  };
  return (
    <div>
      <Row id={wo.leadTechId} label="Lead technician (accountable)" />
      {wo.helperIds.map((h) => <Row key={h} id={h} label="Supporting technician" />)}
      <div className="my-2 border-t border-ivory-200" />
      <Row id={wo.supervisorId} label="Supervisor / reviewer" />
      <Row id={wo.requestedById} label="Requested by" />
    </div>
  );
}

function TechPicker({ db, lead, setLead, helpers, setHelpers }: { db: Db; lead: string; setLead: (v: string) => void; helpers: string[]; setHelpers: (v: string[]) => void }) {
  const techs = db.users.filter((u) => u.role === 'technician');
  const load = (id: string) => db.workOrders.filter((w) => (w.leadTechId === id || w.helperIds.includes(id)) && ['assigned', 'in_progress', 'rework', 'on_hold'].includes(w.status)).length;
  return (
    <>
      <Field label="Lead technician" required>
        <Select value={lead} onChange={(e) => setLead(e.target.value)}>
          <option value="">Select…</option>
          {techs.map((t) => (
            <option key={t.id} value={t.id} disabled={t.status !== 'active'}>
              {t.name}{t.skills.length ? ` — ${t.skills.join(', ')}` : ''} · {load(t.id)} open{t.status !== 'active' ? ' (unavailable)' : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Supporting technicians" hint="Optional — for multi-technician jobs">
        <div className="flex flex-wrap gap-2">
          {techs.filter((t) => t.id !== lead && t.status === 'active').map((t) => {
            const on = helpers.includes(t.id);
            return (
              <button type="button" key={t.id} onClick={() => setHelpers(on ? helpers.filter((h) => h !== t.id) : [...helpers, t.id])} className={cx('rounded-full px-3 py-1 text-sm ring-1', on ? 'bg-forest-800 text-white ring-forest-800' : 'bg-white text-ink-700 ring-ivory-300')}>
                {t.name}
              </button>
            );
          })}
        </div>
      </Field>
    </>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5 * 3600_000);
  return d.toISOString().slice(0, 16);
}
function fromLocalInput(v: string) {
  return new Date(`${v}:00+05:00`).toISOString();
}

function WOModals({ kind, close, db, wo, user }: { kind: ModalKind; close: () => void; db: Db; wo: WorkOrder; user: User }) {
  const [text, setText] = useState('');
  const [lead, setLead] = useState(wo.leadTechId ?? '');
  const [helpers, setHelpers] = useState<string[]>(wo.helperIds);
  const [priority, setPriority] = useState<Priority>(wo.priority);
  const [due, setDue] = useState(toLocalInput(wo.status === 'triage' ? addHours(nowIso(), { critical: 2, high: 6, medium: 24, low: 72 }[wo.priority]) : wo.dueAt));
  const done = (ok: boolean) => {
    if (ok) {
      setText('');
      close();
    }
  };
  const footer = (label: string, fn: () => unknown, msg: string, variant: 'primary' | 'danger' | 'success' | 'gold' = 'primary') => (
    <>
      <Button onClick={close}>Cancel</Button>
      <Button variant={variant} onClick={() => done(attempt(fn, msg))}>{label}</Button>
    </>
  );
  return (
    <>
      <Modal open={kind === 'triage'} onClose={close} title="Triage & dispatch" footer={footer('Assign & notify', () => triageAndAssign(user, wo.id, { priority, leadTechId: lead, helperIds: helpers, dueAt: fromLocalInput(due), note: text }), 'Technician dispatched and notified')}>
        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {['critical', 'high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </Select>
        </Field>
        <TechPicker db={db} lead={lead} setLead={setLead} helpers={helpers} setHelpers={setHelpers} />
        <Field label="Response deadline"><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Field label="Triage note"><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Guest-facing — fix before 2pm check-in" /></Field>
      </Modal>
      <Modal open={kind === 'reassign'} onClose={close} title="Reassign work" footer={footer('Reassign', () => reassign(user, wo.id, lead, helpers, text), 'Work reassigned')}>
        <TechPicker db={db} lead={lead} setLead={setLead} helpers={helpers} setHelpers={setHelpers} />
        <Field label="Reason" required><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Recorded in the audit trail" /></Field>
      </Modal>
      <Modal open={kind === 'hold'} onClose={close} title="Put work on hold" footer={footer('Put on hold', () => holdWork(user, wo.id, text), 'Work placed on hold')}>
        <div className="flex flex-wrap gap-2">
          {['Awaiting parts: ', 'Awaiting access to area', 'Awaiting contractor', 'Shift ended — to continue next shift'].map((s) => <button type="button" key={s} onClick={() => setText(s)} className="rounded-full bg-ivory-200 px-3 py-1 text-sm text-ink-700 hover:bg-ivory-300">{s.replace(': ', '')}</button>)}
        </div>
        <Field label="Reason" required><Textarea value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </Modal>
      <Modal open={kind === 'cancel'} onClose={close} title="Cancel work order" footer={footer('Cancel work order', () => cancelWO(user, wo.id, text), 'Work order cancelled', 'danger')}>
        {wo.priority === 'critical' && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">This is critical work. Only the Chief Engineer can cancel it.</p>}
        <Field label="Justification" required><Textarea value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </Modal>
      <Modal open={kind === 'escalate'} onClose={close} title="Escalate to Chief Engineer" footer={footer('Escalate', () => escalate(user, wo.id, text), 'Escalated — Chief Engineer notified', 'danger')}>
        <Field label="Reason" required><Textarea value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </Modal>
      <Modal open={kind === 'close'} onClose={close} title="Close work order" footer={footer('Close', () => closeWO(user, wo.id, text), 'Work order closed')}>
        {wo.source === 'fault' && !wo.requesterConfirmation && <p className="text-sm text-ink-600">The requester has not yet confirmed the fix. Closing without confirmation requires a reason.</p>}
        <Field label="Closing note"><Textarea value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </Modal>
      <Modal open={kind === 'rts'} onClose={close} title="Return equipment to service" footer={footer('Confirm fit for service', () => returnToService(user, wo.id, text), 'Equipment returned to service', 'success')}>
        <p className="text-sm text-ink-600">Confirm that <b>{assetById(db, wo.assetId)?.code}</b> has been tested and verified safe to operate. This is recorded separately from closing the work order.</p>
        <Field label="Verification note"><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Ran for 30 min, holding −18 °C" /></Field>
      </Modal>
      <Modal open={kind === 'confirm'} onClose={close} title="Confirm the issue is resolved" footer={footer('Confirm resolved', () => confirmResolution(user, wo.id, true, text), 'Thank you — request closed', 'success')}>
        <Field label="Comment (optional)"><Textarea value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </Modal>
      <Modal open={kind === 'reopen'} onClose={close} title="Report that the issue persists" footer={footer('Reopen request', () => confirmResolution(user, wo.id, false, text), 'Request reopened — engineering notified', 'danger')}>
        <Field label="What is still wrong?" required><Textarea value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </Modal>
    </>
  );
}

export { Wrench, PowerOff };
