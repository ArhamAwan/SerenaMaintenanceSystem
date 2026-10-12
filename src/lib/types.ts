// Core domain model for Serena Maintenance Hub (demo build).
// Mirrors the relational schema planned for the production backend (Postgres + Prisma).

export type RoleKey = 'admin' | 'manager' | 'supervisor' | 'technician' | 'requester';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  role: RoleKey;
  designation: string;
  departmentId: string;
  supervisorId?: string;
  skills: string[];
  shift: 'Morning' | 'Evening' | 'Night' | 'General';
  status: 'active' | 'suspended';
  propertyId: string;
  /** Live workspaces only: salted hash of the user's own password (demo users share the demo password). */
  passwordHash?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  isEngineering: boolean;
  propertyId: string;
}

export type LocationType = 'property' | 'building' | 'floor' | 'area' | 'room';

export interface Location {
  id: string;
  parentId: string | null;
  name: string;
  type: LocationType;
  propertyId: string;
}

export type Criticality = 'low' | 'medium' | 'high' | 'critical';
export type Condition = 'operational' | 'degraded' | 'faulty' | 'out_of_service' | 'decommissioned';

export interface Asset {
  id: string;
  code: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serial: string;
  locationId: string;
  departmentId: string;
  supervisorId: string;
  installDate: string; // YYYY-MM-DD
  warrantyUntil: string;
  vendor: string;
  criticality: Criticality;
  condition: Condition;
  specs: Record<string, string>;
  documents: { name: string; size: string }[];
  parentId?: string;
  propertyId: string;
}

export type FieldType = 'number' | 'yesno' | 'passfail' | 'select' | 'text' | 'photo' | 'rating';

export interface TemplateField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  unit?: string;
  options?: string[];
  // Threshold configuration for numeric readings. Outside normal => warning, outside critical => critical.
  normalMin?: number;
  normalMax?: number;
  critMin?: number;
  critMax?: number;
  // Select options that should be flagged
  warnOptions?: string[];
  critOptions?: string[];
  // Conditional visibility
  showIf?: { fieldId: string; equals: string };
  help?: string;
}

export interface TemplateVersion {
  version: number;
  createdAt: string;
  createdById: string;
  note: string;
  fields: TemplateField[];
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  versions: TemplateVersion[]; // immutable; latest = highest version
  propertyId: string;
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'every_n_days';

export interface MaintenancePlan {
  id: string;
  name: string;
  assetId: string;
  templateId: string;
  type: WOType;
  frequency: Frequency;
  interval: number; // for every_n_days
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  dueTime: string; // HH:mm (Asia/Karachi)
  windowHours: number; // time allowed after start time
  assigneeId: string;
  supervisorId: string;
  priority: Priority;
  requiresApproval: boolean;
  active: boolean;
  createdById: string;
  createdAt: string;
  propertyId: string;
}

export type WOType = 'preventive' | 'corrective' | 'emergency' | 'inspection';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type WOStatus =
  | 'triage'
  | 'assigned'
  | 'in_progress'
  | 'on_hold'
  | 'submitted'
  | 'rework'
  | 'completed'
  | 'closed'
  | 'cancelled';

export interface Photo {
  id: string;
  dataUrl: string;
  caption: string;
  stage: 'before' | 'during' | 'after' | 'reading' | 'defect' | 'general';
  fieldId?: string;
  uploadedById: string;
  at: string;
}

export type AnswerValue = string | number | null;

export interface DraftWork {
  answers: Record<string, AnswerValue>;
  photos: Photo[];
  notes: string;
  partsUsed: string;
  savedAt: string;
}

export interface FaultInfo {
  severity: Priority;
  guestImpact: boolean;
  equipmentOperational: boolean;
  safetyConcern: boolean;
  immediateAction: string;
  reportedAt: string;
  photos: Photo[];
}

export interface WorkOrder {
  id: string;
  number: string;
  title: string;
  description: string;
  type: WOType;
  priority: Priority;
  status: WOStatus;
  holdReason?: string;
  assetId?: string;
  locationId: string;
  departmentId: string;
  requestedById: string;
  supervisorId: string;
  leadTechId?: string;
  helperIds: string[];
  createdAt: string;
  scheduledFor: string;
  dueAt: string;
  templateId?: string;
  templateVersion?: number;
  planId?: string;
  occurrenceDate?: string; // idempotency key with planId
  instructions: string;
  safety: string;
  requiresApproval: boolean;
  startedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  closedAt?: string;
  reworkCount: number;
  source: 'schedule' | 'manual' | 'fault';
  fault?: FaultInfo;
  requesterConfirmation?: 'confirmed' | 'reopened';
  returnedToServiceAt?: string;
  escalated?: boolean;
  overdueNotified?: boolean;
  draft?: DraftWork;
  propertyId: string;
}

export interface ReadingFlag {
  fieldId: string;
  label: string;
  level: 'warning' | 'critical';
  value: string;
}

export interface Submission {
  id: string;
  woId: string;
  version: number;
  submittedById: string;
  submittedAt: string;
  startedAt?: string;
  templateId?: string;
  templateVersion?: number;
  answers: Record<string, AnswerValue>;
  photos: Photo[];
  notes: string;
  partsUsed: string;
  flags: ReadingFlag[];
}

export type ReviewDecision = 'approved' | 'rework' | 'evidence';

export interface Review {
  id: string;
  woId: string;
  submissionId: string;
  version: number;
  reviewerId: string;
  decision: ReviewDecision;
  comment: string;
  newDueAt?: string;
  at: string;
}

export interface Comment {
  id: string;
  woId: string;
  userId: string;
  text: string;
  at: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  action: string;
  entity: 'work_order' | 'asset' | 'plan' | 'template' | 'user' | 'system';
  entityId: string;
  from?: string;
  to?: string;
  reason?: string;
}

export interface Notification {
  id: string;
  userId: string;
  at: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  level: 'info' | 'warning' | 'critical' | 'success';
}

export interface Db {
  schemaVersion: number;
  /** 'demo' = seeded sample data; 'live' = empty workspace set up by the user */
  kind?: 'demo' | 'live';
  seededAt: string;
  property: { id: string; name: string; group: string; timezone: string; city: string };
  users: User[];
  departments: Department[];
  locations: Location[];
  assets: Asset[];
  templates: Template[];
  plans: MaintenancePlan[];
  workOrders: WorkOrder[];
  submissions: Submission[];
  reviews: Review[];
  comments: Comment[];
  audit: AuditEvent[];
  notifications: Notification[];
  counters: { wo: number };
}
