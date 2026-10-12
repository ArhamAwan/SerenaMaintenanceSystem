import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { assetById, isFieldVisible, locationPath, submissionsFor, templateFields, useCurrentUser, useDb, userById } from '../lib/store';
import { canViewWO } from '../lib/permissions';
import { TYPE_LABEL } from '../lib/meta';
import { rangeText } from '../lib/rules';
import { durationMin, fmtDateTime, fmtDuration } from '../lib/time';
import { Button, EmptyState } from '../components/ui';

export default function PrintReport() {
  const { id } = useParams();
  const db = useDb();
  const user = useCurrentUser()!;
  const nav = useNavigate();
  const wo = db.workOrders.find((w) => w.id === id);
  if (!wo || !canViewWO(user, wo)) return <div className="p-8"><EmptyState title="Report unavailable" /></div>;
  const asset = assetById(db, wo.assetId);
  const subs = submissionsFor(db, wo.id);
  const reviews = db.reviews.filter((r) => r.woId === wo.id);
  const finalStatus = wo.status === 'closed' ? 'FINALISED' : wo.status === 'completed' ? 'APPROVED' : wo.status === 'submitted' ? 'SUBMITTED — PENDING REVIEW' : wo.status === 'rework' ? 'RETURNED FOR REWORK' : 'DRAFT / IN PROGRESS';
  const events = db.audit.filter((e) => e.entityId === wo.id).sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="min-h-screen bg-ivory-200 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-between px-4">
        <Button onClick={() => nav(-1)}><ArrowLeft size={16} />Back</Button>
        <Button variant="primary" onClick={() => window.print()}><Printer size={16} />Print / Save as PDF</Button>
      </div>
      <article className="print-page mx-auto max-w-[210mm] bg-white p-[14mm] text-[12px] leading-relaxed text-ink-900 shadow-xl">
        <header className="flex items-start justify-between border-b-2 border-forest-800 pb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-700">Islamabad Serena Hotel · Engineering Department</div>
            <h1 className="mt-1 font-serif text-[26px] font-semibold leading-tight text-forest-900">{TYPE_LABEL[wo.type]} Report</h1>
            <div className="text-[13px] font-medium">{wo.title}</div>
          </div>
          <div className="text-right">
            <div className="font-serif text-[25px] leading-tight text-forest-900">{wo.number}</div>
            <div className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${wo.status === 'closed' || wo.status === 'completed' ? 'bg-forest-800 text-white' : 'bg-gold-200 text-gold-900'}`}>{finalStatus}</div>
            <div className="mt-1 text-[10px] text-ink-500">Generated {fmtDateTime(new Date().toISOString())} by {user.name}</div>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
          {[
            ['Asset', asset ? `${asset.code} — ${asset.name}` : '—'],
            ['Serial / model', asset ? `${asset.serial} · ${asset.manufacturer} ${asset.model}` : '—'],
            ['Location', locationPath(db, wo.locationId)],
            ['Priority', wo.priority.toUpperCase()],
            ['Lead technician', userById(db, wo.leadTechId)?.name ?? '—'],
            ['Supporting', wo.helperIds.map((h) => userById(db, h)?.name).join(', ') || '—'],
            ['Supervisor', userById(db, wo.supervisorId)?.name],
            ['Requested by', userById(db, wo.requestedById)?.name],
            ['Planned', `${fmtDateTime(wo.scheduledFor)} → due ${fmtDateTime(wo.dueAt)}`],
            ['Actual', `${fmtDateTime(wo.startedAt)} → ${fmtDateTime(wo.submittedAt)}`],
            ['Approved', fmtDateTime(wo.completedAt)],
            ['Rework cycles', String(wo.reworkCount)],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2 border-b border-ivory-200 py-1"><span className="w-28 shrink-0 text-ink-500">{k}</span><span className="font-medium">{v}</span></div>
          ))}
        </section>

        {subs.map((s) => {
          const fields = templateFields(db, s.templateId, s.templateVersion).filter((f) => f.type !== 'photo' && isFieldVisible(f, s.answers));
          const rv = reviews.filter((r) => r.submissionId === s.id);
          return (
            <section key={s.id} className="mt-6 break-inside-avoid-page">
              <h2 className="border-b border-ivory-300 pb-1 font-serif text-[22px] leading-tight text-forest-900">Submission v{s.version} <span className="text-[11px] font-normal text-ink-500">· {userById(db, s.submittedById)?.name} · {fmtDateTime(s.submittedAt)} · time on task {fmtDuration(durationMin(s.startedAt, s.submittedAt))} · checklist v{s.templateVersion}</span></h2>
              <table className="mt-2 w-full border-collapse">
                <thead><tr className="bg-ivory-100 text-left text-[10px] uppercase tracking-wider text-ink-500"><th className="px-2 py-1">Item</th><th className="px-2 py-1">Recorded value</th><th className="px-2 py-1">Normal range</th><th className="px-2 py-1">Flag</th></tr></thead>
                <tbody>
                  {fields.map((f) => {
                    const fl = s.flags.find((x) => x.fieldId === f.id);
                    const v = s.answers[f.id];
                    return (
                      <tr key={f.id} className="border-b border-ivory-200">
                        <td className="px-2 py-1">{f.label}</td>
                        <td className="px-2 py-1 font-medium">{v === null || v === undefined || v === '' ? '—' : `${v}${f.unit && f.type === 'number' ? ' ' + f.unit : ''}`}</td>
                        <td className="px-2 py-1 text-ink-500">{rangeText(f)}</td>
                        <td className={`px-2 py-1 font-bold ${fl?.level === 'critical' ? 'text-rose-700' : 'text-amber-700'}`}>{fl ? fl.level.toUpperCase() : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {s.notes && <p className="mt-2"><b>Technician notes:</b> {s.notes}</p>}
              {s.partsUsed && <p><b>Parts used:</b> {s.partsUsed}</p>}
              {s.photos.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {s.photos.map((p) => <figure key={p.id} className="break-inside-avoid"><img src={p.dataUrl} alt="" className="aspect-[4/3] w-full rounded object-cover" /><figcaption className="text-[9px] text-ink-500">{p.caption} · {p.stage} · {fmtDateTime(p.at)}</figcaption></figure>)}
                </div>
              )}
              {rv.map((r) => (
                <div key={r.id} className={`mt-2 rounded border px-3 py-2 ${r.decision === 'approved' ? 'border-forest-300 bg-forest-50' : 'border-orange-300 bg-orange-50'}`}>
                  <b>{r.decision === 'approved' ? 'APPROVED' : r.decision === 'evidence' ? 'ADDITIONAL EVIDENCE REQUESTED' : 'REWORK REQUESTED'}</b> by {userById(db, r.reviewerId)?.name} on {fmtDateTime(r.at)}{r.comment && <> — “{r.comment}”</>}
                </div>
              ))}
            </section>
          );
        })}

        <section className="mt-6 break-inside-avoid">
          <h2 className="border-b border-ivory-300 pb-1 font-serif text-[22px] leading-tight text-forest-900">Audit trail</h2>
          <ol className="mt-2 space-y-0.5 text-[10.5px]">
            {events.map((e) => <li key={e.id}><span className="text-ink-500">{fmtDateTime(e.at)}</span> — {e.action} — {e.actorId === 'system' ? 'System' : userById(db, e.actorId)?.name}{e.reason ? ` — “${e.reason}”` : ''}</li>)}
          </ol>
        </section>

        <footer className="mt-8 grid grid-cols-2 gap-10 pt-6 text-[10px] text-ink-500">
          <div className="border-t border-ink-400 pt-1">Technician</div>
          <div className="border-t border-ink-400 pt-1">Supervisor approval</div>
        </footer>
        <div className="mt-4 text-center text-[9px] text-ink-400">Serena Maintenance Hub · demonstration data · {wo.number}</div>
      </article>
    </div>
  );
}
