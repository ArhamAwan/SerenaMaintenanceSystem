import { useState } from 'react';
import { AlertTriangle, Check, X as XIcon } from 'lucide-react';
import type { Db, Photo, Review, Submission } from '../lib/types';
import { isFieldVisible, templateFields, userById } from '../lib/store';
import { fmtDateTime, durationMin, fmtDuration } from '../lib/time';
import { rangeText } from '../lib/rules';
import { cx, Modal } from './ui';

export function PhotoGrid({ photos, cols = 3 }: { photos: Photo[]; cols?: number }) {
  const [open, setOpen] = useState<Photo | null>(null);
  if (!photos.length) return <div className="text-sm text-ink-500">No photos.</div>;
  return (
    <>
      <div className={cx('grid gap-2', cols === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => setOpen(p)} className="group overflow-hidden rounded-lg border border-ivory-300 bg-ivory-100 text-left">
            <img src={p.dataUrl} alt={p.caption} className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]" />
            <div className="px-2 py-1.5">
              <div className="truncate text-xs font-medium text-ink-800">{p.caption || 'Photo'}</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500">{p.stage} · {fmtDateTime(p.at)}</div>
            </div>
          </button>
        ))}
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.caption || 'Photo'} wide>
        {open && (
          <>
            <img src={open.dataUrl} alt={open.caption} className="w-full rounded-lg" />
            <div className="text-xs text-ink-500">Stage: {open.stage} · Uploaded {fmtDateTime(open.at)}</div>
          </>
        )}
      </Modal>
    </>
  );
}

export function SubmissionView({ db, sub, compact, highlightFlags = true }: { db: Db; sub: Submission; compact?: boolean; highlightFlags?: boolean }) {
  const fields = templateFields(db, sub.templateId, sub.templateVersion);
  const flagFor = (id: string) => sub.flags.find((f) => f.fieldId === id);
  const nonPhoto = fields.filter((f) => f.type !== 'photo' && isFieldVisible(f, sub.answers));
  const extraPhotos = sub.photos;
  const by = userById(db, sub.submittedById);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
        <span>Submitted by <b className="text-ink-700">{by?.name}</b></span>
        <span>{fmtDateTime(sub.submittedAt)}</span>
        <span>Time on task: {fmtDuration(durationMin(sub.startedAt, sub.submittedAt))}</span>
        {sub.templateVersion && <span>Checklist v{sub.templateVersion}</span>}
      </div>
      <dl className="divide-y divide-ivory-200 rounded-lg border border-ivory-200">
        {nonPhoto.map((f) => {
          const v = sub.answers[f.id];
          const flag = highlightFlags ? flagFor(f.id) : undefined;
          const empty = v === null || v === undefined || v === '';
          return (
            <div key={f.id} className={cx('flex items-start justify-between gap-4 px-3 py-2 text-sm', flag?.level === 'critical' ? 'bg-rose-50' : flag ? 'bg-amber-50' : '')}>
              <dt className="text-ink-600">{f.label}</dt>
              <dd className={cx('text-right font-medium', empty ? 'text-ink-400' : 'text-ink-900')}>
                {empty ? '—' : f.type === 'passfail' ? (
                  <span className={cx('inline-flex items-center gap-1', v === 'Pass' ? 'text-forest-700' : 'text-rose-700')}>{v === 'Pass' ? <Check size={14} /> : <XIcon size={14} />}{v}</span>
                ) : (
                  <>{String(v)}{f.unit && f.type === 'number' ? ` ${f.unit}` : ''}</>
                )}
                {flag && <span className={cx('ml-2 inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-bold uppercase', flag.level === 'critical' ? 'bg-rose-600 text-white' : 'bg-amber-200 text-amber-900')}><AlertTriangle size={10} />{flag.level}</span>}
                {f.type === 'number' && (f.normalMin !== undefined || f.normalMax !== undefined) && !compact && (
                  <div className="text-[11px] font-normal text-ink-400">normal {rangeText(f)}</div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {sub.notes && <div className="rounded-lg bg-ivory-50 px-3 py-2 text-sm text-ink-700 ring-1 ring-ivory-200"><span className="font-medium">Notes: </span>{sub.notes}</div>}
      {sub.partsUsed && <div className="text-sm text-ink-700"><span className="font-medium">Parts used: </span>{sub.partsUsed}</div>}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Evidence ({extraPhotos.length})</div>
        <PhotoGrid photos={extraPhotos} />
      </div>
    </div>
  );
}

export function ReviewNote({ db, r }: { db: Db; r: Review }) {
  const reviewer = userById(db, r.reviewerId);
  const tone = r.decision === 'approved' ? 'border-forest-200 bg-forest-50 text-forest-900' : 'border-orange-200 bg-orange-50 text-orange-950';
  const label = r.decision === 'approved' ? 'Approved' : r.decision === 'evidence' ? 'More evidence requested' : 'Rework requested';
  return (
    <div className={cx('rounded-lg border px-4 py-3 text-sm', tone)}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        {label} on v{r.version}
        <span className="font-normal normal-case tracking-normal opacity-80">· {reviewer?.name} · {fmtDateTime(r.at)}</span>
      </div>
      {r.comment && <p className="mt-1">{r.comment}</p>}
      {r.newDueAt && r.decision !== 'approved' && <p className="mt-1 text-xs opacity-80">New deadline: {fmtDateTime(r.newDueAt)}</p>}
    </div>
  );
}
