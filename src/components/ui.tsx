import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { X, CheckCircle2, AlertTriangle, Info, Lock } from 'lucide-react';
import { CONDITION_META, PRIORITY_META, STATUS_META } from '../lib/meta';
import type { Condition, Priority, WOStatus, WorkOrder } from '../lib/types';
import { isOverdue } from '../lib/store';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------- buttons
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'success';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-forest-900 text-ivory-50 hover:bg-forest-800 shadow-[0_1px_0_rgba(255,255,255,.08)_inset,0_8px_18px_-10px_rgba(19,52,38,.7)]',
  secondary: 'bg-white/90 text-ink-900 ring-1 ring-inset ring-ivory-300 hover:bg-white hover:ring-gold-300',
  ghost: 'text-ink-700 hover:bg-ivory-200/70',
  danger: 'bg-white text-rose-800 ring-1 ring-inset ring-rose-200 hover:bg-rose-50',
  gold: 'bg-gold-400 text-forest-950 hover:bg-gold-300 shadow-[0_8px_18px_-10px_rgba(166,130,63,.8)]',
  success: 'bg-forest-700 text-white hover:bg-forest-600 shadow-sm',
};
const SIZE = { sm: 'h-8 px-3 text-xs rounded-full', md: 'h-10 px-4 text-sm rounded-full', lg: 'h-12 px-5 text-[15px] rounded-2xl' };

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button {...rest} className={cx('inline-flex items-center justify-center gap-2 font-medium transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50', BTN[variant], SIZE[size], className)}>
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'secondary', size = 'md', className, children }: { to: string; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cx('inline-flex items-center justify-center gap-2 font-medium transition duration-200 active:scale-[0.98]', BTN[variant], SIZE[size], className)}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------- type
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500', className)}>{children}</div>;
}

