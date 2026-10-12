import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, CalendarClock, ClipboardCheck, ClipboardList, Cog, Gauge, History, LayoutDashboard, ListChecks, LogOut, MapPin,
  Menu, QrCode, Search, ShieldCheck, Siren, Users, Wrench, Inbox, ChevronDown, Repeat, CornerDownLeft, ArrowRight,
} from 'lucide-react';
import { useCurrentUser, useDb, logout, login, getPersistError, getMode, switchWorkspace } from '../lib/store';
import { can, ROLE_LABEL, canViewWO } from '../lib/permissions';
import { Avatar, cx } from './ui';
import type { RoleKey, User } from '../lib/types';

interface NavItem { to: string; label: string; icon: ReactNode; show: (u: User) => boolean; badge?: number; section: 'work' | 'assets' | 'org' }

function useNav(user: User) {
  const db = useDb();
  const reviewCount = db.workOrders.filter((w) => w.status === 'submitted' && (user.role === 'manager' || w.supervisorId === user.id)).length;
  const myTaskCount = db.workOrders.filter((w) => (w.leadTechId === user.id || w.helperIds.includes(user.id)) && ['assigned', 'in_progress', 'rework'].includes(w.status)).length;
  const triageCount = db.workOrders.filter((w) => w.status === 'triage').length;
  const unread = db.notifications.filter((n) => n.userId === user.id && !n.read).length;
  const awaitingConfirm = db.workOrders.filter((w) => w.requestedById === user.id && w.status === 'completed').length;
  const nav: NavItem[] = [
    { to: '/', label: user.role === 'technician' ? 'My day' : 'Dashboard', icon: <LayoutDashboard size={17} />, show: () => true, section: 'work' },
    { to: '/tasks', label: 'My tasks', icon: <ClipboardList size={17} />, show: (u) => can(u, 'wo.execute'), badge: myTaskCount, section: 'work' },
    { to: '/requests', label: 'My requests', icon: <Inbox size={17} />, show: (u) => u.role === 'requester', badge: awaitingConfirm, section: 'work' },
    { to: '/work-orders', label: 'Work orders', icon: <Wrench size={17} />, show: (u) => can(u, 'wo.view_all'), badge: can(user, 'wo.assign') ? triageCount : undefined, section: 'work' },
    { to: '/approvals', label: 'Approvals', icon: <ClipboardCheck size={17} />, show: (u) => can(u, 'wo.review'), badge: reviewCount, section: 'work' },
    { to: '/schedules', label: 'Maintenance calendar', icon: <CalendarClock size={17} />, show: (u) => can(u, 'plan.manage'), section: 'work' },
    { to: '/report-fault', label: 'Report a fault', icon: <Siren size={17} />, show: (u) => can(u, 'fault.report'), section: 'work' },
    { to: '/assets', label: 'Assets & machinery', icon: <Gauge size={17} />, show: (u) => can(u, 'asset.view'), section: 'assets' },
    { to: '/locations', label: 'Locations', icon: <MapPin size={17} />, show: (u) => can(u, 'asset.view'), section: 'assets' },
    { to: '/templates', label: 'Inspection templates', icon: <ListChecks size={17} />, show: (u) => can(u, 'template.manage'), section: 'assets' },
    { to: '/team', label: 'People & departments', icon: <Users size={17} />, show: (u) => can(u, 'employee.view'), section: 'org' },
    { to: '/notifications', label: 'Notifications', icon: <Bell size={17} />, show: () => true, badge: unread, section: 'org' },
    { to: '/audit', label: 'Audit log', icon: <History size={17} />, show: (u) => can(u, 'audit.view'), section: 'org' },
    { to: '/settings', label: 'Settings', icon: <Cog size={17} />, show: () => true, section: 'org' },
  ];
  return { items: nav.filter((n) => n.show(user)), unread, myTaskCount };
}

