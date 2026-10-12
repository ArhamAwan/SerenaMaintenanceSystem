import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, CloudOff, ImagePlus, Loader2, RotateCcw, Save, Send, ShieldAlert, Trash2, Wifi } from 'lucide-react';
import { assetById, evaluateFlags, isFieldVisible, locationPath, saveDraft, startWork, submissionsFor, submitWork, templateFields, useCurrentUser, useDb } from '../lib/store';
import { compressImage, makePhoto } from '../lib/photos';
import { attempt, Button, cx, EmptyState, Input, LinkButton, Modal, Segmented, Select, Textarea, toast } from '../components/ui';
import { FlagList } from '../components/wo';
import { PhotoGrid } from '../components/submission';
import { fmtTime, fmtDateTime } from '../lib/time';
import { rangeText } from '../lib/rules';
import type { AnswerValue, Photo, TemplateField } from '../lib/types';

export default function Execute() {
  const { id } = useParams();
  const db = useDb();
  const user = useCurrentUser()!;
  const nav = useNavigate();
  const wo = db.workOrders.find((w) => w.id === id);
  const subs = wo ? submissionsFor(db, wo.id) : [];
  const prev = subs[subs.length - 1];
  const lastReview = wo ? db.reviews.filter((r) => r.woId === wo.id).sort((a, b) => a.at.localeCompare(b.at)).slice(-1)[0] : undefined;

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => wo?.draft?.answers ?? (prev ? { ...prev.answers } : {}));
  const [photos, setPhotos] = useState<Photo[]>(() => wo?.draft?.photos ?? []);
  const [notes, setNotes] = useState(() => wo?.draft?.notes ?? '');
  const [parts, setParts] = useState(() => wo?.draft?.partsUsed ?? '');
  const [savedAt, setSavedAt] = useState<string | undefined>(wo?.draft?.savedAt);
  const [dirty, setDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [uploading, setUploading] = useState(0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Autosave draft (protects against interruptions)
  useEffect(() => {
    if (!dirty || !wo || wo.status !== 'in_progress') return;
    const t = setTimeout(() => {
      try {
        saveDraft(user, wo.id, { answers, photos, notes, partsUsed: parts });
        setSavedAt(new Date().toISOString());
        setDirty(false);
      } catch {
        /* ignore autosave errors */
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [answers, photos, notes, parts, dirty, wo, user]);

  const fields = useMemo(() => (wo ? templateFields(db, wo.templateId, wo.templateVersion) : []), [db, wo]);
  const flags = useMemo(() => evaluateFlags(fields, answers), [fields, answers]);

  if (!wo) return <EmptyState title="Work order not found" />;
  const isAssignee = wo.leadTechId === user.id || wo.helperIds.includes(user.id);
  if (!isAssignee) return <EmptyState title="Not assigned to you" body="Only assigned technicians can fill this report." action={<LinkButton to={`/work-orders/${wo.id}`}>View work order</LinkButton>} />;
  if (wo.status === 'assigned' || wo.status === 'rework') {
    return (
      <EmptyState
        title={wo.status === 'rework' ? 'Ready to start rework?' : 'Ready to start?'}
        body="Starting records your start time for this job."
        action={<Button variant="primary" size="lg" onClick={() => attempt(() => startWork(user, wo.id))}>Start now</Button>}
      />
    );
  }
  if (wo.status !== 'in_progress') return <EmptyState title="This report can't be edited" body={`Status: ${wo.status.replace('_', ' ')}`} action={<LinkButton to={`/work-orders/${wo.id}`}>View work order</LinkButton>} />;

  const asset = assetById(db, wo.assetId);
  const set = (fid: string, v: AnswerValue) => {
    setAnswers((a) => ({ ...a, [fid]: v }));
    setDirty(true);
  };
  const visible = fields.filter((f) => isFieldVisible(f, answers));
  const missing = visible.filter((f) => f.required && (f.type === 'photo' ? !photos.some((p) => p.fieldId === f.id) : answers[f.id] === undefined || answers[f.id] === null || String(answers[f.id]).trim() === ''));
  const progress = visible.length ? Math.round(((visible.length - missing.length) / visible.length) * 100) : 100;

  const addPhotos = async (files: FileList | null, fieldId: string | undefined, stage: Photo['stage'], caption: string) => {
    if (!files?.length) return;
    setUploading((n) => n + files.length);
    for (const f of Array.from(files)) {
      try {
        const data = await compressImage(f);
        setPhotos((p) => [...p, makePhoto(data, user.id, stage, caption, fieldId)]);
        setDirty(true);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Upload failed — please try again.', 'error');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const doSubmit = () => {
    const ok = attempt(() => submitWork(user, wo.id, { answers, photos, notes, partsUsed: parts }));
    if (ok) {
      toast(wo.requiresApproval ? 'Submitted — your supervisor has been notified.' : 'Completed and recorded.');
      nav(`/work-orders/${wo.id}`);
    } else setConfirm(false);
  };

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <Link to={`/work-orders/${wo.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-500"><ArrowLeft size={15} />Work order</Link>
      <div className="grain overflow-hidden rounded-[28px] p-5 text-ivory-50 shadow-lift sm:p-6" style={{ backgroundColor: '#133426', backgroundImage: 'radial-gradient(100% 90% at 100% 0%, rgba(201,164,100,.30) 0%, rgba(201,164,100,0) 55%), var(--grain)' }}>
        <div className="text-xs uppercase tracking-[0.14em] text-gold-300">{wo.number} · {prev ? `Revision v${prev.version + 1}` : 'Report'}</div>
        <h1 className="mt-1 font-serif text-[30px] leading-tight">{wo.title}</h1>
        {asset && <div className="mt-1 text-sm text-ivory-200/80">{asset.code} · {asset.name} · {locationPath(db, asset.locationId)}</div>}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-forest-700"><div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${progress}%` }} /></div>
          <span className="text-xs tabular-nums text-ivory-200">{progress}%</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-ivory-200/80">
          {online ? <span className="flex items-center gap-1"><Wifi size={12} />Online</span> : <span className="flex items-center gap-1 text-gold-300"><CloudOff size={12} />Offline — draft kept on this device</span>}
          <span>·</span>
          <span>{dirty ? 'Saving…' : savedAt ? `Draft saved ${fmtTime(savedAt)}` : 'Not saved yet'}</span>
        </div>
      </div>

      {lastReview && lastReview.decision !== 'approved' && (
        <div className="mt-4 rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-900"><RotateCcw size={15} />Supervisor's instructions</div>
          <p className="mt-1 text-[15px] text-orange-950">“{lastReview.comment}”</p>
          <div className="mt-1 text-xs text-orange-800">{fmtDateTime(lastReview.at)} · your previous answers are pre-filled. Add new photos as evidence.</div>
          {prev && prev.photos.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-orange-900">Photos from v{prev.version}</summary>
              <div className="mt-2"><PhotoGrid photos={prev.photos} /></div>
            </details>
          )}
        </div>
      )}

      {wo.safety && <div className="mt-4 flex gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-100"><ShieldAlert size={16} className="mt-0.5 shrink-0" />{wo.safety}</div>}

      <div className="mt-4 space-y-3">
        {visible.map((f, i) => (
          <FieldCard key={f.id} f={f} n={i + 1} value={answers[f.id]} onChange={(v) => set(f.id, v)} error={showErrors && missing.includes(f)} flag={flags.find((x) => x.fieldId === f.id)}>
            {f.type === 'photo' && (
              <PhotoField
                photos={photos.filter((p) => p.fieldId === f.id)}
                onAdd={(files) => addPhotos(files, f.id, /before/i.test(f.label) ? 'before' : /after/i.test(f.label) ? 'after' : /leak|defect/i.test(f.label) ? 'defect' : 'reading', f.label)}
                onRemove={(pid) => { setPhotos((p) => p.filter((x) => x.id !== pid)); setDirty(true); }}
              />
            )}
          </FieldCard>
        ))}

        <div className="rounded-[18px] border border-ivory-200 bg-white p-4">
          <div className="text-sm font-medium text-ink-900">Additional photos & notes</div>
          <div className="mt-3">
            <PhotoField photos={photos.filter((p) => !p.fieldId)} onAdd={(files) => addPhotos(files, undefined, 'general', 'Additional evidence')} onRemove={(pid) => { setPhotos((p) => p.filter((x) => x.id !== pid)); setDirty(true); }} />
          </div>
          <Textarea className="mt-3" value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} placeholder="Work notes, observations, anything the supervisor should know" />
          <Input className="mt-2" value={parts} onChange={(e) => { setParts(e.target.value); setDirty(true); }} placeholder="Parts / materials used (optional)" />
        </div>

        {flags.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-white p-4">
            <div className="mb-2 text-sm font-medium text-ink-900">Abnormal readings — your supervisor will be alerted</div>
            <FlagList flags={flags} />
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[78px] z-20 px-3 pb-2 lg:bottom-3 lg:pl-[17.5rem]">
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-[22px] border border-white/70 bg-ivory-50/80 p-2 shadow-lift backdrop-blur-xl">
          <Button size="lg" onClick={() => { attempt(() => saveDraft(user, wo.id, { answers, photos, notes, partsUsed: parts }), 'Draft saved'); setSavedAt(new Date().toISOString()); setDirty(false); }}><Save size={18} /><span className="hidden sm:inline">Save draft</span></Button>
          <Button
            size="lg"
            variant="primary"
            className="flex-1"
            disabled={uploading > 0}
            onClick={() => {
              if (missing.length) {
                setShowErrors(true);
                toast(`${missing.length} required item${missing.length > 1 ? 's' : ''} still to complete: ${missing.map((m) => m.label).join(', ')}`, 'error');
                document.getElementById(`f-${missing[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
              }
              if (!online) return toast('You are offline. Your draft is saved — submit when the connection is back.', 'error');
              setConfirm(true);
            }}
          >
            {uploading > 0 ? <><Loader2 size={18} className="animate-spin" />Processing photos…</> : <><Send size={18} />{wo.requiresApproval ? 'Submit for review' : 'Complete'}</>}
          </Button>
        </div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Submit this report?" footer={<><Button onClick={() => setConfirm(false)}>Keep editing</Button><Button variant="primary" onClick={doSubmit}><Send size={16} />Submit</Button></>}>
        <p className="text-sm text-ink-700">Once submitted, this version is locked and sent to <b>{db.users.find((u) => u.id === wo.supervisorId)?.name}</b> for review. Any correction will be saved as a new version.</p>
        <div className="flex gap-4 text-sm text-ink-600"><span>{visible.filter((f) => f.type !== 'photo').length} answers</span><span>{photos.length} photos</span></div>
        {flags.length > 0 ? <FlagList flags={flags} /> : <div className="flex items-center gap-2 text-sm text-forest-700"><CheckCircle2 size={16} />All readings within configured ranges</div>}
      </Modal>
    </div>
  );
}

function FieldCard({ f, n, value, onChange, error, flag, children }: { f: TemplateField; n: number; value: AnswerValue; onChange: (v: AnswerValue) => void; error: boolean; flag?: { level: 'warning' | 'critical' }; children?: React.ReactNode }) {
  return (
    <div id={`f-${f.id}`} className={cx('scroll-mt-28 rounded-[20px] border bg-white p-4 shadow-card transition duration-300', error ? 'border-rose-400 ring-4 ring-rose-100' : flag?.level === 'critical' ? 'border-rose-300 ring-4 ring-rose-100' : flag ? 'border-amber-300 ring-4 ring-amber-100/70' : 'border-ivory-200', f.showIf && 'ml-4 border-l-[3px] border-l-gold-400 bg-gold-50/30')}>
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="text-[15px] font-medium text-ink-900">
          <span className="mr-1.5 text-xs text-ink-400">{n}.</span>
          {f.label}
          {f.required && <span className="ml-0.5 text-rose-600">*</span>}
        </div>
        {flag && <span className={cx('flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', flag.level === 'critical' ? 'bg-rose-600 text-white' : 'bg-amber-200 text-amber-900')}><AlertTriangle size={11} />{flag.level}</span>}
      </div>
      {f.help && <div className="-mt-1.5 mb-2 text-xs text-ink-500">{f.help}</div>}
      {f.type === 'number' && (
        <div>
          <div className="relative">
            <Input type="number" inputMode="decimal" step="any" value={value === null || value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className="h-14 rounded-2xl pr-14 text-[22px] font-medium tabular-nums" placeholder="Enter reading" />
            {f.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-500">{f.unit}</span>}
          </div>
          {(f.normalMin !== undefined || f.normalMax !== undefined) && <Gauge f={f} value={value} />}
        </div>
      )}
      {f.type === 'yesno' && <Segmented value={(value as string) ?? ''} onChange={onChange} options={[{ value: 'No', label: 'No', tone: 'good' }, { value: 'Yes', label: 'Yes', tone: f.warnOptions?.includes('Yes') ? 'bad' : undefined }]} />}
      {f.type === 'passfail' && <Segmented value={(value as string) ?? ''} onChange={onChange} options={[{ value: 'Pass', label: 'Pass', tone: 'good' }, { value: 'Fail', label: 'Fail', tone: 'bad' }]} />}
      {f.type === 'select' && (f.options!.length <= 4 ? (
        <Segmented value={(value as string) ?? ''} onChange={onChange} options={f.options!.map((o) => ({ value: o, label: o, tone: f.critOptions?.includes(o) || f.warnOptions?.includes(o) ? 'bad' : undefined }))} />
      ) : (
        <Select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}><option value="">Select…</option>{f.options!.map((o) => <option key={o}>{o}</option>)}</Select>
      ))}
      {f.type === 'rating' && <Segmented value={value ? String(value) : ''} onChange={(v) => onChange(Number(v))} options={['1', '2', '3', '4', '5'].map((o) => ({ value: o, label: o }))} />}
      {f.type === 'text' && <Textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Type here" />}
      {children}
      {error && <div className="mt-2 text-sm font-medium text-rose-700">{f.type === 'photo' ? 'Please add a photo.' : 'This is required.'}</div>}
    </div>
  );
}

function PhotoField({ photos, onAdd, onRemove }: { photos: Photo[]; onAdd: (f: FileList | null) => void; onRemove: (id: string) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  return (
    <div>
      {photos.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-lg border border-ivory-300">
              <img src={p.dataUrl} alt="" className="aspect-square w-full object-cover" />
              <button type="button" onClick={() => onRemove(p.id)} className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white" aria-label="Remove photo"><Trash2 size={14} /></button>
              <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{fmtTime(p.at)}</div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => cam.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-forest-300 bg-forest-50 text-sm font-medium text-forest-800 active:bg-forest-100"><Camera size={18} />Take photo</button>
        <button type="button" onClick={() => lib.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ivory-300 bg-ivory-50 text-sm font-medium text-ink-700"><ImagePlus size={18} />From gallery</button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onAdd(e.target.files); e.target.value = ''; }} />
      <input ref={lib} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onAdd(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

/** Live threshold gauge: critical | warning | normal bands with a marker at the current reading. */
function Gauge({ f, value }: { f: TemplateField; value: AnswerValue }) {
  const nMin = f.normalMin;
  const nMax = f.normalMax;
  const lo = f.critMin ?? (nMin !== undefined ? nMin - Math.abs(nMin) * 0.3 : 0);
  const hi = f.critMax ?? (nMax !== undefined ? nMax + Math.abs(nMax) * 0.3 : (nMin ?? 0) * 2.5 || 100);
  const span = Math.max(1e-6, hi - lo);
  const pos = (x: number) => Math.max(0, Math.min(100, ((x - lo) / span) * 100));
  const a = nMin !== undefined ? pos(nMin) : 0;
  const b = nMax !== undefined ? pos(nMax) : 100;
  const has = value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value));
  const v = has ? pos(Number(value)) : null;
  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full" style={{ background: `linear-gradient(90deg, #E0705A 0%, #E3B04B ${Math.max(0, a - 6)}%, #6FC596 ${a}%, #6FC596 ${b}%, #E3B04B ${Math.min(100, b + 6)}%, #E0705A 100%)` }}>
        {v !== null && <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink-900 bg-white shadow transition-[left] duration-300" style={{ left: `${v}%` }} />}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-500">
        <span>{f.critMin ?? ''}</span>
        <span>normal {rangeText(f)}</span>
        <span>{f.critMax ?? ''}</span>
      </div>
    </div>
  );
}