// ---------------------------------------------------------------- surfaces
export function Card({ className, children, title, action, pad = true }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx('rounded-[20px] border border-ivory-200 bg-white shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
          <h3 className="font-serif text-[23px] leading-tight text-forest-900">{title}</h3>
          {action}
        </header>
      )}
      <div className={pad ? 'p-5 pt-3' : 'pt-2'}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2 text-gold-700">{eyebrow}</Eyebrow>}
        <h1 className="font-serif text-[2.6rem] leading-[0.98] text-forest-900 sm:text-[3.4rem]">{title}</h1>
        {subtitle && <p className="mt-2.5 max-w-2xl text-[14px] text-ink-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Animated number (count-up on mount / change) */
export function CountUp({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setV(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{v.toFixed(decimals)}{suffix}</>;
}

export function Sparkline({ data, color = '#1F4D38', w = 112, h = 36 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const r = max - min || 1;
  const pts = data.map((d, i) => [(i / (data.length - 1)) * (w - 6) + 3, h - 4 - ((d - min) / r) * (h - 8)]);
  const line = pts.map((p) => p.join(',')).join(' ');
  const id = `sg${color.replace('#', '')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`3,${h} ${line} ${w - 3},${h}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function Stat({ label, value, hint, tone = 'default', to, icon, spark, chip, chipTone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'warn' | 'bad' | 'good'; to?: string; icon?: ReactNode; spark?: number[]; chip?: ReactNode; chipTone?: 'good' | 'bad' | 'warn' }) {
  const toneCls = { default: 'text-forest-900', warn: 'text-gold-800', bad: 'text-rose-800', good: 'text-forest-700' }[tone];
  const sparkColor = { default: '#1F4D38', warn: '#A6823F', bad: '#B4432E', good: '#2A6247' }[tone];
  const chipCls = chipTone === 'bad' ? 'bg-rose-50 text-rose-800' : chipTone === 'good' ? 'bg-forest-50 text-forest-700' : 'bg-gold-50 text-gold-800';
  const inner = (
    <div className="group flex h-full flex-col gap-2 rounded-[20px] border border-ivory-200 bg-white p-4 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-lift sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>{label}</Eyebrow>
        {chip ? <span className={cx('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', chipCls)}>{chip}</span> : icon && <span className="text-gold-500 transition group-hover:text-gold-600">{icon}</span>}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className={cx('min-w-0 whitespace-nowrap text-[2rem] font-medium leading-none tracking-[-0.03em] tabular-nums sm:text-[2.4rem]', toneCls)}>{value}</div>
        {spark && <span className="ml-auto hidden sm:block"><Sparkline data={spark} color={sparkColor} /></span>}
      </div>
      {hint && <div className="text-xs text-ink-500">{hint}</div>}
    </div>
  );
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
}

export function Ring({ value, size = 164, stroke = 14, color = '#D9BC80', track = 'rgba(255,255,255,.10)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setP(value), 60);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-ivory-300 bg-ivory-50/70 px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gold-600 shadow-card">{icon}</div>}
      <div className="font-serif text-[26px] leading-tight text-forest-900">{title}</div>
      {body && <p className="mt-1.5 max-w-sm text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Unauthorized({ message = 'Your role does not have access to this page.' }: { message?: string }) {
  return <EmptyState icon={<Lock size={24} />} title="Access restricted" body={message} action={<LinkButton to="/">Back to dashboard</LinkButton>} />;
}

// ---------------------------------------------------------------- badges
export function StatusBadge({ status, wo }: { status: WOStatus; wo?: WorkOrder }) {
  const m = STATUS_META[status];
  const overdue = wo && isOverdue(wo);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium ring-1 ring-inset', m.cls)}>
        <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} />
        {wo?.status === 'on_hold' && wo.holdReason?.startsWith('Awaiting parts') ? 'Awaiting parts' : m.label}
      </span>
      {overdue && <span className="whitespace-nowrap rounded-full bg-rose-700 px-2 py-[3px] font-mono text-[10px] uppercase tracking-wider text-white">Overdue</span>}
    </span>
  );
}

export function PriorityBadge({ p }: { p: Priority }) {
  const m = PRIORITY_META[p];
  return <span className={cx('whitespace-nowrap rounded-md px-1.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.08em]', m.cls)}>{m.label}</span>;
}

export function ConditionBadge({ c }: { c: Condition }) {
  const m = CONDITION_META[c];
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium ring-1 ring-inset', m.cls)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ivory-200/80 px-2.5 py-[3px] text-xs text-ink-700', className)}>{children}</span>;
}

export function Avatar({ name, size = 32 }: { name?: string; size?: number }) {
  const initials = (name ?? '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  const palettes = [
    ['#E9E1CD', '#133426'],
    ['#DCEBE1', '#173D2C'],
    ['#F5EBD3', '#6B4F1D'],
    ['#E6E8DD', '#2A3B30'],
  ];
  const [bg, fg] = palettes[h % palettes.length];
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white" style={{ width: size, height: size, fontSize: size * 0.36, background: bg, color: fg }}>
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------- forms
export function Field({ label, hint, error, required, children, className }: { label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-800">
        {label}
        {required && <span className="ml-0.5 text-rose-700">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-rose-700">{error}</span>}
    </div>
  );
}

const inputCls = 'block w-full rounded-xl border-0 bg-ivory-50 px-3.5 py-2.5 text-sm text-ink-900 ring-1 ring-inset ring-ivory-300 transition placeholder:text-ink-400 hover:ring-gold-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-700';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, 'pr-8', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx(inputCls, p.className)} />;

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T | ''; onChange: (v: T) => void; options: { value: T; label: string; tone?: 'good' | 'bad' }[]; className?: string }) {
  return (
    <div className={cx('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const active = value === o.value;
        const tone = o.tone === 'bad' ? 'bg-rose-800 text-white ring-rose-800' : 'bg-forest-900 text-white ring-forest-900';
        return (
          <button type="button" key={o.value} aria-pressed={active} onClick={() => onChange(o.value)} className={cx('h-12 rounded-2xl text-[15px] font-medium ring-1 ring-inset transition duration-200 active:scale-[0.98]', active ? cx(tone, 'shadow-[0_8px_16px_-10px_rgba(19,52,38,.8)]') : 'bg-white text-ink-700 ring-ivory-300 hover:ring-gold-300')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- modal
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={cx('max-h-[92vh] w-full animate-pop overflow-y-auto rounded-t-[28px] bg-ivory-50 shadow-2xl ring-1 ring-ivory-300 sm:rounded-[28px]', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between bg-ivory-50/90 px-6 pb-3 pt-5 backdrop-blur">
          <h2 className="font-serif text-[28px] leading-tight text-forest-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-ink-500 transition hover:bg-ivory-200" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-6 pb-5 pt-1">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-ivory-200 bg-ivory-50/95 px-6 py-4 backdrop-blur">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- toasts
type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string };
let toasts: Toast[] = [];
let tv = 0;
const tl = new Set<() => void>();
export function toast(text: string, kind: Toast['kind'] = 'success') {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, kind, text }];
  tv++;
  tl.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    tv++;
    tl.forEach((l) => l());
  }, kind === 'error' ? 6000 : 3800);
}
export function Toaster() {
  useSyncExternalStore((cb) => (tl.add(cb), () => tl.delete(cb)), () => tv);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:bottom-6 sm:left-auto sm:right-6 sm:top-auto sm:items-end">
      {toasts.map((t) => (
        <div key={t.id} className={cx('pointer-events-auto flex max-w-md animate-pop items-start gap-2.5 rounded-2xl px-4 py-3 text-sm shadow-lift ring-1 backdrop-blur', t.kind === 'error' ? 'bg-rose-50/95 text-rose-900 ring-rose-200' : t.kind === 'info' ? 'bg-white/95 text-ink-800 ring-ivory-300' : 'bg-forest-900/95 text-ivory-50 ring-forest-800')}>
          {t.kind === 'error' ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : t.kind === 'info' ? <Info size={18} className="mt-0.5 shrink-0 text-gold-600" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-gold-300" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Run a store action; show rule violations as an error toast instead of crashing. Returns true on success. */
export function attempt(fn: () => unknown, success?: string): boolean {
  try {
    fn();
    if (success) toast(success);
    return true;
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'error');
    return false;
  }
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="inline-flex gap-1 rounded-full bg-ivory-200/80 p-1">
        {tabs.map((t) => (
          <button key={t.value} onClick={() => onChange(t.value)} className={cx('whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition duration-200', value === t.value ? 'bg-white text-forest-900 shadow-[0_1px_2px_rgba(16,41,31,.12)]' : 'text-ink-600 hover:text-ink-900')}>
            {t.label}
            {t.count !== undefined && <span className={cx('ml-1.5 rounded-full px-1.5 py-px font-mono text-[10.5px]', value === t.value ? 'bg-forest-900 text-white' : 'bg-white/70 text-ink-600')}>{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ivory-200/70 py-2.5 text-sm last:border-0">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right font-medium text-ink-900">{v}</dd>
    </div>
  );
}