export function Shell({ children }: { children: ReactNode }) {
  const user = useCurrentUser()!;
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const loc = useLocation();
  const { items, unread, myTaskCount } = useNav(user);
  useEffect(() => {
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const sections: { id: NavItem['section']; label: string }[] = [
    { id: 'work', label: 'Operations' },
    { id: 'assets', label: 'Plant & assets' },
    { id: 'org', label: 'Organisation' },
  ];

  // rail = compact icon rail between lg and xl, full sidebar from xl up; drawer is always full
  const renderSidebar = (rail: boolean) => {
    const full = rail ? 'lg:hidden xl:block' : '';
    const fullFlex = rail ? 'lg:hidden xl:flex' : '';
    return (
      <div className="grain flex h-full flex-col overflow-hidden rounded-[24px] bg-forest-900 text-ivory-100 shadow-[0_30px_60px_-30px_rgba(13,35,26,.7)]" style={{ backgroundImage: 'radial-gradient(120% 50% at 0% 0%, #1F4D38 0%, rgba(19,52,38,0) 60%), radial-gradient(80% 40% at 100% 100%, rgba(201,164,100,.16) 0%, rgba(19,52,38,0) 70%), var(--grain)' }}>
        <Link to="/" className={cx('flex items-center gap-3 pb-6 pt-6', rail ? 'justify-center px-0 xl:justify-start xl:px-5' : 'px-5')}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-400/70 font-serif text-[26px] text-gold-300">S</span>
          <span className={cx('leading-tight', full)}>
            <span className="block whitespace-nowrap font-serif text-[23px] leading-none text-ivory-50">Maintenance Hub</span>
            <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.2em] text-gold-400">Islamabad Serena</span>
          </span>
        </Link>
        <nav className={cx('flex-1 space-y-5 overflow-y-auto overflow-x-hidden pb-4', rail ? 'px-2 xl:px-3' : 'px-3')}>
          {sections.map((s) => {
            const list = items.filter((i) => i.section === s.id);
            if (!list.length) return null;
            return (
              <div key={s.id}>
                <div className={cx('px-3 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ivory-200/40', full)}>{s.label}</div>
                {rail && <div className="mx-auto mb-2 hidden h-px w-6 bg-white/10 lg:block xl:hidden" />}
                <div className="space-y-0.5">
                  {list.map((n) => (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      end={n.to === '/'}
                      title={n.label}
                      className={({ isActive }) =>
                        cx('group relative flex items-center gap-3 rounded-xl py-2 text-[13.5px] transition duration-200', rail ? 'justify-center px-0 xl:justify-start xl:px-3' : 'px-3', isActive ? 'bg-gold-300/[0.13] text-white ring-1 ring-inset ring-gold-300/25' : 'text-ivory-200/70 hover:bg-white/[0.05] hover:text-white')
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className={cx('relative', isActive ? 'text-gold-300' : 'text-ivory-200/50 transition group-hover:text-gold-300')}>
                            {n.icon}
                            {rail && !!n.badge && <span className="absolute -right-1.5 -top-1.5 hidden h-2 w-2 rounded-full bg-gold-400 lg:block xl:hidden" />}
                          </span>
                          <span className={cx('flex-1 whitespace-nowrap', full)}>{n.label}</span>
                          {!!n.badge && <span className={cx('rounded-full bg-gold-400 px-1.5 font-mono text-[10.5px] font-medium text-forest-950', full)}>{n.badge}</span>}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className={cx('m-3 items-center gap-3 rounded-2xl border border-gold-300/20 bg-white/[0.05] p-3', rail ? 'hidden xl:flex' : 'flex')}>
          <Avatar name={user.name} size={34} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium text-ivory-50">{user.name}</div>
            <div className="truncate text-[11px] text-ivory-200/55">{ROLE_LABEL[user.role]}</div>
          </div>
        </div>
        {rail && <div className="mb-4 hidden justify-center lg:flex xl:hidden"><Avatar name={user.name} size={34} /></div>}
        <div className={cx('px-5 pb-4 font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.14em] text-ivory-200/35', fullFlex)}>{getMode() === 'demo' ? 'Demo · fictional data · PKT' : 'Your workspace · PKT'}</div>
      </div>
    );
  };

  const persistErr = getPersistError();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-[72px] lg:block xl:w-[252px]">{renderSidebar(true)}</aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-forest-950/50 backdrop-blur-sm" />
          <div className="absolute inset-y-2 left-2 w-[280px] animate-pop" onClick={(e) => e.stopPropagation()}>
            {renderSidebar(false)}
          </div>
        </div>
      )}
      <div className="overflow-x-clip lg:pl-[96px] xl:pl-[276px]">
        <TopBar user={user} unread={unread} onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        {persistErr && <div className="mx-4 mt-2 rounded-xl bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">{persistErr}</div>}
        <main key={loc.pathname} className="page-enter mx-auto max-w-[1320px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-14">{children}</main>
      </div>
      <MobileNav user={user} unread={unread} myTaskCount={myTaskCount} onMenu={() => setDrawer(true)} />
      {palette && <CommandPalette user={user} items={items} onClose={() => setPalette(false)} />}
    </div>
  );
}

function Dateline() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  return (
    <span className="hidden items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500 xl:flex">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-forest-500" />
      {g('weekday')} {g('day')} {g('month')} · {g('hour')}:{g('minute')} PKT
    </span>
  );
}

function TopBar({ user, unread, onMenu, onSearch }: { user: User; unread: number; onMenu: () => void; onSearch: () => void }) {
  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-4 lg:px-5">
      <div className="mx-auto flex h-[60px] max-w-[1320px] items-center gap-3 rounded-[20px] border border-white/60 bg-ivory-50/70 px-3 shadow-[0_10px_30px_-24px_rgba(16,41,31,.5)] backdrop-blur-xl backdrop-saturate-150 sm:px-4">
        <button onClick={onMenu} className="rounded-full p-2 text-ink-700 hover:bg-ivory-200 lg:hidden" aria-label="Open menu">
          <Menu size={20} />
        </button>
        <Link to="/" className="whitespace-nowrap font-serif text-[21px] text-forest-900 lg:hidden">Maintenance <em>Hub</em></Link>
        <button onClick={onSearch} className="group hidden h-10 w-full max-w-[420px] items-center gap-2.5 rounded-full bg-white/80 pl-3.5 pr-2 text-left text-sm text-ink-400 ring-1 ring-inset ring-ivory-300 transition hover:ring-gold-300 md:flex">
          <Search size={15} className="text-ink-500" />
          <span className="flex-1">Search assets, serials, work orders, people…</span>
          <kbd className="rounded-md border border-ivory-300 bg-ivory-50 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-500">⌘K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Dateline />
          <button onClick={onSearch} className="rounded-full p-2 text-ink-700 hover:bg-ivory-200 md:hidden" aria-label="Search">
            <Search size={19} />
          </button>
          <Link to="/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-ink-800 ring-1 ring-inset ring-ivory-300 transition hover:ring-gold-300" aria-label="Notifications">
            <Bell size={17} />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-700 px-1 font-mono text-[10px] text-white ring-2 ring-ivory-50">{unread}</span>}
          </Link>
          <UserSwitcher user={user} />
        </div>
      </div>
    </header>
  );
}

const ROLE_ORDER: RoleKey[] = ['technician', 'supervisor', 'manager', 'requester', 'admin'];

function UserSwitcher({ user }: { user: User }) {
  const db = useDb();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-white/80">
        <Avatar name={user.name} size={34} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[13px] font-medium text-ink-900">{user.name}</span>
          <span className="block text-[11px] text-ink-500">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown size={14} className="text-ink-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 animate-pop overflow-hidden rounded-[20px] border border-ivory-300 bg-ivory-50/95 shadow-lift backdrop-blur-xl">
          <div className="flex items-center gap-2 px-4 pb-2 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-gold-700">
            <Repeat size={12} /> {getMode() === 'demo' ? 'Demo · switch user' : 'Switch user · presentation'}
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-1.5 pb-1.5">
            {ROLE_ORDER.map((r) =>
              db.users.filter((u) => u.role === r && u.status === 'active').map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    login(u.id);
                    setOpen(false);
                    nav('/');
                  }}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white', u.id === user.id && 'bg-white ring-1 ring-gold-200')}
                >
                  <Avatar name={u.name} size={30} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13px] font-medium text-ink-900">{u.name}</span>
                    <span className="block truncate text-[11px] text-ink-500">{u.designation}</span>
                  </span>
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-400">{r}</span>
                </button>
              )),
            )}
          </div>
          <button
            onClick={() => {
              switchWorkspace(getMode() === 'demo' ? 'live' : 'demo');
              nav('/');
            }}
            className="flex w-full items-center gap-2 border-t border-ivory-200 px-4 py-3 text-sm text-ink-700 hover:bg-white"
          >
            <Repeat size={16} /> {getMode() === 'demo' ? 'Go to my own workspace' : 'Open the demo workspace'}
          </button>
          <button
            onClick={() => {
              logout();
              nav('/');
            }}
            className="flex w-full items-center gap-2 border-t border-ivory-200 px-4 py-3 text-sm text-ink-700 hover:bg-white"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

