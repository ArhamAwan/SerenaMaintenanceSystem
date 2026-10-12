import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, UserPlus } from 'lucide-react';
import { createDepartment, getMode, inviteUser, setUserStatus, useCurrentUser, useDb, userById } from '../lib/store';
import { can, ROLE_LABEL } from '../lib/permissions';
import { attempt, Avatar, Button, Card, cx, Field, Input, Modal, PageHeader, Pill, Select, Tabs, Textarea, Unauthorized } from '../components/ui';
import type { RoleKey, User } from '../lib/types';

type T = 'employees' | 'departments';

export default function Team() {
  const user = useCurrentUser()!;
  const db = useDb();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState<T>((sp.get('tab') as T) ?? 'employees');
  const [invite, setInvite] = useState(false);
  const [dept, setDept] = useState(false);
  const [suspend, setSuspend] = useState<User | null>(null);
  const [reason, setReason] = useState('');
  const highlight = sp.get('u');
  if (!can(user, 'employee.view')) return <Unauthorized />;
  const admin = can(user, 'employee.manage');
  const load = (id: string) => db.workOrders.filter((w) => (w.leadTechId === id || w.helperIds.includes(id)) && ['assigned', 'in_progress', 'rework', 'on_hold'].includes(w.status)).length;

  return (
    <div>
      <PageHeader title={<>People &amp; <em>departments</em></>} subtitle={`${db.users.length} staff accounts · ${db.departments.length} departments`} actions={admin && (tab === 'employees' ? <Button variant="primary" onClick={() => setInvite(true)}><UserPlus size={16} />Invite employee</Button> : <Button variant="primary" onClick={() => setDept(true)}><Plus size={16} />New department</Button>)} />
      <Tabs<T> value={tab} onChange={setTab} tabs={[{ value: 'employees', label: 'Employees', count: db.users.length }, { value: 'departments', label: 'Departments', count: db.departments.length }]} />
      <div className="mt-5">
        {tab === 'employees' ? (
          <div className="overflow-x-auto rounded-[20px] border border-ivory-200 bg-white shadow-card">
            <table className="tbl">
              <thead><tr><th>Employee</th><th>Role</th><th>Department</th><th>Skills</th><th>Shift</th><th>Open work</th><th>Status</th>{admin && <th />}</tr></thead>
              <tbody>
                {db.users.map((u) => (
                  <tr key={u.id} className={cx(highlight === u.id && 'bg-gold-50')}>
                    <td><div className="flex items-center gap-3"><Avatar name={u.name} size={34} /><div><div className="font-medium text-ink-900">{u.name}</div><div className="text-xs text-ink-500">{u.employeeId} · {u.designation}</div></div></div></td>
                    <td className="whitespace-nowrap">{ROLE_LABEL[u.role]}</td>
                    <td className="whitespace-nowrap">{db.departments.find((d) => d.id === u.departmentId)?.name}{u.supervisorId && <div className="text-xs text-ink-500">Reports to {userById(db, u.supervisorId)?.name}</div>}</td>
                    <td><div className="flex max-w-[220px] flex-wrap gap-1">{u.skills.map((s) => <Pill key={s}>{s}</Pill>)}</div></td>
                    <td>{u.shift}</td>
                    <td className="tabular-nums">{u.role === 'technician' ? load(u.id) : '—'}</td>
                    <td><span className={cx('rounded-full px-2 py-0.5 text-xs font-medium', u.status === 'active' ? 'bg-forest-50 text-forest-800' : 'bg-rose-50 text-rose-800')}>{u.status}</span></td>
                    {admin && <td>{u.id !== user.id && <Button size="sm" variant="ghost" onClick={() => { setSuspend(u); setReason(''); }}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {db.departments.map((d) => (
              <Card key={d.id}>
                <div className="flex items-start justify-between"><div><div className="text-xs font-semibold tracking-wider text-gold-700">{d.code}</div><div className="font-serif text-[25px] leading-tight text-forest-900">{d.name}</div></div>{d.isEngineering ? <Pill className="bg-forest-50 text-forest-800">Engineering</Pill> : <Pill>Requester</Pill>}</div>
                <div className="mt-3 flex gap-4 text-sm text-ink-600"><span>{db.users.filter((u) => u.departmentId === d.id).length} staff</span><span>{db.assets.filter((a) => a.departmentId === d.id).length} assets</span></div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <InviteModal open={invite} onClose={() => setInvite(false)} />
      <DeptModal open={dept} onClose={() => setDept(false)} />
      <Modal open={!!suspend} onClose={() => setSuspend(null)} title={`${suspend?.status === 'active' ? 'Suspend' : 'Reactivate'} ${suspend?.name}`} footer={<><Button onClick={() => setSuspend(null)}>Cancel</Button><Button variant={suspend?.status === 'active' ? 'danger' : 'primary'} onClick={() => suspend && attempt(() => setUserStatus(user, suspend.id, suspend.status === 'active' ? 'suspended' : 'active', reason), 'Account updated') && setSuspend(null)}>Confirm</Button></>}>
        {suspend?.status === 'active' && <p className="text-sm text-ink-600">Suspended users cannot sign in and cannot be assigned new work. Their history is kept.</p>}
        <Field label="Reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser()!;
  const db = useDb();
  const [f, setF] = useState({ name: '', employeeId: '', email: '', phone: '', role: 'technician' as RoleKey, designation: '', departmentId: db.departments.find((d) => d.isEngineering)?.id ?? db.departments[0]?.id ?? '', supervisorId: db.users.find((u) => u.role === 'supervisor' && u.status === 'active')?.id ?? '', skills: '', shift: 'Morning' as User['shift'], password: '' });
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = () => attempt(() => inviteUser(user, { ...f, skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean), supervisorId: f.role === 'technician' && f.supervisorId ? f.supervisorId : undefined, password: f.password || undefined }), getMode() === 'live' ? `${f.name} added — they can sign in with ${f.email.trim().toLowerCase()} and the temporary password.` : `${f.name} added. Invitation email requires SMTP (not configured in demo) — they can sign in from the demo account list.`) && (onClose(), setF((x) => ({ ...x, name: '', employeeId: '', email: '', phone: '', designation: '', skills: '', password: '' })));
  return (
    <Modal open={open} onClose={onClose} title="Invite employee" wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Create & invite</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required><Input value={f.name} onChange={(e) => up('name', e.target.value)} /></Field>
        <Field label="Employee ID" required><Input value={f.employeeId} onChange={(e) => up('employeeId', e.target.value)} placeholder="ISB-2099" /></Field>
        <Field label="Official email" required><Input type="email" value={f.email} onChange={(e) => up('email', e.target.value)} /></Field>
        <Field label="Contact number"><Input value={f.phone} onChange={(e) => up('phone', e.target.value)} /></Field>
        <Field label="Role"><Select value={f.role} onChange={(e) => up('role', e.target.value as RoleKey)}>{(Object.keys(ROLE_LABEL) as RoleKey[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
        <Field label="Designation"><Input value={f.designation} onChange={(e) => up('designation', e.target.value)} /></Field>
        <Field label="Department"><Select value={f.departmentId} onChange={(e) => up('departmentId', e.target.value)}><option value="">— None —</option>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        {f.role === 'technician' && <Field label="Reporting supervisor"><Select value={f.supervisorId} onChange={(e) => up('supervisorId', e.target.value)}><option value="">— Not set —</option>{db.users.filter((u) => u.role === 'supervisor').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>}
        <Field label="Skills / certifications" hint="Comma separated — used to filter assignment"><Input value={f.skills} onChange={(e) => up('skills', e.target.value)} placeholder="HVAC, Generators" /></Field>
        <Field label="Temporary password" required={getMode() === 'live'} hint={getMode() === 'live' ? 'At least 8 characters — share it with them in person' : 'Optional in the demo (demo password works)'}><Input type="text" value={f.password} onChange={(e) => up('password', e.target.value)} /></Field>
        <Field label="Shift"><Select value={f.shift} onChange={(e) => up('shift', e.target.value as User['shift'])}>{['Morning', 'Evening', 'Night', 'General'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}

function DeptModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser()!;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [eng, setEng] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="New department" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => attempt(() => createDepartment(user, name, code, eng), 'Department created') && (onClose(), setName(''), setCode(''))}>Create</Button></>}>
      <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IT & Technical Infrastructure" /></Field>
      <Field label="Code" required><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ITI" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={eng} onChange={(e) => setEng(e.target.checked)} className="h-4 w-4 rounded" />Engineering department (performs maintenance)</label>
    </Modal>
  );
}
