import { useSyncExternalStore } from 'react';
import type {
  AnswerValue, Asset, AuditEvent, Condition, Db, DraftWork, FaultInfo, MaintenancePlan, Notification, Photo,
  Priority, ReadingFlag, ReviewDecision, Submission, Template, TemplateField, User, WOStatus, WOType, WorkOrder,
} from './types';
import { can, ROLE_LABEL } from './permissions';
import { addDays, addHours, daysBetween, nowIso, pkAt, pkDate } from './time';
import { buildSeed, standardDepartments, standardTemplates } from './seed';
import { OPEN_STATUSES } from './meta';
import { evaluateFlags, isFieldVisible } from './rules';
export { evaluateFlags, isFieldVisible };

const DEMO_DB_KEY = 'serena-hub-db-v3';
const LIVE_DB_KEY = 'serena-hub-live-v1';
const MODE_KEY = 'serena-hub-mode';
const SESSION_KEY_BASE = 'serena-hub-session';

export type WorkspaceMode = 'demo' | 'live';
function readMode(): WorkspaceMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'live' ? 'live' : 'demo';
  } catch {
    return 'demo';
  }
}
let mode: WorkspaceMode = readMode();
let DB_KEY = mode === 'live' ? LIVE_DB_KEY : DEMO_DB_KEY;
let SESSION_KEY = `${SESSION_KEY_BASE}-${mode}`;
export const getMode = () => mode;

// ---------------------------------------------------------------- persistence
let db: Db = loadDb();
let version = 0;
const listeners = new Set<() => void>();
let persistError: string | null = null;

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* storage unavailable — fall back to fresh seed in memory */
  }
  if (mode === 'live') return buildBlank(); // not saved until setup completes
  const seeded = buildSeed();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
  } catch {
    /* ignore */
  }
  return seeded;
}

function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    persistError = null;
  } catch {
    persistError = 'Browser storage is full — recent changes are kept for this session only. Use Settings → Reset demo data.';
  }
}

function emit() {
  version++;
  listeners.forEach((l) => l());
}

function readStored(): Db | null {
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? (JSON.parse(raw) as Db) : null;
  } catch {
    return null;
  }
}

// Live sync between tabs/windows: another tab saved → reload our copy and re-render.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === MODE_KEY) {
      applyMode(readMode());
      return;
    }
    if (e.key !== DB_KEY) return;
    const next = e.newValue ? readStored() : null;
    db = next ?? (mode === 'live' ? buildBlank() : buildSeed());
    emit();
  });
}

/** Apply a mutation atomically: start from the latest saved copy (another tab may have written since),
 *  work on a copy, and only commit if no error is thrown. */
function commit<T>(fn: (d: Db) => T): T {
  const latest = readStored();
  if (latest) db = latest;
  const draft = structuredClone(db);
  const result = fn(draft);
  db = draft;
  persist();
  emit();
  return result;
}

export function getDb() {
  return db;
}
export function getPersistError() {
  return persistError;
}

export function useDb(): Db {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
  return db;
}

/** An empty workspace: just the property, nothing else. Setup creates the first administrator. */
export function buildBlank(name = 'Islamabad Serena Hotel', city = 'Islamabad'): Db {
  const P = 'prop-live';
  return {
    schemaVersion: 3,
    kind: 'live',
    seededAt: new Date().toISOString(),
    property: { id: P, name, group: 'Serena Hotels', timezone: 'Asia/Karachi', city },
    users: [], departments: [], locations: [{ id: 'loc-root', parentId: null, name, type: 'property', propertyId: P }],
    assets: [], templates: [], plans: [], workOrders: [], submissions: [], reviews: [], comments: [], audit: [], notifications: [],
    counters: { wo: 0 },
  };
}

function applyMode(m: WorkspaceMode) {
  mode = m;
  DB_KEY = m === 'live' ? LIVE_DB_KEY : DEMO_DB_KEY;
  SESSION_KEY = `${SESSION_KEY_BASE}-${m}`;
  db = loadDb();
  try {
    sessionUserId = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  } catch {
    sessionUserId = null;
  }
  if (!db.users.some((u) => u.id === sessionUserId)) sessionUserId = null;
  emit();
}

/** Switch between the demo workspace and your own (empty) workspace. Both are kept. */
export function switchWorkspace(m: WorkspaceMode) {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignore */
  }
  applyMode(m);
}

/** Erase your own workspace completely and start again from the setup wizard. */
export function eraseLiveWorkspace() {
  try {
    localStorage.removeItem(LIVE_DB_KEY);
    localStorage.removeItem(`${SESSION_KEY_BASE}-live`);
    sessionStorage.removeItem(`${SESSION_KEY_BASE}-live`);
  } catch {
    /* ignore */
  }
  if (mode === 'live') applyMode('live');
}

export const needsSetup = (d: Db) => d.kind === 'live' && d.users.length === 0;

