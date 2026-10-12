import { useState } from 'react';
import { ArrowRight, Building2, FlaskConical, Sparkles } from 'lucide-react';
import { checkPassword, getMode, login, needsSetup, setupWorkspace, switchWorkspace, useDb } from '../lib/store';
import { ROLE_LABEL } from '../lib/permissions';
import { attempt, Avatar, Button, Eyebrow, Field, Input, Modal, toast } from '../components/ui';
import type { RoleKey } from '../lib/types';

const DEMO_PASSWORD = 'serena123';

const ROLE_BLURB: Record<RoleKey, string> = {
  technician: 'Mobile tasks, checklists, photo evidence',
  supervisor: 'Review queue, approvals, rework, scheduling',
  manager: 'Facility health, escalations, analytics',
  requester: 'Report faults, track & confirm repairs',
  admin: 'Users, departments, templates, audit',
};

function Brand() {
  return (
    <div className="grain relative hidden overflow-hidden rounded-[32px] lg:block" style={{ backgroundColor: '#10291F', backgroundImage: 'radial-gradient(80% 60% at 100% 0%, rgba(201,164,100,.32) 0%, rgba(201,164,100,0) 60%), radial-gradient(70% 60% at 0% 100%, #1F4D38 0%, rgba(16,41,31,0) 70%), var(--grain)' }}>
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #D9BC80 0 1px, transparent 1px 26px), repeating-linear-gradient(-45deg, #D9BC80 0 1px, transparent 1px 26px)' }} />
      <div className="relative flex h-full flex-col justify-between p-12 text-ivory-100">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold-400/70 font-serif text-[30px] text-gold-300">S</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold-300">Islamabad Serena Hotel · Engineering</span>
        </div>
        <div>
          <h1 className="font-serif text-[5.4rem] leading-[0.9] text-ivory-50">
            Every machine
            <br />
            has <em className="!text-gold-300">a history.</em>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ivory-200/75">
            Maintenance Hub replaces paper logs and WhatsApp threads with one traceable system — scheduled inspections, photo evidence, supervisor review and a full record for every asset.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm">
          {[
            ['01', 'Every task has an owner'],
            ['02', 'Every inspection has evidence'],
            ['03', 'Every correction stays traceable'],
          ].map(([a, b]) => (
            <div key={a}>
              <div className="font-mono text-[11px] tracking-[0.16em] text-gold-300">{a}</div>
              <div className="mt-1 text-ivory-200/80">{b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const db = useDb();
  const mode = getMode();
  return (
    <div className="grid min-h-screen gap-3 p-3 lg:grid-cols-[1.1fr_1fr]">
      <Brand />
      <div className="flex items-center justify-center px-3 py-8">
        <div className="w-full max-w-[440px] animate-pop">
          <div className="mb-8 lg:hidden">
            <Eyebrow className="text-gold-700">Islamabad Serena Hotel</Eyebrow>
            <div className="mt-2 font-serif text-[3.2rem] leading-[0.95] text-forest-900">Maintenance <em>Hub</em></div>
          </div>
          {needsSetup(db) ? <SetupWizard /> : <SignIn />}
          <div className="mt-8 rounded-2xl border border-ivory-200 bg-white/70 p-4">
            {mode === 'demo' ? (
              <button onClick={() => switchWorkspace('live')} className="group flex w-full items-center gap-3 text-left">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-900 text-gold-300"><Building2 size={18} /></span>
                <span className="flex-1"><span className="block text-sm font-semibold text-ink-900">Use your own workspace</span><span className="block text-xs text-ink-500">Start empty: create your admin account, then add your team, locations and machines.</span></span>
                <ArrowRight size={16} className="text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-forest-700" />
              </button>
            ) : (
              <button onClick={() => switchWorkspace('demo')} className="group flex w-full items-center gap-3 text-left">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100 text-gold-800"><FlaskConical size={18} /></span>
                <span className="flex-1"><span className="block text-sm font-semibold text-ink-900">Open the demo workspace</span><span className="block text-xs text-ink-500">Sample hotel data with fictional staff. Your own workspace is kept separately.</span></span>
                <ArrowRight size={16} className="text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-forest-700" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignIn() {
  const db = useDb();
  const mode = getMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || !checkPassword(u, password, DEMO_PASSWORD)) return setError('Email or password is incorrect.');
    if (u.status !== 'active') return setError('This account is suspended. Contact your administrator.');
    login(u.id);
  };

  const order: RoleKey[] = ['admin', 'manager', 'supervisor', 'technician', 'requester'];
  const demoQuick = (['technician', 'supervisor', 'manager', 'requester', 'admin'] as RoleKey[]).map((r) => db.users.find((u) => u.role === r && u.status === 'active')!).filter(Boolean);
  const liveQuick = db.users.filter((u) => u.status === 'active').sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  const quick = mode === 'demo' ? demoQuick : liveQuick;

  return (
    <>
      <Eyebrow className="mb-2 text-gold-700">{mode === 'demo' ? 'Demo workspace · fictional data' : db.property.name}</Eyebrow>
      <h2 className="font-serif text-[2.6rem] leading-none text-forest-900">Welcome <em>back</em></h2>
      <p className="mt-2 text-sm text-ink-600">Sign in with your official hotel email.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@serena…" className="h-12" />
        </Field>
        <Field label="Password" hint={mode === 'demo' ? <>Demo password: <span className="font-mono">{DEMO_PASSWORD}</span></> : undefined}>
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
        </Field>
        {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{error}</div>}
        <Button variant="primary" size="lg" className="w-full">Sign in <ArrowRight size={16} /></Button>
        <button type="button" onClick={() => setForgot(true)} className="block w-full text-center text-sm text-forest-700 hover:underline">Forgot password?</button>
      </form>

      {quick.length > 0 && (
        <div className="mt-9">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-gold-200" />
            <Eyebrow className="text-gold-700">{mode === 'demo' ? 'Demo accounts · one click' : 'Quick switch · presentation mode'}</Eyebrow>
            <span className="h-px flex-1 bg-gold-200" />
          </div>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {quick.map((u) => (
              <button key={u.id} onClick={() => login(u.id)} className="group flex w-full items-center gap-3 rounded-2xl border border-ivory-200 bg-white/80 px-3 py-2.5 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-lift">
                <Avatar name={u.name} size={38} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-sm font-semibold text-ink-900">{u.name}</span>
                  <span className="block truncate text-xs text-ink-500">{ROLE_LABEL[u.role]} · {mode === 'demo' ? ROLE_BLURB[u.role] : u.designation || u.email}</span>
                </span>
                <ArrowRight size={16} className="text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-forest-700" />
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal open={forgot} onClose={() => setForgot(false)} title="Reset password" footer={<Button variant="primary" onClick={() => { setForgot(false); toast(mode === 'demo' ? 'Email service is not configured in this demo — no message was sent.' : 'Ask your administrator to set a new password for you (email reset arrives with the server version).', 'info'); }}>Send reset link</Button>}>
        <p className="text-sm text-ink-600">Enter your official email. A single-use reset link valid for 30 minutes will be sent.</p>
        <Field label="Email"><Input type="email" /></Field>
        <p className="rounded-xl bg-gold-50 px-3 py-2 text-xs text-gold-800 ring-1 ring-gold-200">Integration pending: outbound email (SMTP) must be configured before this works.</p>
      </Modal>
    </>
  );
}

function SetupWizard() {
  const [f, setF] = useState({ hotelName: 'Islamabad Serena Hotel', city: 'Islamabad', adminName: '', adminEmail: '', password: '', confirm: '', addDepartments: true, addTemplates: true, addLocations: true });
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password !== f.confirm) return toast('The two passwords do not match.', 'error');
    attempt(() => setupWorkspace(f), 'Workspace created — you are signed in as administrator');
  };
  const Check = ({ k, title, body }: { k: 'addDepartments' | 'addTemplates' | 'addLocations'; title: string; body: string }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ivory-200 bg-white px-3 py-2.5 transition hover:border-gold-300">
      <input type="checkbox" checked={f[k]} onChange={(e) => up(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#1F4D38]" />
      <span><span className="block text-sm font-medium text-ink-900">{title}</span><span className="block text-xs text-ink-500">{body}</span></span>
    </label>
  );
  return (
    <>
      <Eyebrow className="mb-2 text-gold-700"><span className="inline-flex items-center gap-1.5"><Sparkles size={12} />New workspace · step 1 of 1</span></Eyebrow>
      <h2 className="font-serif text-[2.6rem] leading-none text-forest-900">Set up your <em>workspace</em></h2>
      <p className="mt-2 text-sm text-ink-600">You'll be the administrator. Everything starts empty — no sample data.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Hotel / property" required><Input value={f.hotelName} onChange={(e) => up('hotelName', e.target.value)} /></Field>
          <Field label="City"><Input value={f.city} onChange={(e) => up('city', e.target.value)} /></Field>
        </div>
        <Field label="Your full name" required><Input value={f.adminName} onChange={(e) => up('adminName', e.target.value)} placeholder="e.g. Arham Awan" /></Field>
        <Field label="Your email" required><Input type="email" value={f.adminEmail} onChange={(e) => up('adminEmail', e.target.value)} placeholder="you@company.com" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Password" required hint="At least 8 characters"><Input type="password" value={f.password} onChange={(e) => up('password', e.target.value)} /></Field>
          <Field label="Confirm password" required><Input type="password" value={f.confirm} onChange={(e) => up('confirm', e.target.value)} /></Field>
        </div>
        <div className="space-y-2">
          <div className="text-[13px] font-medium text-ink-800">Starter configuration <span className="font-normal text-ink-500">(no fake records — just structure)</span></div>
          <Check k="addDepartments" title="Standard departments" body="Engineering, Mechanical/HVAC, Electrical, Plumbing, Fire & Life Safety, Housekeeping, Kitchen…" />
          <Check k="addLocations" title="Basic building structure" body="Main Building (Basement, Ground Floor), Guest Wing, Grounds & Leisure" />
          <Check k="addTemplates" title="Checklist library" body="Generator, chiller, fire pump and pump inspections; repair and preventive-service reports" />
        </div>
        <Button variant="primary" size="lg" className="w-full">Create workspace <ArrowRight size={16} /></Button>
        <p className="text-center text-xs text-ink-500">Saved in this browser on this computer. The server version will store it centrally.</p>
      </form>
    </>
  );
}
