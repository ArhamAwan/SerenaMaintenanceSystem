import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createWorkOrder, locationPath, useCurrentUser, useDb, woById } from '../lib/store';
import { can } from '../lib/permissions';
import { attempt, Button, Card, cx, Field, Input, PageHeader, Select, Textarea, Unauthorized } from '../components/ui';
import { addHours, nowIso } from '../lib/time';
import type { Priority, WOType, WorkOrder } from '../lib/types';

const toLocal = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 16);
const fromLocal = (v: string) => new Date(`${v}:00+05:00`).toISOString();

export default function NewWorkOrder() {
  const user = useCurrentUser()!;
  const db = useDb();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const from = woById(db, sp.get('from') ?? undefined);
  const [assetId, setAssetId] = useState(sp.get('asset') ?? '');
  const [locationId, setLocationId] = useState('');
  const [type, setType] = useState<WOType>((sp.get('type') as WOType) ?? 'corrective');
  const [priority, setPriority] = useState<Priority>(from ? 'high' : 'medium');
  const [title, setTitle] = useState(from ? `Follow-up: abnormal readings on ${from.title}` : '');
  const [description, setDescription] = useState(from ? `Raised from review of ${from.number}. ${db.submissions.filter((s) => s.woId === from.id).slice(-1)[0]?.flags.map((f) => `${f.label}: ${f.value}`).join('; ') ?? ''}` : '');
  const tplOr = (id: string) => (db.templates.some((t) => t.id === id) ? id : '');
  const [templateId, setTemplateId] = useState(tplOr(type === 'preventive' ? 'tpl-service' : 'tpl-repair'));
  const [lead, setLead] = useState('');
  const [helpers, setHelpers] = useState<string[]>([]);
  const [supervisorId, setSupervisorId] = useState(user.role === 'supervisor' || user.role === 'manager' ? user.id : db.users.find((u) => u.role === 'supervisor' && u.status === 'active')?.id ?? db.users.find((u) => u.role === 'manager')?.id ?? '');
  const [scheduled, setScheduled] = useState(toLocal(nowIso()));
  const [due, setDue] = useState(toLocal(addHours(nowIso(), 24)));
  const [instructions, setInstructions] = useState('');
  const [safety, setSafety] = useState('Follow standard isolation and lockout/tagout procedures.');
  const [approval, setApproval] = useState(true);

  if (!can(user, 'wo.create')) return <Unauthorized />;
  const techs = db.users.filter((u) => u.role === 'technician');
  const load = (id: string) => db.workOrders.filter((w) => (w.leadTechId === id || w.helperIds.includes(id)) && ['assigned', 'in_progress', 'rework', 'on_hold'].includes(w.status)).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let created: WorkOrder | undefined;
    const ok = attempt(() => {
      created = createWorkOrder(user, { title, description, type, priority, assetId: assetId || undefined, locationId: locationId || undefined, leadTechId: lead || undefined, helperIds: helpers, supervisorId, scheduledFor: fromLocal(scheduled), dueAt: fromLocal(due), templateId, instructions, safety, requiresApproval: approval });
    }, lead ? 'Work order created and technician notified' : 'Work order created — awaiting assignment');
    if (ok && created) nav(`/work-orders/${created.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={<>New work <em>order</em></>} subtitle={from ? `Corrective action raised from ${from.number}` : 'Create and assign maintenance work.'} />
      <form onSubmit={submit} className="space-y-6">
        <Card title="What & where">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" required className="sm:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Replace worn belt on AHU-03" /></Field>
            <Field label="Maintenance type">
              <Select value={type} onChange={(e) => { setType(e.target.value as WOType); setTemplateId(tplOr(e.target.value === 'preventive' ? 'tpl-service' : e.target.value === 'inspection' ? '' : 'tpl-repair')); }}>
                <option value="preventive">Preventive</option><option value="corrective">Corrective</option><option value="emergency">Emergency</option><option value="inspection">Routine inspection</option>
              </Select>
            </Field>
            <Field label="Priority">
              <div className="grid grid-cols-4 gap-1.5">
                {(['low', 'medium', 'high', 'critical'] as Priority[]).map((p) => (
                  <button type="button" key={p} onClick={() => setPriority(p)} className={cx('h-10 rounded-lg text-sm capitalize ring-1 ring-inset', priority === p ? (p === 'critical' ? 'bg-rose-700 text-white ring-rose-700' : 'bg-forest-800 text-white ring-forest-800') : 'bg-white text-ink-700 ring-ivory-300')}>{p}</button>
                ))}
              </div>
            </Field>
            <Field label="Asset">
              <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <option value="">— No specific asset —</option>
                {db.assets.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
              </Select>
            </Field>
            <Field label="Location" hint={assetId ? 'Taken from the asset' : 'Required if no asset'}>
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!!assetId}>
                <option value="">Select…</option>
                {db.locations.filter((l) => l.type !== 'property').map((l) => <option key={l.id} value={l.id}>{locationPath(db, l.id)}</option>)}
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-2"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          </div>
        </Card>
        <Card title="Assignment">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lead technician" hint="Leave empty to send to triage">
              <Select value={lead} onChange={(e) => setLead(e.target.value)}>
                <option value="">— Unassigned —</option>
                {techs.map((t) => <option key={t.id} value={t.id} disabled={t.status !== 'active'}>{t.name}{t.skills.length ? ` — ${t.skills.join(', ')}` : ''} · {load(t.id)} open</option>)}
              </Select>
            </Field>
            <Field label="Supervisor / reviewer">
              <Select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}><option value="">Select…</option>
                {db.users.filter((u) => u.role === 'supervisor' || u.role === 'manager').map((u) => <option key={u.id} value={u.id}>{u.name} — {u.designation}</option>)}
              </Select>
            </Field>
            <Field label="Supporting technicians" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {techs.filter((t) => t.id !== lead && t.status === 'active').map((t) => {
                  const on = helpers.includes(t.id);
                  return <button type="button" key={t.id} onClick={() => setHelpers(on ? helpers.filter((h) => h !== t.id) : [...helpers, t.id])} className={cx('rounded-full px-3 py-1 text-sm ring-1', on ? 'bg-forest-800 text-white ring-forest-800' : 'bg-white text-ink-700 ring-ivory-300')}>{t.name}</button>;
                })}
              </div>
            </Field>
            <Field label="Scheduled start"><Input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} /></Field>
            <Field label="Completion deadline"><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
        </Card>
        <Card title="Instructions & checklist">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Checklist template">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">— None —</option>
                {db.templates.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.versions.length})</option>)}
              </Select>
            </Field>
            <Field label="Approval">
              <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} className="h-4 w-4 rounded" />Supervisor approval required before completion</label>
            </Field>
            <Field label="Work instructions" className="sm:col-span-2"><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field>
            <Field label="Safety instructions" className="sm:col-span-2"><Textarea value={safety} onChange={(e) => setSafety(e.target.value)} /></Field>
          </div>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => nav(-1)}>Cancel</Button>
          <Button variant="primary" size="lg">Create work order</Button>
        </div>
      </form>
    </div>
  );
}
