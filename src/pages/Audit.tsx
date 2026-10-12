import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useCurrentUser, useDb, userById } from '../lib/store';
import { can } from '../lib/permissions';
import { Input, PageHeader, Select, Unauthorized } from '../components/ui';
import { fmtDateTime } from '../lib/time';

export default function Audit() {
  const user = useCurrentUser()!;
  const db = useDb();
  const [q, setQ] = useState('');
  const [actor, setActor] = useState('');
  const [entity, setEntity] = useState('');
  if (!can(user, 'audit.view')) return <Unauthorized />;
  const rows = db.audit
    .filter((e) => (!actor || e.actorId === actor) && (!entity || e.entity === entity))
    .filter((e) => {
      if (!q.trim()) return true;
      const wo = db.workOrders.find((w) => w.id === e.entityId);
      return [e.action, e.reason, e.from, e.to, wo?.number, wo?.title].join(' ').toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 300);
  const label = (e: (typeof rows)[number]) => {
    if (e.entity === 'work_order') { const w = db.workOrders.find((x) => x.id === e.entityId); return w ? <Link to={`/work-orders/${w.id}`} className="text-forest-700 hover:underline">{w.number}</Link> : e.entityId; }
    if (e.entity === 'asset') { const a = db.assets.find((x) => x.id === e.entityId); return a ? <Link to={`/assets/${a.id}`} className="text-forest-700 hover:underline">{a.code}</Link> : e.entityId; }
    if (e.entity === 'user') return userById(db, e.entityId)?.name ?? e.entityId;
    if (e.entity === 'plan') return db.plans.find((p) => p.id === e.entityId)?.name ?? e.entityId;
    if (e.entity === 'template') return db.templates.find((t) => t.id === e.entityId)?.name ?? e.entityId;
    return e.entityId;
  };
  return (
    <div>
      <PageHeader title={<>Audit <em>log</em></>} subtitle={<span className="inline-flex items-center gap-1.5"><Lock size={13} />Append-only. Records cannot be edited or deleted by any user.</span>} />
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, reason, work order…" />
        <Select value={actor} onChange={(e) => setActor(e.target.value)}><option value="">All actors</option><option value="system">System scheduler</option>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        <Select value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">All records</option>{['work_order', 'asset', 'plan', 'template', 'user', 'system'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</Select>
      </div>
      <div className="overflow-x-auto rounded-[20px] border border-ivory-200 bg-white shadow-card">
        <table className="tbl">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Record</th><th>Change</th><th>Reason</th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap text-xs text-ink-600">{fmtDateTime(e.at)}</td>
                <td className="whitespace-nowrap">{e.actorId === 'system' ? <span className="text-ink-500">System</span> : userById(db, e.actorId)?.name}</td>
                <td className="font-medium text-ink-900">{e.action}</td>
                <td className="whitespace-nowrap">{label(e)}</td>
                <td className="whitespace-nowrap text-xs text-ink-600">{e.from ? `${e.from} → ${e.to}` : e.to ?? ''}</td>
                <td className="max-w-xs truncate text-xs text-ink-600" title={e.reason}>{e.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
