import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { getMode, useDb } from '../lib/store';
import { can, type Permission } from '../lib/permissions';
import { cx, Eyebrow } from './ui';
import type { User } from '../lib/types';

/** First-run checklist for a fresh (live) workspace. Disappears once every step is done. */
export function GettingStarted({ user }: { user: User }) {
  const db = useDb();
  if (getMode() !== 'live') return null;
  const steps: { done: boolean; title: string; body: string; to: string; cta: string; perm: Permission }[] = [
    { done: db.departments.length > 0, title: 'Add departments', body: 'Engineering teams and the departments that request work.', to: '/team?tab=departments', cta: 'Departments', perm: 'employee.manage' },
    { done: db.locations.length > 1, title: 'Map your buildings', body: 'Buildings, floors, plant rooms and guest rooms.', to: '/locations', cta: 'Locations', perm: 'asset.manage' },
    { done: db.users.some((u) => u.role === 'supervisor') && db.users.some((u) => u.role === 'technician'), title: 'Invite your team', body: 'At least one supervisor and one technician, each with their own login.', to: '/team', cta: 'People', perm: 'employee.manage' },
    { done: db.assets.length > 0, title: 'Register machines', body: 'Generators, chillers, pumps — each gets a QR label and history.', to: '/assets', cta: 'Assets', perm: 'asset.manage' },
    { done: db.templates.length > 0, title: 'Build a checklist', body: 'The readings and photos technicians must capture.', to: '/templates', cta: 'Templates', perm: 'template.manage' },
    { done: db.workOrders.length > 0 || db.plans.length > 0, title: 'Issue the first job', body: 'A one-off work order or a recurring maintenance plan.', to: db.plans.length ? '/work-orders/new' : '/schedules', cta: 'Create', perm: 'wo.create' },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section className="overflow-hidden rounded-[24px] border border-gold-200 bg-gold-50 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div>
          <Eyebrow className="text-gold-700">New workspace · {done} of {steps.length} done</Eyebrow>
          <h2 className="mt-1 font-serif text-[30px] leading-tight text-forest-900">Get <em>{db.property.name}</em> ready</h2>
        </div>
        <div className="h-2 w-48 overflow-hidden rounded-full bg-gold-100"><div className="h-full rounded-full bg-forest-700 transition-[width] duration-700" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      </div>
      <ol className="grid gap-2 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((s, i) => {
          const allowed = can(user, s.perm);
          return (
            <li key={s.title} className={cx('flex items-start gap-3 rounded-2xl border bg-white p-3.5', s.done ? 'border-forest-100 opacity-70' : 'border-ivory-200')}>
              <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px]', s.done ? 'bg-forest-700 text-white' : 'bg-ivory-200 text-ink-700')}>{s.done ? <Check size={13} /> : i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className={cx('text-sm font-semibold', s.done ? 'text-ink-500 line-through' : 'text-ink-900')}>{s.title}</div>
                <div className="text-xs text-ink-500">{s.body}</div>
                {!s.done && (allowed ? <Link to={s.to} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900">{s.cta} <ArrowRight size={12} /></Link> : <div className="mt-2 text-[11px] text-ink-400">Done by an administrator</div>)}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
