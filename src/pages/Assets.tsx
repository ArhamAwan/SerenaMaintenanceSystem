import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { createAsset, locationPath, useCurrentUser, useDb, userById } from '../lib/store';
import { can } from '../lib/permissions';
import { CRIT_META } from '../lib/meta';
import { attempt, Button, ConditionBadge, cx, EmptyState, Field, Input, Modal, PageHeader, Select, Unauthorized } from '../components/ui';
import { demoPhoto } from '../lib/photos';
import { fmtDate } from '../lib/time';
import type { Criticality } from '../lib/types';

export default function Assets() {
  const user = useCurrentUser()!;
  const db = useDb();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const cond = sp.get('cond') ?? '';
  const [adding, setAdding] = useState(false);
  const cats = Array.from(new Set(db.assets.map((a) => a.category))).sort();

  const rows = useMemo(() => {
    let r = db.assets;
    if (cat) r = r.filter((a) => a.category === cat);
    if (cond === 'down') r = r.filter((a) => a.condition === 'out_of_service' || a.condition === 'faulty');
    else if (cond) r = r.filter((a) => a.condition === cond);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((a) => [a.code, a.name, a.serial, a.manufacturer, a.model].join(' ').toLowerCase().includes(s));
    }
    return r;
  }, [db, q, cat, cond]);

  if (!can(user, 'asset.view')) return <Unauthorized />;

  const nextDue = (assetId: string) => {
    const open = db.workOrders.filter((w) => w.assetId === assetId && ['assigned', 'in_progress', 'rework', 'triage', 'on_hold'].includes(w.status)).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
    return open;
  };
  const lastService = (assetId: string) => db.workOrders.filter((w) => w.assetId === assetId && w.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0];

  return (
    <div>
      <PageHeader title={<>Assets &amp; <em>machinery</em></>} subtitle={`${db.assets.length} registered assets · ${db.property.name}`} actions={can(user, 'asset.manage') && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />Register asset</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="relative col-span-2">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search asset ID, name, serial, model…" className="pl-9" />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select value={cond} onChange={(e) => setSp(e.target.value ? { cond: e.target.value } : {})}>
          <option value="">Any condition</option><option value="operational">Operational</option><option value="degraded">Degraded</option><option value="down">Faulty / out of service</option>
        </Select>
      </div>
      {db.assets.length === 0 ? <EmptyState title="No machines registered yet" body="Register your first asset — a generator, chiller, pump or guest-room unit. Each gets a QR label and a full maintenance history." action={can(user, 'asset.manage') ? <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />Register first asset</Button> : undefined} /> : rows.length === 0 ? <EmptyState title="No assets found" body="Try a different search." /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((a) => {
            const nd = nextDue(a.id);
            const ls = lastService(a.id);
            return (
              <button key={a.id} onClick={() => nav(`/assets/${a.id}`)} className="group flex overflow-hidden rounded-xl border border-ivory-300/80 bg-white text-left shadow-card transition hover:border-gold-300">
                <img src={demoPhoto(a.code, a.category.length * 23, a.code.charCodeAt(0) % 4)} alt="" className="h-auto w-28 shrink-0 object-cover" />
                <div className="min-w-0 flex-1 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold tracking-wide text-gold-700">{a.code}</div>
                      <div className="truncate font-medium text-ink-900">{a.name}</div>
                    </div>
                    <span className={cx('text-[10px] font-bold uppercase', CRIT_META[a.criticality].cls)}>{a.criticality}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-500">{locationPath(db, a.locationId)}</div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2"><ConditionBadge c={a.condition} /></div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-ink-500">
                    <span>Last: <b className="font-medium text-ink-700">{ls ? fmtDate(ls.completedAt) : '—'}</b></span>
                    <span>Next: <b className="font-medium text-ink-700">{nd ? fmtDate(nd.dueAt) : '—'}</b></span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <AddAsset open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddAsset({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser()!;
  const db = useDb();
  const nav = useNavigate();
  const [f, setF] = useState({ code: '', name: '', category: 'Generators', manufacturer: '', model: '', serial: '', locationId: db.locations.find((l) => l.type !== 'property')?.id ?? '', departmentId: db.departments.find((d) => d.isEngineering)?.id ?? db.departments[0]?.id ?? '', supervisorId: db.users.find((u) => u.role === 'supervisor' && u.status === 'active')?.id ?? db.users.find((u) => u.role === 'manager')?.id ?? '', installDate: '', warrantyUntil: '', vendor: '', criticality: 'medium' as Criticality });
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    let id = '';
    const ok = attempt(() => { id = createAsset(user, { ...f, condition: 'operational' }).id; }, `Asset ${f.code.toUpperCase()} registered — QR code generated`);
    if (ok) { onClose(); nav(`/assets/${id}`); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Register asset" wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Register</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Asset ID" required hint="e.g. AHU-003"><Input value={f.code} onChange={(e) => up('code', e.target.value)} /></Field>
        <Field label="Asset name" required><Input value={f.name} onChange={(e) => up('name', e.target.value)} /></Field>
        <Field label="Category"><Input list="cats" value={f.category} onChange={(e) => up('category', e.target.value)} /><datalist id="cats">{Array.from(new Set(db.assets.map((a) => a.category))).map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Criticality"><Select value={f.criticality} onChange={(e) => up('criticality', e.target.value)}>{['low', 'medium', 'high', 'critical'].map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
        <Field label="Manufacturer"><Input value={f.manufacturer} onChange={(e) => up('manufacturer', e.target.value)} /></Field>
        <Field label="Model"><Input value={f.model} onChange={(e) => up('model', e.target.value)} /></Field>
        <Field label="Serial number"><Input value={f.serial} onChange={(e) => up('serial', e.target.value)} /></Field>
        <Field label="Vendor / supplier"><Input value={f.vendor} onChange={(e) => up('vendor', e.target.value)} /></Field>
        <Field label="Location" required hint={db.locations.length <= 1 ? 'Add locations first (Locations page)' : undefined}><Select value={f.locationId} onChange={(e) => up('locationId', e.target.value)}><option value="">Select…</option>{db.locations.filter((l) => l.type !== 'property').map((l) => <option key={l.id} value={l.id}>{locationPath(db, l.id)}</option>)}</Select></Field>
        <Field label="Department"><Select value={f.departmentId} onChange={(e) => up('departmentId', e.target.value)}><option value="">— None —</option>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="Responsible supervisor"><Select value={f.supervisorId} onChange={(e) => up('supervisorId', e.target.value)}><option value="">— Not set —</option>{db.users.filter((u) => u.role === 'supervisor' || u.role === 'manager').map((u) => <option key={u.id} value={u.id}>{userById(db, u.id)?.name}</option>)}</Select></Field>
        <Field label="Installation date"><Input type="date" value={f.installDate} onChange={(e) => up('installDate', e.target.value)} /></Field>
        <Field label="Warranty expiry"><Input type="date" value={f.warrantyUntil} onChange={(e) => up('warrantyUntil', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