// Demo-grade password hashing (cyrb53, salted with the email). The production backend uses Argon2.
export function hashPassword(email: string, password: string) {
  const str = `${email.trim().toLowerCase()}::${password}::serena-hub`;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function checkPassword(user: User, password: string, demoPassword: string) {
  return user.passwordHash ? user.passwordHash === hashPassword(user.email, password) : password === demoPassword;
}

export interface SetupInput {
  hotelName: string;
  city: string;
  adminName: string;
  adminEmail: string;
  password: string;
  addDepartments: boolean;
  addTemplates: boolean;
  addLocations: boolean;
}

/** First-run setup of an empty workspace: property, first administrator and optional starter configuration. */
export function setupWorkspace(input: SetupInput) {
  if (mode !== 'live') fail('Setup is only for your own workspace.');
  if (!input.hotelName.trim()) fail('Hotel name is required.');
  if (!input.adminName.trim()) fail('Your name is required.');
  if (!/^\S+@\S+\.\S+$/.test(input.adminEmail.trim())) fail('Enter a valid email address.');
  if (input.password.length < 8) fail('Password must be at least 8 characters.');
  const fresh = buildBlank(input.hotelName.trim(), input.city.trim() || 'Islamabad');
  const P = fresh.property.id;
  const admin: User = {
    id: uid('u'), employeeId: 'ADM-001', name: input.adminName.trim(), email: input.adminEmail.trim().toLowerCase(), phone: '',
    role: 'admin', designation: 'System Administrator', departmentId: '', skills: [], shift: 'General', status: 'active', propertyId: P,
    passwordHash: hashPassword(input.adminEmail, input.password),
  };
  fresh.users.push(admin);
  if (input.addDepartments) {
    fresh.departments = standardDepartments(P).map((d) => ({ ...d, propertyId: P }));
    const adm = fresh.departments.find((d) => d.code === 'ADM');
    if (adm) admin.departmentId = adm.id;
  }
  if (input.addTemplates) fresh.templates = standardTemplates(P, admin.id, () => nowIso());
  if (input.addLocations) {
    const L = (id: string, parentId: string, name: string, type: Db['locations'][number]['type']) => fresh.locations.push({ id, parentId, name, type, propertyId: P });
    L('loc-main', 'loc-root', 'Main Building', 'building');
    L('loc-bsmt', 'loc-main', 'Basement', 'floor');
    L('loc-gf', 'loc-main', 'Ground Floor', 'floor');
    L('loc-guest', 'loc-root', 'Guest Wing', 'building');
    L('loc-grounds', 'loc-root', 'Grounds & Leisure', 'building');
  }
  fresh.audit.push({ id: uid('ev'), at: nowIso(), actorId: admin.id, action: 'Workspace created', entity: 'system', entityId: P, to: fresh.property.name });
  db = fresh;
  persist();
  sessionUserId = admin.id;
  try {
    sessionStorage.setItem(SESSION_KEY, admin.id);
    localStorage.setItem(SESSION_KEY, admin.id);
  } catch {
    /* ignore */
  }
  emit();
}

export function createLocation(actor: User, input: { name: string; type: Db['locations'][number]['type']; parentId: string }) {
  if (!can(actor, 'asset.manage')) fail('Only administrators and the Chief Engineer can add locations.');
  if (!input.name.trim()) fail('Location name is required.');
  return commit((d) => {
    const parent = d.locations.find((l) => l.id === input.parentId) ?? fail('Choose where this location sits.');
    if (d.locations.some((l) => l.parentId === parent.id && l.name.toLowerCase() === input.name.trim().toLowerCase())) fail(`"${input.name}" already exists there.`);
    const loc = { id: uid('loc'), parentId: parent.id, name: input.name.trim(), type: input.type, propertyId: actor.propertyId };
    d.locations.push(loc);
    logAudit(d, actor.id, 'Location added', 'system', loc.id, { to: loc.name });
    return loc;
  });
}

export function resetDemo() {
  if (mode !== 'demo') switchWorkspace('demo');
  db = buildSeed();
  persist();
  emit();
}

// ---------------------------------------------------------------- session
// Session is per tab (sessionStorage), so two windows can be signed in as different people side by side.
let sessionUserId: string | null = (() => {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
})();

export function login(userId: string) {
  sessionUserId = userId;
  try {
    sessionStorage.setItem(SESSION_KEY, userId);
    localStorage.setItem(SESSION_KEY, userId); // remembered for the next new window
  } catch {
    /* ignore */
  }
  commit((d) => {
    logAudit(d, userId, 'Signed in', 'user', userId);
  });
}
export function logout() {
  sessionUserId = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  emit();
}
export function useCurrentUser(): User | null {
  const d = useDb();
  return d.users.find((u) => u.id === sessionUserId && u.status === 'active') ?? null;
}

// ---------------------------------------------------------------- helpers
export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

export class RuleError extends Error {}
const fail = (msg: string): never => {
  throw new RuleError(msg);
};

export const userById = (d: Db, id?: string) => d.users.find((u) => u.id === id);
export const assetById = (d: Db, id?: string) => d.assets.find((a) => a.id === id);
export const woById = (d: Db, id?: string) => d.workOrders.find((w) => w.id === id);

export function locationPath(d: Db, id?: string): string {
  const parts: string[] = [];
  let cur = d.locations.find((l) => l.id === id);
  while (cur) {
    if (cur.type !== 'property') parts.unshift(cur.name);
    cur = d.locations.find((l) => l.id === cur!.parentId);
  }
  return parts.join(' › ');
}

export function latestVersion(t: Template) {
  return t.versions[t.versions.length - 1];
}

export function templateFields(d: Db, templateId?: string, version?: number): TemplateField[] {
  const t = d.templates.find((x) => x.id === templateId);
  if (!t) return [];
  const v = t.versions.find((x) => x.version === version) ?? latestVersion(t);
  return v.fields;
}

export function isOverdue(wo: WorkOrder, now = Date.now()) {
  return ['triage', 'assigned', 'in_progress', 'on_hold', 'rework'].includes(wo.status) && new Date(wo.dueAt).getTime() < now;
}

export function submissionsFor(d: Db, woId: string) {
  return d.submissions.filter((s) => s.woId === woId).sort((a, b) => a.version - b.version);
}

function logAudit(d: Db, actorId: string, action: string, entity: AuditEvent['entity'], entityId: string, extra: Partial<AuditEvent> = {}) {
  d.audit.push({ id: uid('ev'), at: nowIso(), actorId, action, entity, entityId, ...extra });
}

function notify(d: Db, userIds: (string | undefined)[], n: Omit<Notification, 'id' | 'userId' | 'at' | 'read'>) {
  const unique = Array.from(new Set(userIds.filter(Boolean))) as string[];
  for (const userId of unique) {
    // de-duplicate identical unread alerts
    if (d.notifications.some((x) => x.userId === userId && !x.read && x.title === n.title && x.link === n.link)) continue;
    d.notifications.push({ id: uid('nt'), userId, at: nowIso(), read: false, ...n });
  }
}

const managers = (d: Db) => d.users.filter((u) => u.role === 'manager' && u.status === 'active').map((u) => u.id);

function nextNumber(d: Db) {
  d.counters.wo += 1;
  return `WO-${new Date().getFullYear()}-${String(d.counters.wo).padStart(4, '0')}`;
}

// ---------------------------------------------------------------- state machine
const TRANSITIONS: Record<WOStatus, WOStatus[]> = {
  triage: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'on_hold', 'assigned', 'cancelled'],
  in_progress: ['on_hold', 'submitted', 'closed', 'cancelled'],
  on_hold: ['in_progress', 'assigned', 'cancelled'],
  submitted: ['completed', 'closed', 'rework'],
  rework: ['in_progress', 'assigned'],
  completed: ['closed', 'rework'],
  closed: [],
  cancelled: [],
};

