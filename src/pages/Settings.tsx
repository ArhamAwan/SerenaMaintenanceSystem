import { useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { eraseLiveWorkspace, getMode, resetDemo, runScheduler, switchWorkspace, useCurrentUser, useDb } from '../lib/store';
import { can, ROLE_LABEL, ROLE_PERMISSIONS } from '../lib/permissions';
import { Button, Card, KV, Modal, PageHeader, toast } from '../components/ui';
import { fmtDateTime } from '../lib/time';
import type { RoleKey } from '../lib/types';

export default function Settings() {
  const user = useCurrentUser()!;
  const db = useDb();
  const [confirm, setConfirm] = useState(false);
  const [erase, setErase] = useState(false);
  const mode = getMode();
  const perms = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat()));
  return (
    <div>
      <PageHeader title={<><em>Settings</em></>} subtitle="Property configuration, permissions and workspace controls." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Property">
          <dl>
            <KV k="Hotel group" v={db.property.group} />
            <KV k="Property" v={db.property.name} />
            <KV k="Timezone" v={db.property.timezone} />
            <KV k="Work order numbering" v="WO-{YYYY}-{0000}" />
            <KV k="Data isolation" v="Every record scoped to property" />
          </dl>
        </Card>
        <Card title={<>Workspace <em>{mode === 'demo' ? 'demo' : 'live'}</em></>}>
          <p className="text-sm text-ink-600">{mode === 'demo' ? 'You are in the demo workspace: fictional staff, machines and history. Your own workspace is kept separately.' : `You are in your own workspace for ${db.property.name}. It started empty; everything here was entered by your team.`} Data is saved in this browser on this computer.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => { const r = runScheduler(user.id); toast(`Scheduler: ${r.created} generated · ${r.skipped} duplicates prevented`, 'info'); }}><RefreshCw size={16} />Run scheduler</Button>
            {mode === 'demo' ? (
              <>
                <Button variant="primary" onClick={() => switchWorkspace('live')}>Go to my own workspace</Button>
                <Button variant="danger" onClick={() => setConfirm(true)}><RotateCcw size={16} />Reset demo data</Button>
              </>
            ) : (
              <>
                <Button onClick={() => switchWorkspace('demo')}>Open demo workspace</Button>
                {can(user, 'settings.manage') && <Button variant="danger" onClick={() => setErase(true)}><RotateCcw size={16} />Erase my workspace</Button>}
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-500">{mode === 'demo' ? `Demo data seeded ${fmtDateTime(db.seededAt)}. Reset re-creates all records relative to today.` : `Workspace created ${fmtDateTime(db.seededAt)}.`}</p>
        </Card>
        <Card title="Integrations" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[['Email (SMTP)', 'Notifications, invitations, password reset'], ['Browser push', 'Mobile alerts for technicians'], ['SMS / WhatsApp', 'Emergency escalation'], ['Corporate SSO', 'Azure AD / Google Workspace']].map(([n, d]) => (
              <div key={n} className="rounded-lg border border-ivory-300 p-3"><div className="font-medium text-ink-900">{n}</div><div className="text-xs text-ink-500">{d}</div><div className="mt-2 inline-block rounded-full bg-ivory-200 px-2 py-0.5 text-[11px] font-medium text-ink-600">Not configured</div></div>
            ))}
          </div>
        </Card>
        <Card title="Roles & permissions" className="lg:col-span-2" pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Permission</th>{(Object.keys(ROLE_LABEL) as RoleKey[]).map((r) => <th key={r} className="text-center">{ROLE_LABEL[r]}</th>)}</tr></thead>
              <tbody>
                {perms.map((p) => (
                  <tr key={p}><td className="font-mono text-xs">{p}</td>{(Object.keys(ROLE_LABEL) as RoleKey[]).map((r) => <td key={r} className="text-center">{ROLE_PERMISSIONS[r].includes(p) ? <span className="text-forest-700">●</span> : <span className="text-ivory-300">○</span>}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-ink-500">{can(user, 'settings.manage') ? 'Permission editing is enabled for Super Administrators in the production build.' : 'Read-only.'} Administrators do not automatically get approval rights.</p>
        </Card>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset all demo data?" footer={<><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={() => { resetDemo(); setConfirm(false); toast('Demo data reset'); }}>Reset</Button></>}>
        <p className="text-sm text-ink-600">All changes made during the demo will be lost and the original sample records restored.</p>
      </Modal>
      <Modal open={erase} onClose={() => setErase(false)} title="Erase your workspace?" footer={<><Button onClick={() => setErase(false)}>Cancel</Button><Button variant="danger" onClick={() => { eraseLiveWorkspace(); setErase(false); toast('Workspace erased — set it up again from the start'); }}>Erase everything</Button></>}>
        <p className="text-sm text-ink-600">All people, locations, machines, work orders and reports in <b>{db.property.name}</b> will be permanently deleted from this browser. The demo workspace is not affected.</p>
      </Modal>
    </div>
  );
}
