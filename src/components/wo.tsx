import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Clock, RotateCcw, User as UserIcon, ChevronRight, AlertTriangle } from 'lucide-react';
import type { Db, WorkOrder, AuditEvent } from '../lib/types';
import { assetById, isOverdue, locationPath, userById } from '../lib/store';
import { fmtDateTime, fmtDateShort, fmtTime, relative, pkDate } from '../lib/time';
import { TYPE_LABEL } from '../lib/meta';
import { Avatar, cx, EmptyState, PriorityBadge, StatusBadge } from './ui';

export function WOTable({ db, rows, empty = 'No work orders match these filters.' }: { db: Db; rows: WorkOrder[]; empty?: string }) {
  const nav = useNavigate();
  if (!rows.length) return <EmptyState title="Nothing here" body={empty} />;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[20px] border border-ivory-200 bg-white shadow-card md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th>Work order</th>
              <th>Asset / location</th>
              <th className="hidden xl:table-cell">Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => {
              const a = assetById(db, w.assetId);
              const lead = userById(db, w.leadTechId);
              return (
                <tr key={w.id} className="row-link" onClick={() => nav(`/work-orders/${w.id}`)}>
                  <td>
                    <div className="min-w-[200px] max-w-[340px] font-medium leading-snug text-ink-900">{w.title}</div>
                    <div className="font-mono text-[11px] text-ink-500">{w.number}{w.reworkCount > 0 && <span className="ml-2 text-orange-700">↻ {w.reworkCount} rework</span>}</div>
                  </td>
                  <td>
                    <div className="font-mono text-[12.5px] text-ink-900">{a ? a.code : '—'}</div>
                    <div className="max-w-[180px] truncate text-xs text-ink-500">{locationPath(db, w.locationId).split(' › ').slice(-1)[0]}</div>
                  </td>
                  <td className="hidden text-ink-700 xl:table-cell">{TYPE_LABEL[w.type]}</td>
                  <td><PriorityBadge p={w.priority} /></td>
                  <td><StatusBadge status={w.status} wo={w} /></td>
                  <td>
                    {lead ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={lead.name} size={24} />
                        <span className="whitespace-nowrap text-ink-800">{lead.name}{w.helperIds.length ? <span className="text-ink-500"> +{w.helperIds.length}</span> : null}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-rose-700">Unassigned</span>
                    )}
                  </td>
                  <td className={cx('whitespace-nowrap', isOverdue(w) ? 'font-medium text-rose-700' : 'text-ink-700')}>
                    {fmtDateShort(w.dueAt)}, {fmtTime(w.dueAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2.5 md:hidden">
        {rows.map((w) => (
          <TaskCard key={w.id} db={db} w={w} />
        ))}
      </div>
    </>
  );
}

export function TaskCard({ db, w, to }: { db: Db; w: WorkOrder; to?: string }) {
  const a = assetById(db, w.assetId);
  const overdue = isOverdue(w);
  const urgent = overdue || w.priority === 'critical';
  const start = new Date(w.createdAt).getTime();
  const due = new Date(w.dueAt).getTime();
  const pct = Math.max(4, Math.min(100, ((Date.now() - start) / Math.max(1, due - start)) * 100));
  return (
    <Link to={to ?? `/work-orders/${w.id}`} className={cx('group block rounded-[20px] border bg-white p-4 shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.99]', urgent ? 'border-rose-200' : w.status === 'rework' ? 'border-gold-300' : 'border-ivory-200 hover:border-gold-300')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge p={w.priority} />
            <span className="font-mono text-[11px] text-ink-500">{w.number}</span>
          </div>
          <div className="mt-2 text-[16px] font-medium leading-snug text-ink-900">{w.title}</div>
          {a && <div className="mt-0.5 text-[13px] text-ink-600"><span className="font-mono text-ink-800">{a.code}</span> · {a.name}</div>}
        </div>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ivory-100 text-ink-500 transition group-hover:bg-forest-900 group-hover:text-gold-300"><ChevronRight size={16} /></span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
        <StatusBadge status={w.status} wo={w} />
        <span className="flex items-center gap-1"><MapPin size={13} />{locationPath(db, w.locationId).split(' › ').slice(-1)[0]}</span>
        <span className={cx('flex items-center gap-1', overdue && 'font-semibold text-rose-700')}>
          <Clock size={13} />
          {pkDate(w.dueAt) === pkDate() ? `Due ${fmtTime(w.dueAt)}` : `Due ${fmtDateShort(w.dueAt)} ${fmtTime(w.dueAt)}`}
        </span>
        {w.reworkCount > 0 && <span className="flex items-center gap-1 text-gold-800"><RotateCcw size={13} />Rework ×{w.reworkCount}</span>}
      </div>
      {urgent && !['submitted', 'closed', 'completed'].includes(w.status) && (
        <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-rose-50"><div className="h-full rounded-full bg-rose-600" style={{ width: `${pct}%` }} /></div>
      )}
    </Link>
  );
}

const ACTION_TONE = (a: string) =>
  /approved|confirmed|returned to service/i.test(a) ? 'bg-forest-600' : /rework|evidence|reopen|overdue|escalat/i.test(a) ? 'bg-orange-500' : /fault|cancel/i.test(a) ? 'bg-rose-600' : /submitted/i.test(a) ? 'bg-gold-500' : 'bg-ink-400';

export function Timeline({ db, events }: { db: Db; events: AuditEvent[] }) {
  if (!events.length) return <div className="text-sm text-ink-500">No activity yet.</div>;
  return (
    <ol className="relative space-y-4 border-l border-ivory-300 pl-5">
      {events.map((e) => {
        const actor = e.actorId === 'system' ? null : userById(db, e.actorId);
        return (
          <li key={e.id} className="relative">
            <span className={cx('absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white', ACTION_TONE(e.action))} />
            <div className="text-sm text-ink-900">
              <span className="font-medium">{e.action}</span>
              {e.from && e.to && <span className="text-ink-500"> · {e.from.replace('_', ' ')} → {e.to.replace('_', ' ')}</span>}
              {!e.from && e.to && e.entity !== 'work_order' && <span className="text-ink-500"> · {e.to}</span>}
            </div>
            {e.reason && <div className="mt-0.5 text-sm text-ink-600">“{e.reason}”</div>}
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
              <UserIcon size={11} />
              {actor ? actor.name : 'System scheduler'} · {fmtDateTime(e.at)} <span className="text-ink-400">({relative(e.at)})</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FlagList({ flags }: { flags: { label: string; level: 'warning' | 'critical'; value: string }[] }) {
  if (!flags.length) return null;
  return (
    <div className="space-y-1.5">
      {flags.map((f, i) => (
        <div key={i} className={cx('flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset', f.level === 'critical' ? 'bg-rose-50 text-rose-900 ring-rose-200' : 'bg-amber-50 text-amber-900 ring-amber-200')}>
          <AlertTriangle size={15} className="shrink-0" />
          <span className="font-medium">{f.label}:</span> {f.value}
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider">{f.level}</span>
        </div>
      ))}
    </div>
  );
}
