import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Plus, Search } from 'lucide-react';
import { assetById, isOverdue, locationPath, useCurrentUser, useDb, userById } from '../lib/store';
import { can, canViewWO } from '../lib/permissions';
import { Button, Input, LinkButton, PageHeader, Select, Tabs, Unauthorized } from '../components/ui';
import { WOTable } from '../components/wo';
import { STATUS_META, TYPE_LABEL } from '../lib/meta';
import { fmtDateTime } from '../lib/time';
import type { WOStatus } from '../lib/types';

type Group = 'open' | 'review' | 'done' | 'all';

export default function WorkOrders() {
  const user = useCurrentUser()!;
  const db = useDb();
  const [sp, setSp] = useSearchParams();
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };
  const status = sp.get('status') ?? '';
  const group = (sp.get('g') as Group) ?? (status ? 'all' : 'open');
  const type = sp.get('type') ?? '';
  const priority = sp.get('priority') ?? '';
  const tech = sp.get('tech') ?? '';
  const q = sp.get('q') ?? '';
  const overdueOnly = sp.get('overdue') === '1';

  const visible = useMemo(() => db.workOrders.filter((w) => canViewWO(user, w)), [db, user]);
  const rows = useMemo(() => {
    let r = visible;
    if (group === 'open') r = r.filter((w) => ['triage', 'assigned', 'in_progress', 'on_hold', 'rework'].includes(w.status));
    if (group === 'review') r = r.filter((w) => w.status === 'submitted');
    if (group === 'done') r = r.filter((w) => ['completed', 'closed', 'cancelled'].includes(w.status));
    if (status) r = r.filter((w) => w.status === status);
    if (type) r = r.filter((w) => w.type === type);
    if (priority) r = r.filter((w) => w.priority === priority);
    if (tech) r = r.filter((w) => w.leadTechId === tech || w.helperIds.includes(tech));
    if (overdueOnly) r = r.filter((w) => isOverdue(w));
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((w) => [w.number, w.title, assetById(db, w.assetId)?.code, assetById(db, w.assetId)?.name].join(' ').toLowerCase().includes(s));
    }
    return [...r].sort((a, b) => (group === 'done' ? (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt) : a.dueAt.localeCompare(b.dueAt)));
  }, [visible, group, status, type, priority, tech, overdueOnly, q, db]);

  if (!can(user, 'wo.view_all')) return <Unauthorized />;

  const exportCsv = () => {
    const head = ['Number', 'Title', 'Type', 'Priority', 'Status', 'Asset', 'Location', 'Lead technician', 'Supervisor', 'Scheduled', 'Due', 'Submitted', 'Completed', 'Rework count', 'Overdue'];
    const lines = rows.map((w) => [w.number, w.title, TYPE_LABEL[w.type], w.priority, STATUS_META[w.status].label, assetById(db, w.assetId)?.code ?? '', locationPath(db, w.locationId), userById(db, w.leadTechId)?.name ?? '', userById(db, w.supervisorId)?.name ?? '', fmtDateTime(w.scheduledFor), fmtDateTime(w.dueAt), w.submittedAt ? fmtDateTime(w.submittedAt) : '', w.completedAt ? fmtDateTime(w.completedAt) : '', w.reworkCount, isOverdue(w) ? 'Yes' : 'No']);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `work-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const count = (g: Group) => visible.filter((w) => (g === 'open' ? ['triage', 'assigned', 'in_progress', 'on_hold', 'rework'].includes(w.status) : g === 'review' ? w.status === 'submitted' : g === 'done' ? ['completed', 'closed', 'cancelled'].includes(w.status) : true)).length;

  return (
    <div>
      <PageHeader title={<>Work <em>orders</em></>} subtitle="Every maintenance task, its owner and its status." actions={<><Button onClick={exportCsv}><Download size={16} />Export CSV</Button>{can(user, 'wo.create') && <LinkButton to="/work-orders/new" variant="primary"><Plus size={16} />New work order</LinkButton>}</>} />
      <Tabs<Group>
        value={group}
        onChange={(g) => { const n = new URLSearchParams(); n.set('g', g); setSp(n, { replace: true }); }}
        tabs={[{ value: 'open', label: 'Open', count: count('open') }, { value: 'review', label: 'Awaiting review', count: count('review') }, { value: 'done', label: 'Completed', count: count('done') }, { value: 'all', label: 'All', count: count('all') }]}
      />
      <div className="my-4 grid grid-cols-2 gap-2 md:grid-cols-6">
        <div className="relative col-span-2">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => set('q', e.target.value)} placeholder="Search number, title, asset…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Any status</option>
          {(Object.keys(STATUS_META) as WOStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </Select>
        <Select value={type} onChange={(e) => set('type', e.target.value)}>
          <option value="">Any type</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={priority} onChange={(e) => set('priority', e.target.value)}>
          <option value="">Any priority</option>
          {['critical', 'high', 'medium', 'low'].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
        </Select>
        <Select value={tech} onChange={(e) => set('tech', e.target.value)}>
          <option value="">Any technician</option>
          {db.users.filter((u) => u.role === 'technician').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </div>
      <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={overdueOnly} onChange={(e) => set('overdue', e.target.checked ? '1' : '')} className="h-4 w-4 rounded border-ivory-300 text-forest-700" />
        Overdue only
      </label>
      <WOTable db={db} rows={rows} />
    </div>
  );
}
