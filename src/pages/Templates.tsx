import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, GitBranch, Plus, Trash2, Eye, Pencil } from 'lucide-react';
import { latestVersion, saveTemplateVersion, useCurrentUser, useDb, userById } from '../lib/store';
import { can } from '../lib/permissions';
import { attempt, Button, Card, cx, Field, Input, PageHeader, Select, Unauthorized } from '../components/ui';
import { fmtDate } from '../lib/time';
import type { FieldType, TemplateField } from '../lib/types';

const TYPES: { v: FieldType; l: string }[] = [
  { v: 'number', l: 'Measurement / number' },
  { v: 'yesno', l: 'Yes / No' },
  { v: 'passfail', l: 'Pass / Fail' },
  { v: 'select', l: 'Dropdown / choice' },
  { v: 'text', l: 'Text / remarks' },
  { v: 'photo', l: 'Photo upload' },
  { v: 'rating', l: 'Condition rating 1–5' },
];

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

export default function Templates() {
  const user = useCurrentUser()!;
  const db = useDb();
  const [sel, setSel] = useState<string | null>(db.templates[0]?.id ?? null);
  const tpl = db.templates.find((t) => t.id === sel);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (tpl) {
      setName(tpl.name);
      setCategory(tpl.category);
      setDescription(tpl.description);
      setFields(structuredClone(latestVersion(tpl).fields));
    } else {
      setName('');
      setCategory('');
      setDescription('');
      setFields([]);
    }
    setNote('');
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can(user, 'template.manage')) return <Unauthorized />;

  const up = (i: number, patch: Partial<TemplateField>) => setFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => setFields((f) => { const n = [...f]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); return n; });
  const add = () => setFields((f) => [...f, { id: `f_${Math.random().toString(36).slice(2, 7)}`, label: '', type: 'number', required: true }]);

  const save = () => {
    attempt(() => {
      const t = saveTemplateVersion(user, tpl?.id ?? null, { name, category, description }, fields, note);
      setSel(t.id);
    }, tpl ? 'Saved as a new version — existing reports keep their original version' : 'Template created');
  };

  return (
    <div>
      <PageHeader title={<>Inspection <em>templates</em></>} subtitle="Build reusable checklists without code. Every save creates a new immutable version." actions={<Button variant="primary" onClick={() => setSel(null)}><Plus size={16} />New template</Button>} />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-2">
          {db.templates.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className={cx('w-full rounded-xl border p-3 text-left transition', sel === t.id ? 'border-forest-700 bg-forest-50' : 'border-ivory-300 bg-white hover:border-gold-300')}>
              <div className="font-medium text-ink-900">{t.name}</div>
              <div className="mt-0.5 text-xs text-ink-500">{t.category} · v{latestVersion(t).version} · {latestVersion(t).fields.length} fields</div>
            </button>
          ))}
        </div>
        <div className="space-y-5">
          <Card title={tpl ? `Editing ${tpl.name}` : 'New template'} action={<div className="inline-flex rounded-lg bg-ivory-100 p-0.5">{(['edit', 'preview'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cx('flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium capitalize', mode === m ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500')}>{m === 'edit' ? <Pencil size={12} /> : <Eye size={12} />}{m}</button>)}</div>}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Equipment category"><Input value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
              <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            </div>
            <p className="mt-3 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-900 ring-1 ring-gold-200">Thresholds in this demo are placeholders. Configure limits only from approved procedures and manufacturer documentation.</p>
          </Card>

          {mode === 'edit' ? (
            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={f.id} className={cx('rounded-xl border bg-white p-4 shadow-card', f.showIf ? 'ml-6 border-l-4 border-ivory-300 border-l-gold-400' : 'border-ivory-300')}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="mt-2.5 w-6 text-sm font-semibold text-ink-400">{i + 1}</span>
                    <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
                      <Input value={f.label} onChange={(e) => up(i, { label: e.target.value })} placeholder="Question / label" />
                      <Select value={f.type} onChange={(e) => up(i, { type: e.target.value as FieldType })}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</Select>
                      <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={f.required} onChange={(e) => up(i, { required: e.target.checked })} className="h-4 w-4 rounded" />Required</label>
                    </div>
                    <div className="flex gap-1">
                      <button disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 text-ink-500 hover:bg-ivory-100 disabled:opacity-30"><ArrowUp size={15} /></button>
                      <button disabled={i === fields.length - 1} onClick={() => move(i, 1)} className="rounded p-1.5 text-ink-500 hover:bg-ivory-100 disabled:opacity-30"><ArrowDown size={15} /></button>
                      <button onClick={() => setFields((x) => x.filter((_, j) => j !== i))} className="rounded p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 pl-9 sm:grid-cols-5">
                    {f.type === 'number' && (
                      <>
                        <Field label="Unit"><Input value={f.unit ?? ''} onChange={(e) => up(i, { unit: e.target.value })} placeholder="V, bar, °C" /></Field>
                        <Field label="Normal min"><Input type="number" value={f.normalMin ?? ''} onChange={(e) => up(i, { normalMin: num(e.target.value) })} /></Field>
                        <Field label="Normal max"><Input type="number" value={f.normalMax ?? ''} onChange={(e) => up(i, { normalMax: num(e.target.value) })} /></Field>
                        <Field label="Critical below"><Input type="number" value={f.critMin ?? ''} onChange={(e) => up(i, { critMin: num(e.target.value) })} /></Field>
                        <Field label="Critical above"><Input type="number" value={f.critMax ?? ''} onChange={(e) => up(i, { critMax: num(e.target.value) })} /></Field>
                      </>
                    )}
                    {f.type === 'select' && (
                      <Field label="Options (comma separated)" className="sm:col-span-3"><Input value={(f.options ?? []).join(', ')} onChange={(e) => up(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
                    )}
                    {(f.type === 'select' || f.type === 'yesno') && (
                      <Field label="Flag as warning when" className="sm:col-span-2"><Input value={(f.warnOptions ?? []).join(', ')} onChange={(e) => up(i, { warnOptions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder={f.type === 'yesno' ? 'Yes' : 'e.g. Low'} /></Field>
                    )}
                    <Field label="Show only if" className="sm:col-span-2">
                      <div className="flex gap-2">
                        <Select value={f.showIf?.fieldId ?? ''} onChange={(e) => up(i, { showIf: e.target.value ? { fieldId: e.target.value, equals: f.showIf?.equals ?? 'Yes' } : undefined })}>
                          <option value="">Always shown</option>
                          {fields.slice(0, i).filter((x) => ['yesno', 'passfail', 'select'].includes(x.type)).map((x) => <option key={x.id} value={x.id}>{x.label || 'Untitled'}</option>)}
                        </Select>
                        {f.showIf && <Input className="w-24" value={f.showIf.equals} onChange={(e) => up(i, { showIf: { ...f.showIf!, equals: e.target.value } })} />}
                      </div>
                    </Field>
                  </div>
                </div>
              ))}
              <button onClick={add} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ivory-300 text-sm font-medium text-ink-600 hover:border-gold-400 hover:text-forest-800"><Plus size={16} />Add field</button>
            </div>
          ) : (
            <Card title="Technician preview">
              <ol className="space-y-2">
                {fields.map((f, i) => (
                  <li key={f.id} className={cx('rounded-lg border border-ivory-200 px-3 py-2 text-sm', f.showIf && 'ml-6 border-l-4 border-l-gold-400')}>
                    <span className="text-ink-400">{i + 1}.</span> <b className="font-medium text-ink-900">{f.label || 'Untitled'}</b>{f.required && <span className="text-rose-600">*</span>}
                    <span className="ml-2 text-xs text-ink-500">{TYPES.find((t) => t.v === f.type)?.l}{f.unit ? ` · ${f.unit}` : ''}{f.normalMin !== undefined || f.normalMax !== undefined ? ` · normal ${f.normalMin ?? '…'}–${f.normalMax ?? '…'}` : ''}{f.options ? ` · ${f.options.join(' / ')}` : ''}</span>
                    {f.showIf && <div className="text-xs text-gold-700">Shown when “{fields.find((x) => x.id === f.showIf!.fieldId)?.label}” = {f.showIf.equals}</div>}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Change note" className="flex-1"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed in this version?" /></Field>
              <Button variant="primary" size="lg" onClick={save}><GitBranch size={16} />{tpl ? `Save as v${latestVersion(tpl).version + 1}` : 'Create template'}</Button>
            </div>
            {tpl && (
              <div className="mt-4 border-t border-ivory-200 pt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Version history</div>
                <ul className="space-y-1 text-sm">
                  {[...tpl.versions].reverse().map((v) => <li key={v.version} className="flex gap-3"><span className="w-8 font-semibold text-forest-800">v{v.version}</span><span className="flex-1 text-ink-700">{v.note}</span><span className="text-xs text-ink-500">{userById(db, v.createdById)?.name} · {fmtDate(v.createdAt)}</span></li>)}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
