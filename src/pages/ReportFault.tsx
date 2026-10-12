import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, PhoneCall, Siren, Trash2 } from 'lucide-react';
import { locationPath, reportFault, useCurrentUser, useDb } from '../lib/store';
import { can } from '../lib/permissions';
import { compressImage, makePhoto } from '../lib/photos';
import { attempt, Button, Card, cx, Field, Input, PageHeader, Segmented, Select, Textarea, toast, Unauthorized } from '../components/ui';
import type { Photo, Priority, WorkOrder } from '../lib/types';

export default function ReportFault() {
  const user = useCurrentUser()!;
  const db = useDb();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [assetId, setAssetId] = useState(sp.get('asset') ?? '');
  const [locationId, setLocationId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Priority>('medium');
  const [operational, setOperational] = useState<'Yes' | 'No' | ''>('');
  const [guest, setGuest] = useState<'Yes' | 'No' | ''>('');
  const [safety, setSafety] = useState<'Yes' | 'No' | ''>('No');
  const [action, setAction] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!can(user, 'fault.report')) return <Unauthorized />;

  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      try {
        const d = await compressImage(f);
        setPhotos((p) => [...p, makePhoto(d, user.id, 'defect', 'Fault photo')]);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not add photo', 'error');
      }
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!assetId && !locationId) errs.push('where');
    if (!title.trim()) errs.push('title');
    if (!operational) errs.push('operational');
    if (!guest) errs.push('guest');
    setErrors(errs);
    if (errs.length) return toast('Please fill in the highlighted fields.', 'error');
    let wo: WorkOrder | undefined;
    const ok = attempt(() => {
      wo = reportFault(user, { title, description, assetId: assetId || undefined, locationId: locationId || undefined, severity, guestImpact: guest === 'Yes', equipmentOperational: operational === 'Yes', safetyConcern: safety === 'Yes', immediateAction: action, photos });
    });
    if (ok && wo) {
      toast(`${wo.number} logged — ${wo.type === 'emergency' ? 'engineering supervisor and Chief Engineer alerted' : 'engineering supervisor notified'}`);
      nav(`/work-orders/${wo.id}`);
    }
  };

  const err = (k: string) => errors.includes(k);
  const assetsInLoc = db.assets;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Engineering request" title={<>Report a <em>fault</em></>} subtitle="Tell engineering what is wrong. You'll be able to track progress and confirm the fix." />
      <div className="mb-5 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <PhoneCall size={18} className="mt-0.5 shrink-0" />
        <span>For fire, injury, gas smell or anything life-threatening, follow the hotel emergency procedure and call the duty engineer / security control room immediately. This form does not replace on-site emergency procedures.</span>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <Card title="Where is the problem?">
          <div className="space-y-4">
            <Field label="Equipment" hint="Choose the machine if you know it" error={err('where') ? 'Choose equipment or a location' : undefined}>
              <Select value={assetId} onChange={(e) => { setAssetId(e.target.value); if (e.target.value) setLocationId(''); }} className={cx(err('where') && 'ring-rose-400')}>
                <option value="">— Not sure / general facility —</option>
                {assetsInLoc.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name} — {locationPath(db, a.locationId).split(' › ').slice(-1)[0]}</option>)}
              </Select>
            </Field>
            {!assetId && (
              <Field label="Location" error={err('where') ? 'Choose equipment or a location' : undefined}>
                <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">Select location…</option>
                  {db.locations.filter((l) => l.type !== 'property').map((l) => <option key={l.id} value={l.id}>{locationPath(db, l.id)}</option>)}
                </Select>
              </Field>
            )}
          </div>
        </Card>
        <Card title="What is wrong?">
          <div className="space-y-4">
            <Field label="Short title" required error={err('title') ? 'Please describe the problem' : undefined}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AC not cooling in Room 305" /></Field>
            <Field label="Details"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you notice? Since when? Any sounds, smells, error codes?" /></Field>
            <Field label="How urgent is it?">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([['low', 'Low', 'Can wait'], ['medium', 'Medium', 'Today'], ['high', 'High', 'Within hours'], ['critical', 'Critical', 'Now']] as [Priority, string, string][]).map(([v, l, d]) => (
                  <button type="button" key={v} onClick={() => setSeverity(v)} className={cx('rounded-lg px-2 py-2.5 text-center ring-1 ring-inset transition', severity === v ? (v === 'critical' ? 'bg-rose-700 text-white ring-rose-700' : v === 'high' ? 'bg-orange-600 text-white ring-orange-600' : 'bg-forest-800 text-white ring-forest-800') : 'bg-white text-ink-700 ring-ivory-300')}>
                    <div className="text-sm font-semibold">{l}</div>
                    <div className="text-[11px] opacity-80">{d}</div>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Is the equipment still working?" required error={err('operational') ? 'Please choose' : undefined}><Segmented value={operational} onChange={setOperational} options={[{ value: 'Yes', label: 'Yes, partly' }, { value: 'No', label: 'No — stopped', tone: 'bad' }]} /></Field>
            <Field label="Are guests affected?" required error={err('guest') ? 'Please choose' : undefined}><Segmented value={guest} onChange={setGuest} options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes', tone: 'bad' }]} /></Field>
            <Field label="Any safety concern? (leak, sparks, smoke, exposed wiring)"><Segmented value={safety} onChange={setSafety} options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes', tone: 'bad' }]} /></Field>
            <Field label="Immediate action taken"><Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Guest moved to another room; area cordoned off" /></Field>
          </div>
        </Card>
        <Card title="Photos">
          {photos.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative overflow-hidden rounded-lg border border-ivory-300">
                  <img src={p.dataUrl} alt="" className="aspect-square w-full object-cover" />
                  <button type="button" onClick={() => setPhotos((x) => x.filter((y) => y.id !== p.id))} className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-forest-300 bg-forest-50 text-sm font-medium text-forest-800"><Camera size={18} />Add photo</button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </Card>
        <Button variant={severity === 'critical' || safety === 'Yes' ? 'danger' : 'primary'} size="lg" className={cx('w-full', (severity === 'critical' || safety === 'Yes') && '!bg-rose-700 !text-white')}><Siren size={18} />{severity === 'critical' || safety === 'Yes' ? 'Report emergency' : 'Submit fault report'}</Button>
      </form>
    </div>
  );
}
