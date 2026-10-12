import type { AnswerValue, ReadingFlag, TemplateField } from './types';

export function isFieldVisible(f: TemplateField, answers: Record<string, AnswerValue>) {
  if (!f.showIf) return true;
  return String(answers[f.showIf.fieldId] ?? '') === f.showIf.equals;
}

export function evaluateFlags(fields: TemplateField[], answers: Record<string, AnswerValue>): ReadingFlag[] {
  const flags: ReadingFlag[] = [];
  for (const f of fields) {
    if (!isFieldVisible(f, answers)) continue;
    const v = answers[f.id];
    if (v === null || v === undefined || v === '') continue;
    if (f.type === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) continue;
      const crit = (f.critMin !== undefined && n < f.critMin) || (f.critMax !== undefined && n > f.critMax);
      const warn = (f.normalMin !== undefined && n < f.normalMin) || (f.normalMax !== undefined && n > f.normalMax);
      if (crit || warn) flags.push({ fieldId: f.id, label: f.label, level: crit ? 'critical' : 'warning', value: `${n}${f.unit ? ' ' + f.unit : ''}` });
    } else if (f.type === 'passfail' && v === 'Fail') {
      flags.push({ fieldId: f.id, label: f.label, level: 'warning', value: 'Fail' });
    } else if (f.critOptions?.includes(String(v))) {
      flags.push({ fieldId: f.id, label: f.label, level: 'critical', value: String(v) });
    } else if (f.warnOptions?.includes(String(v))) {
      flags.push({ fieldId: f.id, label: f.label, level: 'warning', value: String(v) });
    }
  }
  return flags;
}


/** Human-readable normal range, e.g. "24.5–28.8 V", "≥ 40 %", "≤ 18 A". Empty when not configured. */
export function rangeText(f: TemplateField): string {
  const u = f.unit ? ` ${f.unit}` : '';
  if (f.normalMin !== undefined && f.normalMax !== undefined) return `${f.normalMin}–${f.normalMax}${u}`;
  if (f.normalMin !== undefined) return `≥ ${f.normalMin}${u}`;
  if (f.normalMax !== undefined) return `≤ ${f.normalMax}${u}`;
  return '';
}