type Cmd = { id: string; group: string; title: string; sub?: string; to: string; icon?: ReactNode };

function CommandPalette({ user, items, onClose }: { user: User; items: NavItem[]; onClose: () => void }) {
  const db = useDb();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo<Cmd[]>(() => {
    const s = q.trim().toLowerCase();
    const out: Cmd[] = [];
    const pages = items.filter((n) => !s || n.label.toLowerCase().includes(s)).map((n) => ({ id: 'p' + n.to, group: 'Go to', title: n.label, to: n.to, icon: n.icon }));
    if (!s) {
      out.push(...pages.slice(0, 6));
      if (can(user, 'fault.report')) out.unshift({ id: 'a-fault', group: 'Actions', title: 'Report a fault', sub: 'Log a breakdown or request', to: '/report-fault', icon: <Siren size={16} /> });
      if (can(user, 'wo.create')) out.unshift({ id: 'a-new', group: 'Actions', title: 'New work order', sub: 'Create and assign work', to: '/work-orders/new', icon: <Wrench size={16} /> });
      return out;
    }
    if (can(user, 'asset.view'))
      db.assets.filter((a) => [a.code, a.name, a.serial, a.category, a.manufacturer].join(' ').toLowerCase().includes(s)).slice(0, 5).forEach((a) => out.push({ id: a.id, group: 'Assets', title: `${a.code} · ${a.name}`, sub: `S/N ${a.serial}`, to: `/assets/${a.id}`, icon: <Gauge size={16} /> }));
    db.workOrders.filter((w) => canViewWO(user, w) && [w.number, w.title].join(' ').toLowerCase().includes(s)).slice(0, 6).forEach((w) => out.push({ id: w.id, group: 'Work orders', title: w.title, sub: `${w.number} · ${w.status.replace('_', ' ')}`, to: `/work-orders/${w.id}`, icon: <Wrench size={16} /> }));
    if (can(user, 'employee.view'))
      db.users.filter((u) => [u.name, u.employeeId, u.designation].join(' ').toLowerCase().includes(s)).slice(0, 4).forEach((u) => out.push({ id: u.id, group: 'People', title: u.name, sub: u.designation, to: `/team?u=${u.id}`, icon: <Users size={16} /> }));
    if (can(user, 'asset.view'))
      db.locations.filter((l) => l.name.toLowerCase().includes(s)).slice(0, 3).forEach((l) => out.push({ id: l.id, group: 'Locations', title: l.name, sub: l.type, to: `/locations?l=${l.id}`, icon: <MapPin size={16} /> }));
    out.push(...pages.slice(0, 4));
    return out;
  }, [q, db, user, items]);

  useEffect(() => setI(0), [q]);
  const go = (c?: Cmd) => {
    if (!c) return;
    nav(c.to);
    onClose();
  };
  const groups = Array.from(new Set(results.map((r) => r.group)));

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center bg-forest-950/40 px-3 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-xl animate-pop overflow-hidden rounded-[24px] border border-white/60 bg-ivory-50/95 shadow-2xl backdrop-blur-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-ivory-200 px-5">
          <Search size={18} className="text-ink-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(results.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
              if (e.key === 'Enter') go(results[i]);
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Search or jump to…  try “GEN-001”, “freezer”, “Bilal”"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-400"
            aria-label="Command search"
          />
          <kbd className="rounded-md border border-ivory-300 bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-ink-500">ESC</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 && <div className="px-4 py-10 text-center text-sm text-ink-500">Nothing matches “{q}”.</div>}
          {groups.map((g) => (
            <div key={g} className="mb-1">
              <div className="px-3 pb-1 pt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-400">{g}</div>
              {results.filter((r) => r.group === g).map((r) => {
                const idx = results.indexOf(r);
                return (
                  <button key={r.group + r.id} onMouseEnter={() => setI(idx)} onClick={() => go(r)} className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', idx === i ? 'bg-forest-900 text-ivory-50' : 'text-ink-800 hover:bg-white')}>
                    <span className={idx === i ? 'text-gold-300' : 'text-ink-500'}>{r.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      {r.sub && <span className={cx('block truncate text-xs capitalize', idx === i ? 'text-ivory-200/70' : 'text-ink-500')}>{r.sub}</span>}
                    </span>
                    {idx === i ? <CornerDownLeft size={14} className="text-gold-300" /> : <ArrowRight size={14} className="text-ink-300" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-ivory-200 px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-400">
          <span>↑↓ navigate</span><span>↵ open</span><span className="ml-auto">⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}

function MobileNav({ user, unread, myTaskCount, onMenu }: { user: User; unread: number; myTaskCount: number; onMenu: () => void }) {
  const items =
    user.role === 'technician'
      ? [
          { to: '/', label: 'My day', icon: <LayoutDashboard size={20} /> },
          { to: '/tasks', label: 'Tasks', icon: <ClipboardList size={20} />, badge: myTaskCount },
          { to: '/scan', label: 'Scan', icon: <QrCode size={20} /> },
          { to: '/report-fault', label: 'Fault', icon: <Siren size={20} /> },
        ]
      : user.role === 'requester'
        ? [
            { to: '/', label: 'Home', icon: <LayoutDashboard size={20} /> },
            { to: '/requests', label: 'Requests', icon: <Inbox size={20} /> },
            { to: '/report-fault', label: 'Report', icon: <Siren size={20} /> },
            { to: '/notifications', label: 'Alerts', icon: <Bell size={20} />, badge: unread },
          ]
        : [
            { to: '/', label: 'Home', icon: <LayoutDashboard size={20} /> },
            can(user, 'wo.review') ? { to: '/approvals', label: 'Approvals', icon: <ShieldCheck size={20} /> } : { to: '/assets', label: 'Assets', icon: <Gauge size={20} /> },
            { to: '/work-orders', label: 'Work', icon: <Wrench size={20} /> },
            { to: '/notifications', label: 'Alerts', icon: <Bell size={20} />, badge: unread },
          ];
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 rounded-[22px] border border-white/10 bg-forest-900/95 pb-[env(safe-area-inset-bottom)] shadow-[0_20px_40px_-20px_rgba(13,35,26,.8)] backdrop-blur-xl lg:hidden">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0,1fr))` }}>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => cx('relative flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium transition', isActive ? 'text-gold-300' : 'text-ivory-200/60')}>
            {it.icon}
            {it.label}
            {!!it.badge && <span className="absolute right-[22%] top-1.5 rounded-full bg-gold-400 px-1 font-mono text-[9.5px] text-forest-950">{it.badge}</span>}
          </NavLink>
        ))}
        <button onClick={onMenu} className="flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium text-ivory-200/60">
          <Menu size={20} />
          More
        </button>
      </div>
    </nav>
  );
}