function move(d: Db, wo: WorkOrder, to: WOStatus, actorId: string, action: string, reason?: string) {
  if (!TRANSITIONS[wo.status].includes(to)) fail(`Cannot move a work order from "${wo.status}" to "${to}".`);
  const from = wo.status;
  wo.status = to;
  logAudit(d, actorId, action, 'work_order', wo.id, { from, to, reason });
}

function requireWO(d: Db, id: string, actor: User) {
  const wo = woById(d, id) ?? fail('Work order not found.');
  if (wo.propertyId !== actor.propertyId) fail('You are not authorised for this property.');
  return wo;
}

const isAssignee = (wo: WorkOrder, u: User) => wo.leadTechId === u.id || wo.helperIds.includes(u.id);

function checkAssignable(d: Db, techId: string) {
  const t = userById(d, techId) ?? fail('Technician not found.');
  if (t.status !== 'active') fail(`${t.name} is not active and cannot receive work.`);
  if (t.role !== 'technician') fail(`${t.name} is not a technician.`);
  return t;
}

// ---------------------------------------------------------------- work orders
export interface NewWOInput {
  title: string;
  description: string;
  type: WOType;
  priority: Priority;
  assetId?: string;
  locationId?: string;
  leadTechId?: string;
  helperIds: string[];
  supervisorId: string;
  dueAt: string;
  scheduledFor?: string;
  templateId?: string;
  instructions: string;
  safety: string;
  requiresApproval: boolean;
}

export function createWorkOrder(actor: User, input: NewWOInput) {
  if (!can(actor, 'wo.create')) fail('You do not have permission to create work orders.');
  if (!input.title.trim()) fail('Title is required.');
  if (!input.supervisorId) fail('Choose a supervisor / reviewer.');
  return commit((d) => {
    const asset = assetById(d, input.assetId);
    const locationId = asset?.locationId ?? input.locationId ?? fail('Select an asset or a location.');
    if (input.leadTechId) checkAssignable(d, input.leadTechId);
    input.helperIds.forEach((h) => checkAssignable(d, h));
    const tpl = d.templates.find((t) => t.id === input.templateId);
    const wo: WorkOrder = {
      id: uid('wo'),
      number: nextNumber(d),
      title: input.title.trim(),
      description: input.description,
      type: input.type,
      priority: input.priority,
      status: 'assigned',
      assetId: asset?.id,
      locationId,
      departmentId: asset?.departmentId ?? d.departments.find((x) => x.isEngineering)?.id ?? '',
      requestedById: actor.id,
      supervisorId: input.supervisorId,
      leadTechId: input.leadTechId,
      helperIds: input.helperIds.filter((h) => h !== input.leadTechId),
      createdAt: nowIso(),
      scheduledFor: input.scheduledFor ?? nowIso(),
      dueAt: input.dueAt,
      templateId: tpl?.id,
      templateVersion: tpl ? latestVersion(tpl).version : undefined,
      instructions: input.instructions,
      safety: input.safety,
      requiresApproval: input.requiresApproval,
      reworkCount: 0,
      source: 'manual',
      propertyId: actor.propertyId,
    };
    if (!wo.leadTechId) wo.status = 'triage';
    d.workOrders.push(wo);
    logAudit(d, actor.id, 'Work order created', 'work_order', wo.id, { to: wo.status });
    if (wo.leadTechId) {
      logAudit(d, actor.id, 'Assigned', 'work_order', wo.id, { to: [wo.leadTechId, ...wo.helperIds].map((i) => userById(d, i)?.name).join(', ') });
      notify(d, [wo.leadTechId, ...wo.helperIds], { title: 'New work assigned', body: `${wo.number} · ${wo.title}`, link: `/work-orders/${wo.id}`, level: wo.priority === 'critical' ? 'critical' : 'info' });
    }
    return wo;
  });
}

export interface FaultInput {
  title: string;
  description: string;
  assetId?: string;
  locationId?: string;
  severity: Priority;
  guestImpact: boolean;
  equipmentOperational: boolean;
  safetyConcern: boolean;
  immediateAction: string;
  photos: Photo[];
}

