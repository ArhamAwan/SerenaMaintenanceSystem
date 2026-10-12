import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, Siren } from 'lucide-react';
import { markAllRead, markNotificationRead, useCurrentUser, useDb } from '../lib/store';
import { Button, cx, EmptyState, PageHeader } from '../components/ui';
import { fmtDateTime, relative } from '../lib/time';

export default function Notifications() {
  const user = useCurrentUser()!;
  const db = useDb();
  const nav = useNavigate();
  const list = db.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at));
  const icon = { info: <Info size={18} />, warning: <AlertTriangle size={18} />, critical: <Siren size={18} />, success: <CheckCircle2 size={18} /> };
  const tone = { info: 'bg-sky-50 text-sky-700', warning: 'bg-amber-50 text-amber-700', critical: 'bg-rose-100 text-rose-700', success: 'bg-forest-50 text-forest-700' };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={<>Your <em>notifications</em></>} subtitle="In-app alerts. Email, push and SMS/WhatsApp channels plug into the same events (not configured in this demo)." actions={list.some((n) => !n.read) && <Button onClick={() => markAllRead(user.id)}><CheckCheck size={16} />Mark all read</Button>} />
      {list.length === 0 ? <EmptyState icon={<Bell size={28} />} title="No notifications" /> : (
        <div className="overflow-hidden rounded-[20px] border border-ivory-200 bg-white shadow-card">
          {list.map((n) => (
            <button key={n.id} onClick={() => { markNotificationRead(n.id); nav(n.link); }} className={cx('flex w-full items-start gap-3 border-b border-ivory-200 px-4 py-3.5 text-left last:border-0 hover:bg-ivory-50', !n.read && 'bg-gold-50/40')}>
              <span className={cx('mt-0.5 rounded-lg p-1.5', tone[n.level])}>{icon[n.level]}</span>
              <span className="min-w-0 flex-1">
                <span className={cx('block text-sm', n.read ? 'text-ink-700' : 'font-semibold text-ink-900')}>{n.title}</span>
                <span className="block text-sm text-ink-600">{n.body}</span>
                <span className="mt-0.5 block text-xs text-ink-400">{relative(n.at)} · {fmtDateTime(n.at)}</span>
              </span>
              {!n.read && <span className="mt-2 h-2 w-2 rounded-full bg-gold-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
