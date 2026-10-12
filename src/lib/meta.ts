import type { Condition, Criticality, Priority, WOStatus, WOType } from './types';

export const STATUS_META: Record<WOStatus, { label: string; cls: string; dot: string }> = {
  triage: { label: 'Awaiting Triage', cls: 'bg-rose-50 text-rose-800 ring-rose-200', dot: 'bg-rose-500' },
  assigned: { label: 'Assigned', cls: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  in_progress: { label: 'In Progress', cls: 'bg-indigo-50 text-indigo-800 ring-indigo-200', dot: 'bg-indigo-500' },
  on_hold: { label: 'On Hold', cls: 'bg-stone-100 text-stone-700 ring-stone-300', dot: 'bg-stone-500' },
  submitted: { label: 'Awaiting Review', cls: 'bg-gold-50 text-gold-800 ring-gold-200', dot: 'bg-gold-500' },
  rework: { label: 'Rework Required', cls: 'bg-orange-50 text-orange-800 ring-orange-200', dot: 'bg-orange-500' },
  completed: { label: 'Approved', cls: 'bg-forest-50 text-forest-800 ring-forest-200', dot: 'bg-forest-500' },
  closed: { label: 'Closed', cls: 'bg-forest-100 text-forest-900 ring-forest-300', dot: 'bg-forest-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-stone-50 text-stone-500 ring-stone-200', dot: 'bg-stone-400' },
};

export const PRIORITY_META: Record<Priority, { label: string; cls: string }> = {
  low: { label: 'Low', cls: 'text-stone-600 bg-stone-100' },
  medium: { label: 'Medium', cls: 'text-sky-800 bg-sky-50' },
  high: { label: 'High', cls: 'text-orange-800 bg-orange-50' },
  critical: { label: 'Critical', cls: 'text-white bg-rose-700' },
};

export const TYPE_LABEL: Record<WOType, string> = {
  preventive: 'Preventive',
  corrective: 'Corrective',
  emergency: 'Emergency',
  inspection: 'Inspection',
};

export const CONDITION_META: Record<Condition, { label: string; cls: string; dot: string }> = {
  operational: { label: 'Operational', cls: 'text-forest-800 bg-forest-50 ring-forest-200', dot: 'bg-forest-500' },
  degraded: { label: 'Degraded', cls: 'text-amber-800 bg-amber-50 ring-amber-200', dot: 'bg-amber-500' },
  faulty: { label: 'Faulty', cls: 'text-orange-800 bg-orange-50 ring-orange-200', dot: 'bg-orange-500' },
  out_of_service: { label: 'Out of Service', cls: 'text-rose-800 bg-rose-50 ring-rose-200', dot: 'bg-rose-600' },
  decommissioned: { label: 'Decommissioned', cls: 'text-stone-500 bg-stone-50 ring-stone-200', dot: 'bg-stone-400' },
};

export const CRIT_META: Record<Criticality, { label: string; cls: string }> = {
  low: { label: 'Low', cls: 'text-stone-600' },
  medium: { label: 'Medium', cls: 'text-sky-700' },
  high: { label: 'High', cls: 'text-orange-700' },
  critical: { label: 'Critical', cls: 'text-rose-700' },
};

export const OPEN_STATUSES: WOStatus[] = ['triage', 'assigned', 'in_progress', 'on_hold', 'submitted', 'rework'];
export const DONE_STATUSES: WOStatus[] = ['completed', 'closed'];