export function reportFault(actor: User, input: FaultInput) {
  if (!can(actor, 'fault.report')) fail('You do not have permission to report faults.');
  if (!input.title.trim()) fail('Please describe what is wrong in the title.');
  if (!input.assetId && !input.locationId) fail('Select the affected equipment or location.');
  return commit((d) => {
    const asset = assetById(d, input.assetId);
    const now = nowIso();
    const emergency = input.severity === 'critical' || input.safetyConcern || (!input.equipmentOperational && asset?.criticality === 'critical');
    const responseHours = { critical: 1, high: 4, medium: 24, low: 72 }[input.severity];
    const fault: FaultInfo = {
      severity: input.severity,
      guestImpact: input.guestImpact,
      equipmentOperational: input.equipmentOperational,
      safetyConcern: input.safetyConcern,
      immediateAction: input.immediateAction,
      reportedAt: now,
      photos: input.photos,
    };
    const supervisorId = asset?.supervisorId ?? d.users.find((u) => u.role === 'supervisor' && u.status === 'active')?.id ?? d.users.find((u) => u.role === 'manager' && u.status === 'active')?.id ?? fail('No supervisor exists yet. Ask your administrator to add an Engineering Supervisor first.');
    const wo: WorkOrder = {
      id: uid('wo'),
      number: nextNumber(d),
      title: input.title.trim(),
      description: input.description,
      type: emergency ? 'emergency' : 'corrective',
      priority: input.severity,
      status: 'triage',
      assetId: asset?.id,
      locationId: asset?.locationId ?? input.locationId!,
      departmentId: asset?.departmentId ?? d.departments.find((x) => x.isEngineering)?.id ?? '',
      requestedById: actor.id,
      supervisorId,
      helperIds: [],
      createdAt: now,
      scheduledFor: now,
      dueAt: addHours(now, responseHours),
      templateId: d.templates.some((t) => t.id === 'tpl-repair') ? 'tpl-repair' : undefined,
      templateVersion: d.templates.some((t) => t.id === 'tpl-repair') ? latestVersion(d.templates.find((t) => t.id === 'tpl-repair')!).version : undefined,
      instructions: 'Diagnose the reported fault, record findings, repair, and test before submitting. Attach before and after photographs.',
      safety: input.safetyConcern ? 'Safety concern reported — isolate equipment and follow lockout/tagout before work.' : 'Follow standard isolation procedures.',
      requiresApproval: true,
      reworkCount: 0,
      source: 'fault',
      fault,
      propertyId: actor.propertyId,
    };
    d.workOrders.push(wo);
    logAudit(d, actor.id, 'Fault reported', 'work_order', wo.id, { to: 'triage', reason: input.description });
    if (asset && !input.equipmentOperational) {
      const from = asset.condition;
      asset.condition = 'out_of_service';
      logAudit(d, actor.id, 'Asset condition changed', 'asset', asset.id, { from, to: 'out_of_service', reason: `Fault ${wo.number}` });
    } else if (asset && asset.condition === 'operational') {
      asset.condition = 'faulty';
      logAudit(d, actor.id, 'Asset condition changed', 'asset', asset.id, { from: 'operational', to: 'faulty', reason: `Fault ${wo.number}` });
    }
    const recipients = [supervisorId];
    if (emergency) recipients.push(...managers(d));
    notify(d, recipients, {
      title: emergency ? 'EMERGENCY fault reported' : 'New fault reported',
      body: `${wo.number} · ${wo.title}${asset ? ` (${asset.code})` : ''}`,
      link: `/work-orders/${wo.id}`,
      level: emergency ? 'critical' : 'warning',
    });
    return wo;
  });
}

export function triageAndAssign(actor: User, woId: string, p: { priority: Priority; leadTechId: string; helperIds: string[]; dueAt: string; note: string }) {
  if (!can(actor, 'wo.assign')) fail('Only supervisors can triage and assign work.');
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    checkAssignable(d, p.leadTechId);
    p.helperIds.forEach((h) => checkAssignable(d, h));
    if (wo.priority !== p.priority) logAudit(d, actor.id, 'Priority changed', 'work_order', wo.id, { from: wo.priority, to: p.priority });
    wo.priority = p.priority;
    if (p.priority === 'critical' && wo.type === 'corrective') wo.type = 'emergency';
    wo.leadTechId = p.leadTechId;
    wo.helperIds = p.helperIds.filter((h) => h !== p.leadTechId);
    wo.dueAt = p.dueAt;
    move(d, wo, 'assigned', actor.id, wo.source === 'fault' ? 'Triaged & technician dispatched' : 'Assigned', p.note || undefined);
    notify(d, [wo.leadTechId, ...wo.helperIds], { title: wo.priority === 'critical' ? 'URGENT: you have been dispatched' : 'New work assigned', body: `${wo.number} · ${wo.title}`, link: `/work-orders/${wo.id}`, level: wo.priority === 'critical' ? 'critical' : 'info' });
    notify(d, [wo.requestedById], { title: 'Your request is being handled', body: `${wo.number} assigned to ${userById(d, p.leadTechId)?.name}`, link: `/work-orders/${wo.id}`, level: 'info' });
  });
}

export function reassign(actor: User, woId: string, leadTechId: string, helperIds: string[], reason: string) {
  if (!can(actor, 'wo.assign')) fail('Only supervisors can reassign work.');
  if (!reason.trim()) fail('A reason is required to reassign work.');
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (['closed', 'cancelled'].includes(wo.status)) fail('Closed work cannot be reassigned.');
    checkAssignable(d, leadTechId);
    helperIds.forEach((h) => checkAssignable(d, h));
    const before = [wo.leadTechId, ...wo.helperIds].map((i) => userById(d, i)?.name).filter(Boolean).join(', ');
    wo.leadTechId = leadTechId;
    wo.helperIds = helperIds.filter((h) => h !== leadTechId);
    const after = [wo.leadTechId, ...wo.helperIds].map((i) => userById(d, i)?.name).join(', ');
    if (wo.status === 'on_hold' || wo.status === 'submitted') {
      /* keep */
    } else if (wo.status !== 'assigned' && TRANSITIONS[wo.status].includes('assigned')) {
      wo.status = 'assigned';
    }
    logAudit(d, actor.id, 'Reassigned', 'work_order', wo.id, { from: before, to: after, reason });
    notify(d, [leadTechId, ...helperIds], { title: 'Work reassigned to you', body: `${wo.number} · ${wo.title}`, link: `/work-orders/${wo.id}`, level: 'info' });
  });
}

