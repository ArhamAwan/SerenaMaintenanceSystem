import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, ChevronRight, DoorOpen, Layers, MapPin } from 'lucide-react';
import { createLocation, locationPath, useCurrentUser, useDb, userById } from '../lib/store';
import { can } from '../lib/permissions';
import { attempt, Button, Card, ConditionBadge, cx, Field, Input, Modal, PageHeader, Select, Unauthorized } from '../components/ui';
import { Plus } from 'lucide-react';
import { WOTable } from '../components/wo';
import type { Location } from '../lib/types';

const ICON = { property: Building2, building: Building2, floor: Layers, area: MapPin, room: DoorOpen };

export default function Locations() {
  const user = useCurrentUser()!;
  const db = useDb();
  const [sp] = useSearchParams();
  const [sel, setSel] = useState(sp.get('l') ?? (db.locations.some((l) => l.id === 'loc-bsmt') ? 'loc-bsmt' : db.locations[0]?.id ?? ''));
  const [adding, setAdding] = useState(false);
  const [nl, setNl] = useState({ name: '', type: 'area' as Location['type'], parentId: '' });
  if (!can(user, 'asset.view')) return <Unauthorized />;
  const descendants = (id: string): string[] => [id, ...db.locations.filter((l) => l.parentId === id).flatMap((l) => descendants(l.id))];
  const ids = descendants(sel);
  const loc = db.locations.find((l) => l.id === sel);
  const assets = db.assets.filter((a) => ids.includes(a.locationId));
  const open = db.workOrders.filter((w) => ids.includes(w.locationId) && !['closed', 'cancelled'].includes(w.status));

  const Node = ({ l, depth }: { l: Location; depth: number }) => {
    const Icon = ICON[l.type];
    const kids = db.locations.filter((c) => c.parentId === l.id);
    const n = db.assets.filter((a) => descendants(l.id).includes(a.locationId)).length;
    return (
      <>
        <button onClick={() => setSel(l.id)} className={cx('flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm', sel === l.id ? 'bg-forest-800 text-white' : 'text-ink-800 hover:bg-ivory-200')} style={{ paddingLeft: 8 + depth * 16 }}>
          {kids.length ? <ChevronRight size={13} className="opacity-50" /> : <span className="w-[13px]" />}
          <Icon size={15} className={sel === l.id ? 'text-gold-300' : 'text-gold-600'} />
          <span className="flex-1 truncate">{l.name}</span>
          {n > 0 && <span className={cx('text-xs', sel === l.id ? 'text-ivory-200' : 'text-ink-400')}>{n}</span>}
        </button>
        {kids.map((k) => <Node key={k.id} l={k} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <div>
      <PageHeader title={<>Locations &amp; <em>zones</em></>} subtitle="Property → building → floor → area → equipment" actions={can(user, 'asset.manage') && <Button variant="primary" onClick={() => { setNl({ name: '', type: loc?.type === 'property' ? 'building' : loc?.type === 'building' ? 'floor' : loc?.type === 'floor' ? 'area' : 'room', parentId: sel }); setAdding(true); }}><Plus size={16} />Add location</Button>} />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card pad={false}><div className="p-2">{db.locations.filter((l) => !l.parentId).map((l) => <Node key={l.id} l={l} depth={0} />)}</div></Card>
        <div className="space-y-6">
          <Card title={loc?.name}>
            <div className="mb-3 text-sm text-ink-500 capitalize">{loc?.type} · {assets.length} assets · {open.length} open work orders · responsible: {[...new Set(assets.map((a) => userById(db, a.supervisorId)?.name).filter(Boolean))].join(', ') || '—'}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {assets.map((a) => (
                <Link key={a.id} to={`/assets/${a.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-ivory-200 px-3 py-2 hover:bg-ivory-50">
                  <span className="min-w-0"><span className="block text-sm font-medium text-ink-900">{a.code}</span><span className="block truncate text-xs text-ink-500">{a.name}</span></span>
                  <ConditionBadge c={a.condition} />
                </Link>
              ))}
              {!assets.length && <div className="text-sm text-ink-500">No equipment registered here.</div>}
            </div>
            <p className="mt-3 text-xs text-ink-500">Floor-plan upload per zone is planned for a later phase.</p>
          </Card>
        </div>
      </div>
      <div className="mt-8"><h3 className="mb-3 font-serif text-[30px] leading-tight text-forest-900">Open work in <em>{loc?.name}</em></h3><WOTable db={db} rows={open} empty="No open work in this area." /></div>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add location" footer={<><Button onClick={() => setAdding(false)}>Cancel</Button><Button variant="primary" onClick={() => { let id = ''; if (attempt(() => { id = createLocation(user, nl).id; }, `${nl.name} added`)) { setAdding(false); setSel(id); } }}>Add</Button></>}>
        <Field label="Inside" required><Select value={nl.parentId} onChange={(e) => setNl((x) => ({ ...x, parentId: e.target.value }))}>{db.locations.map((l) => <option key={l.id} value={l.id}>{l.type === 'property' ? l.name : locationPath(db, l.id)}</option>)}</Select></Field>
        <Field label="Name" required><Input value={nl.name} onChange={(e) => setNl((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Generator Hall, Third Floor, Room 305" /></Field>
        <Field label="Type"><Select value={nl.type} onChange={(e) => setNl((x) => ({ ...x, type: e.target.value as Location['type'] }))}><option value="building">Building / wing</option><option value="floor">Floor</option><option value="area">Area (plant room, kitchen, laundry…)</option><option value="room">Room</option></Select></Field>
      </Modal>
    </div>
  );
}