export function startWork(actor: User, woId: string) {
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (!can(actor, 'wo.execute') || !isAssignee(wo, actor)) fail('Only the assigned technician can start this work.');
    const wasRework = wo.status === 'rework';
    move(d, wo, 'in_progress', actor.id, wasRework ? 'Rework started' : 'Work started');
    if (!wo.startedAt || wasRework) wo.startedAt = nowIso();
  });
}

export function holdWork(actor: User, woId: string, reason: string) {
  if (!reason.trim()) fail('Please give a reason for putting work on hold.');
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (!(isAssignee(wo, actor) || can(actor, 'wo.assign'))) fail('Not permitted.');
    move(d, wo, 'on_hold', actor.id, 'Put on hold', reason);
    wo.holdReason = reason;
    notify(d, [wo.supervisorId], { title: 'Work placed on hold', body: `${wo.number}: ${reason}`, link: `/work-orders/${wo.id}`, level: 'warning' });
  });
}

export function resumeWork(actor: User, woId: string) {
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (!(isAssignee(wo, actor) || can(actor, 'wo.assign'))) fail('Not permitted.');
    move(d, wo, 'in_progress', actor.id, 'Resumed');
    wo.holdReason = undefined;
  });
}

export function saveDraft(actor: User, woId: string, draft: Omit<DraftWork, 'savedAt'>) {
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (!isAssignee(wo, actor)) fail('Only assigned technicians can edit this report.');
    wo.draft = { ...draft, savedAt: nowIso() };
  });
}

export function submitWork(actor: User, woId: string, draft: Omit<DraftWork, 'savedAt'>) {
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (!can(actor, 'wo.execute') || !isAssignee(wo, actor)) fail('Only the assigned technician can submit this work.');
    if (wo.status !== 'in_progress') fail('Start the work before submitting.');
    const fields = templateFields(d, wo.templateId, wo.templateVersion);
    const missing: string[] = [];
    for (const f of fields) {
      if (!f.required || !isFieldVisible(f, draft.answers)) continue;
      if (f.type === 'photo') {
        if (!draft.photos.some((p) => p.fieldId === f.id)) missing.push(f.label);
      } else {
        const v = draft.answers[f.id];
        if (v === null || v === undefined || String(v).trim() === '') missing.push(f.label);
      }
    }
    if (missing.length) fail(`Please complete: ${missing.join(', ')}.`);
    const prev = submissionsFor(d, wo.id);
    const flags = evaluateFlags(fields, draft.answers);
    const sub: Submission = {
      id: uid('sub'),
      woId: wo.id,
      version: prev.length + 1,
      submittedById: actor.id,
      submittedAt: nowIso(),
      startedAt: wo.startedAt,
      templateId: wo.templateId,
      templateVersion: wo.templateVersion,
      answers: { ...draft.answers },
      photos: draft.photos.map((p) => ({ ...p })),
      notes: draft.notes,
      partsUsed: draft.partsUsed,
      flags,
    };
    d.submissions.push(sub);
    wo.submittedAt = sub.submittedAt;
    wo.draft = undefined;
    logAudit(d, actor.id, `Report submitted (v${sub.version})`, 'work_order', wo.id, { reason: flags.length ? `${flags.length} abnormal reading(s)` : undefined });
    if (wo.requiresApproval) {
      move(d, wo, 'submitted', actor.id, sub.version > 1 ? 'Resubmitted for review' : 'Submitted for review');
      notify(d, [wo.supervisorId], {
        title: sub.version > 1 ? `Resubmission v${sub.version} awaiting review` : 'Report awaiting your review',
        body: `${wo.number} · ${wo.title} — by ${actor.name}`,
        link: `/work-orders/${wo.id}/review`,
        level: 'info',
      });
    } else {
      move(d, wo, 'closed', actor.id, 'Completed (no approval required)');
      wo.completedAt = wo.closedAt = nowIso();
    }
    const crit = flags.filter((f) => f.level === 'critical');
    if (crit.length) {
      notify(d, [wo.supervisorId, ...managers(d)], {
        title: 'Critical reading recorded',
        body: `${assetById(d, wo.assetId)?.code ?? wo.number}: ${crit.map((c) => `${c.label} ${c.value}`).join('; ')}`,
        link: `/work-orders/${wo.id}/review`,
        level: 'critical',
      });
    } else if (flags.length) {
      notify(d, [wo.supervisorId], { title: 'Abnormal reading flagged', body: `${assetById(d, wo.assetId)?.code ?? wo.number}: ${flags.map((c) => `${c.label} ${c.value}`).join('; ')}`, link: `/work-orders/${wo.id}/review`, level: 'warning' });
    }
    return sub;
  });
}

export function reviewSubmission(actor: User, woId: string, decision: ReviewDecision, comment: string, newDueAt?: string) {
  if (!can(actor, 'wo.review')) fail('You are not authorised to review submissions.');
  if (decision !== 'approved' && !comment.trim()) fail('Explain what needs to be corrected — a comment is mandatory.');
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (wo.status !== 'submitted') fail('This work order is not awaiting review.');
    const subs = submissionsFor(d, wo.id);
    const latest = subs[subs.length - 1] ?? fail('No submission found.');
    if (latest.submittedById === actor.id || isAssignee(wo, actor)) fail('Self-approval is not allowed. Another authorised reviewer must review this work.');
    d.reviews.push({ id: uid('rv'), woId: wo.id, submissionId: latest.id, version: latest.version, reviewerId: actor.id, decision, comment: comment.trim(), newDueAt, at: nowIso() });
    const techs = [wo.leadTechId, ...wo.helperIds];
    if (decision === 'approved') {
      if (wo.source === 'fault') {
        move(d, wo, 'completed', actor.id, `Approved v${latest.version}`, comment || undefined);
        wo.completedAt = nowIso();
        notify(d, [wo.requestedById], { title: 'Repair completed — please confirm', body: `${wo.number} · ${wo.title}. Confirm the issue is resolved.`, link: `/work-orders/${wo.id}`, level: 'success' });
      } else {
        move(d, wo, 'closed', actor.id, `Approved v${latest.version} · report finalised`, comment || undefined);
        wo.completedAt = wo.closedAt = nowIso();
      }
      notify(d, techs, { title: 'Your report was approved', body: `${wo.number} · ${wo.title}`, link: `/work-orders/${wo.id}`, level: 'success' });
    } else {
      wo.reworkCount += 1;
      move(d, wo, 'rework', actor.id, decision === 'evidence' ? `Additional evidence requested on v${latest.version}` : `Rework requested on v${latest.version}`, comment);
      if (newDueAt) wo.dueAt = newDueAt;
      wo.overdueNotified = false;
      notify(d, techs, { title: decision === 'evidence' ? 'More evidence requested' : 'Rework required', body: `${wo.number}: ${comment}`, link: `/work-orders/${wo.id}`, level: 'warning' });
      if (wo.reworkCount >= 2) {
        notify(d, managers(d), { title: 'Repeated quality failure', body: `${wo.number} has been returned ${wo.reworkCount} times.`, link: `/work-orders/${wo.id}`, level: 'warning' });
      }
    }
  });
}

export function returnToService(actor: User, woId: string, note: string) {
  if (!can(actor, 'wo.review')) fail('Only an authorised reviewer can return equipment to service.');
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (!['completed', 'closed'].includes(wo.status)) fail('Work must be approved before equipment is returned to service.');
    const asset = assetById(d, wo.assetId) ?? fail('No asset linked.');
    const from = asset.condition;
    asset.condition = 'operational';
    wo.returnedToServiceAt = nowIso();
    logAudit(d, actor.id, 'Equipment returned to service', 'asset', asset.id, { from, to: 'operational', reason: `${wo.number}${note ? ' — ' + note : ''}` });
    logAudit(d, actor.id, 'Equipment returned to service', 'work_order', wo.id, { reason: note || undefined });
  });
}

export function confirmResolution(actor: User, woId: string, resolved: boolean, comment: string) {
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (wo.requestedById !== actor.id) fail('Only the original requester can confirm resolution.');
    if (wo.status !== 'completed') fail('This request is not awaiting confirmation.');
    if (resolved) {
      wo.requesterConfirmation = 'confirmed';
      move(d, wo, 'closed', actor.id, 'Requester confirmed resolution', comment || undefined);
      wo.closedAt = nowIso();
      notify(d, [wo.supervisorId, wo.leadTechId], { title: 'Requester confirmed the fix', body: `${wo.number} closed`, link: `/work-orders/${wo.id}`, level: 'success' });
    } else {
      if (!comment.trim()) fail('Please describe what is still wrong.');
      wo.requesterConfirmation = 'reopened';
      wo.reworkCount += 1;
      move(d, wo, 'rework', actor.id, 'Reopened by requester — issue persists', comment);
      notify(d, [wo.supervisorId, wo.leadTechId], { title: 'Issue persists — reopened', body: `${wo.number}: ${comment}`, link: `/work-orders/${wo.id}`, level: 'warning' });
    }
  });
}

export function closeWO(actor: User, woId: string, reason: string) {
  if (!can(actor, 'wo.review')) fail('Only supervisors or managers can close work orders.');
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (wo.status !== 'completed') fail('Only approved work can be closed.');
    if (wo.source === 'fault' && !wo.requesterConfirmation && !reason.trim()) fail('Requester has not confirmed. Provide a reason to close anyway.');
    move(d, wo, 'closed', actor.id, 'Closed', reason || undefined);
    wo.closedAt = nowIso();
  });
}

export function cancelWO(actor: User, woId: string, reason: string) {
  if (!can(actor, 'wo.cancel')) fail('You are not authorised to cancel work orders.');
  if (!reason.trim()) fail('A justification is required to cancel a work order.');
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    if (wo.priority === 'critical' && actor.role !== 'manager') fail('Cancelling critical work requires Chief Engineer authorisation.');
    move(d, wo, 'cancelled', actor.id, 'Cancelled', reason);
  });
}

export function escalate(actor: User, woId: string, reason: string) {
  if (!reason.trim()) fail('Please give a reason for escalation.');
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    wo.escalated = true;
    logAudit(d, actor.id, 'Escalated to Chief Engineer', 'work_order', wo.id, { reason });
    notify(d, managers(d), { title: 'Work order escalated', body: `${wo.number}: ${reason}`, link: `/work-orders/${wo.id}`, level: 'critical' });
  });
}

export function addComment(actor: User, woId: string, text: string) {
  if (!text.trim()) return;
  return commit((d) => {
    const wo = requireWO(d, woId, actor);
    d.comments.push({ id: uid('cm'), woId: wo.id, userId: actor.id, text: text.trim(), at: nowIso() });
  });
}

// ---------------------------------------------------------------- assets
export function setAssetCondition(actor: User, assetId: string, condition: Condition, reason: string) {
  if (!can(actor, 'asset.manage') && !can(actor, 'wo.review')) fail('Not permitted to change asset condition.');
  if (!reason.trim()) fail('A reason is required.');
  return commit((d) => {
    const a = assetById(d, assetId) ?? fail('Asset not found.');
    const from = a.condition;
    a.condition = condition;
    logAudit(d, actor.id, 'Asset condition changed', 'asset', a.id, { from, to: condition, reason });
  });
}

export function createAsset(actor: User, input: Omit<Asset, 'id' | 'propertyId' | 'documents' | 'specs'> & { specs?: Record<string, string> }) {
  if (!can(actor, 'asset.manage')) fail('You do not have permission to register assets.');
  if (!input.code.trim() || !input.name.trim()) fail('Asset ID and name are required.');
  return commit((d) => {
    if (d.assets.some((a) => a.code.toLowerCase() === input.code.trim().toLowerCase())) fail(`Asset ID ${input.code} already exists.`);
    if (!d.locations.some((l) => l.id === input.locationId)) fail('Choose where this asset is located.');
    const a: Asset = { ...input, code: input.code.trim().toUpperCase(), id: uid('as'), propertyId: actor.propertyId, documents: [], specs: input.specs ?? {} };
    d.assets.push(a);
    logAudit(d, actor.id, 'Asset registered', 'asset', a.id, { to: a.code });
    return a;
  });
}

// ---------------------------------------------------------------- scheduling
export function occursOn(plan: MaintenancePlan, date: string): boolean {
  if (date < plan.startDate) return false;
  if (plan.endDate && date > plan.endDate) return false;
  const diff = daysBetween(plan.startDate, date);
  switch (plan.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return diff % 7 === 0;
    case 'every_n_days':
      return diff % Math.max(1, plan.interval) === 0;
    case 'monthly':
      return date.slice(8) === plan.startDate.slice(8);
  }
}

export function upcomingOccurrences(plan: MaintenancePlan, from: string, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const dt = addDays(from, i);
    if (occursOn(plan, dt)) out.push(dt);
  }
  return out;
}

const CATCH_UP_DAYS = 2;

/**
 * Idempotent: a work order is generated only if none exists for (planId, occurrenceDate).
 * Equivalent to a UNIQUE(plan_id, occurrence_date) constraint in Postgres.
 */
export function runScheduler(actorId = 'system'): { created: number; skipped: number; overdueAlerts: number } {
  let created = 0;
  let skipped = 0;
  let overdueAlerts = 0;
  const today = pkDate();
  const d0 = db;
  // detect whether there is anything to do before committing (avoid churn on background ticks)
  const pending = d0.plans.some((p) => {
    if (!p.active) return false;
    for (let i = CATCH_UP_DAYS; i >= 0; i--) {
      const dt = addDays(today, -i);
      if (occursOn(p, dt) && !d0.workOrders.some((w) => w.planId === p.id && w.occurrenceDate === dt)) return true;
    }
    return false;
  });
  const overduePending = d0.workOrders.some((w) => isOverdue(w) && !w.overdueNotified);
  if (!pending && !overduePending) {
    skipped = d0.plans.filter((p) => p.active).reduce((n, p) => n + [0, 1, 2].filter((i) => occursOn(p, addDays(today, -i))).length, 0);
    return { created, skipped, overdueAlerts };
  }
  commit((d) => {
    for (const p of d.plans) {
      if (!p.active) continue;
      for (let i = CATCH_UP_DAYS; i >= 0; i--) {
        const dt = addDays(today, -i);
        if (!occursOn(p, dt)) continue;
        if (d.workOrders.some((w) => w.planId === p.id && w.occurrenceDate === dt)) {
          skipped++;
          continue;
        }
        const asset = assetById(d, p.assetId)!;
        const tpl = d.templates.find((t) => t.id === p.templateId)!;
        const scheduledFor = pkAt(dt, p.dueTime);
        const wo: WorkOrder = {
          id: uid('wo'),
          number: nextNumber(d),
          title: `${p.name}`,
          description: `Scheduled ${p.frequency.replace('_', ' ')} task generated from maintenance plan.`,
          type: p.type,
          priority: p.priority,
          status: 'assigned',
          assetId: asset.id,
          locationId: asset.locationId,
          departmentId: asset.departmentId,
          requestedById: p.createdById,
          supervisorId: p.supervisorId,
          leadTechId: p.assigneeId,
          helperIds: [],
          createdAt: nowIso(),
          scheduledFor,
          dueAt: addHours(scheduledFor, p.windowHours),
          templateId: tpl.id,
          templateVersion: latestVersion(tpl).version,
          planId: p.id,
          occurrenceDate: dt,
          instructions: `Complete the "${tpl.name}" checklist for ${asset.code}. Record all readings with units and attach the required photographs.`,
          safety: 'Do not open energised panels. Wear hearing protection in plant rooms.',
          requiresApproval: p.requiresApproval,
          reworkCount: 0,
          source: 'schedule',
          propertyId: p.propertyId,
        };
        d.workOrders.push(wo);
        created++;
        logAudit(d, actorId, 'Generated by scheduler', 'work_order', wo.id, { to: 'assigned', reason: `Plan "${p.name}" · occurrence ${dt}` });
        notify(d, [p.assigneeId], { title: 'New scheduled task', body: `${wo.number} · ${wo.title} — due ${new Date(wo.dueAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' })}`, link: `/work-orders/${wo.id}`, level: 'info' });
      }
    }
    for (const wo of d.workOrders) {
      if (!isOverdue(wo) || wo.overdueNotified) continue;
      wo.overdueNotified = true;
      overdueAlerts++;
      const asset = assetById(d, wo.assetId);
      const critical = wo.priority === 'critical' || asset?.criticality === 'critical';
      logAudit(d, 'system', 'Overdue — escalation sent', 'work_order', wo.id, { reason: critical ? 'Notified technician, supervisor and Chief Engineer' : 'Notified technician and supervisor' });
      notify(d, [wo.leadTechId, wo.supervisorId, ...(critical ? managers(d) : [])], { title: 'Overdue work', body: `${wo.number} · ${wo.title}`, link: `/work-orders/${wo.id}`, level: critical ? 'critical' : 'warning' });
    }
  });
  return { created, skipped, overdueAlerts };
}

export type PlanInput = Omit<MaintenancePlan, 'id' | 'createdById' | 'createdAt' | 'propertyId' | 'active'>;

export function createPlan(actor: User, input: PlanInput) {
  if (!can(actor, 'plan.manage')) fail('You do not have permission to create maintenance plans.');
  if (!input.name.trim()) fail('Plan name is required.');
  if (!input.assetId) fail('Select an asset.');
  if (!input.templateId) fail('Select a checklist template.');
  if (!input.assigneeId) fail('Select the technician who will do this work.');
  if (!input.supervisorId) fail('Select the reviewing supervisor.');
  commit((d) => {
    checkAssignable(d, input.assigneeId);
    const p: MaintenancePlan = { ...input, id: uid('pl'), active: true, createdById: actor.id, createdAt: nowIso(), propertyId: actor.propertyId };
    d.plans.push(p);
    logAudit(d, actor.id, 'Maintenance plan created', 'plan', p.id, { to: `${p.name} · ${p.frequency}` });
  });
  return runScheduler(actor.id);
}

export function setPlanActive(actor: User, planId: string, active: boolean) {
  if (!can(actor, 'plan.manage')) fail('Not permitted.');
  commit((d) => {
    const p = d.plans.find((x) => x.id === planId) ?? fail('Plan not found');
    p.active = active;
    logAudit(d, actor.id, active ? 'Plan resumed' : 'Plan suspended', 'plan', p.id);
  });
  if (active) runScheduler(actor.id);
}

// ---------------------------------------------------------------- templates
export function saveTemplateVersion(actor: User, templateId: string | null, meta: { name: string; category: string; description: string }, fields: TemplateField[], note: string) {
  if (!can(actor, 'template.manage')) fail('You do not have permission to edit templates.');
  if (!meta.name.trim()) fail('Template name is required.');
  if (!fields.length) fail('Add at least one field.');
  fields.forEach((f) => {
    if (!f.label.trim()) fail('Every field needs a label.');
    if (f.type === 'select' && !(f.options && f.options.length)) fail(`"${f.label}" needs at least one option.`);
  });
  return commit((d) => {
    let t = d.templates.find((x) => x.id === templateId);
    if (!t) {
      t = { id: uid('tpl'), name: meta.name, category: meta.category, description: meta.description, versions: [], propertyId: actor.propertyId };
      d.templates.push(t);
    }
    t.name = meta.name;
    t.category = meta.category;
    t.description = meta.description;
    const v = (t.versions[t.versions.length - 1]?.version ?? 0) + 1;
    t.versions.push({ version: v, createdAt: nowIso(), createdById: actor.id, note: note || (v === 1 ? 'Initial version' : 'Updated'), fields: structuredClone(fields) });
    logAudit(d, actor.id, `Template saved as v${v}`, 'template', t.id, { to: t.name });
    return t;
  });
}

// ---------------------------------------------------------------- people
export function inviteUser(actor: User, input: Omit<User, 'id' | 'status' | 'propertyId' | 'passwordHash'> & { password?: string }) {
  if (!can(actor, 'employee.manage')) fail('Only administrators can add employees.');
  if (!input.name.trim() || !input.email.trim() || !input.employeeId.trim()) fail('Name, employee ID and email are required.');
  if (mode === 'live' && (input.password ?? '').length < 8) fail('Set a temporary password of at least 8 characters for this person.');
  const { password, ...rest } = input;
  input = rest as typeof input;
  return commit((d) => {
    if (d.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) fail('A user with this email already exists.');
    if (d.users.some((u) => u.employeeId === input.employeeId)) fail('Employee ID already in use.');
    const u: User = { ...input, email: input.email.trim().toLowerCase(), id: uid('u'), status: 'active', propertyId: actor.propertyId, passwordHash: password ? hashPassword(input.email, password) : undefined };
    d.users.push(u);
    logAudit(d, actor.id, 'Employee invited', 'user', u.id, { to: `${u.name} · ${ROLE_LABEL[u.role]}` });
    return u;
  });
}

export function setUserStatus(actor: User, userId: string, status: 'active' | 'suspended', reason: string) {
  if (!can(actor, 'employee.manage')) fail('Only administrators can suspend accounts.');
  if (userId === actor.id) fail('You cannot suspend your own account.');
  if (!reason.trim()) fail('A reason is required.');
  commit((d) => {
    const u = userById(d, userId) ?? fail('User not found');
    const from = u.status;
    u.status = status;
    logAudit(d, actor.id, status === 'suspended' ? 'Account suspended' : 'Account reactivated', 'user', u.id, { from, to: status, reason });
  });
}

export function createDepartment(actor: User, name: string, code: string, isEngineering: boolean) {
  if (!can(actor, 'employee.manage')) fail('Only administrators can create departments.');
  if (!name.trim() || !code.trim()) fail('Name and code are required.');
  commit((d) => {
    if (d.departments.some((x) => x.code.toLowerCase() === code.toLowerCase())) fail('Department code already exists.');
    const dep = { id: uid('d'), name: name.trim(), code: code.trim().toUpperCase(), isEngineering, propertyId: actor.propertyId };
    d.departments.push(dep);
    logAudit(d, actor.id, 'Department created', 'system', dep.id, { to: dep.name });
  });
}

// ---------------------------------------------------------------- notifications
export function markNotificationRead(id: string) {
  commit((d) => {
    const n = d.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  });
}
export function markAllRead(userId: string) {
  commit((d) => {
    d.notifications.forEach((n) => {
      if (n.userId === userId) n.read = true;
    });
  });
}

export { OPEN_STATUSES };
