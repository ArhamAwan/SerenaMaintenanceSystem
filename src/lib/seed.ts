// Demonstration data for Islamabad Serena Hotel.
// All people, equipment, readings and thresholds below are FICTIONAL demo records — not verified details
// of the hotel's actual staff or installed plant. Threshold values are placeholders to be replaced
// with manufacturer-approved limits.
import type {
  AnswerValue, Asset, AuditEvent, Db, Department, Location, MaintenancePlan, Notification, Photo, Review, Submission,
  Template, TemplateField, User, WorkOrder,
} from './types';
import { addDays, addHours, addMinutes, pkAt, pkDate } from './time';
import { evaluateFlags } from './rules';
import { demoPhoto, makePhoto } from './photos';

const P = 'prop-isb';

export function standardDepartments(P: string): Department[] {
  return [
    { id: 'd-eng', code: 'ENG', name: 'Engineering & Maintenance', isEngineering: true, propertyId: P },
    { id: 'd-mech', code: 'MEC', name: 'Mechanical / HVAC', isEngineering: true, propertyId: P },
    { id: 'd-elec', code: 'ELE', name: 'Electrical', isEngineering: true, propertyId: P },
    { id: 'd-plumb', code: 'PLB', name: 'Plumbing', isEngineering: true, propertyId: P },
    { id: 'd-fls', code: 'FLS', name: 'Fire & Life Safety', isEngineering: true, propertyId: P },
    { id: 'd-hk', code: 'HSK', name: 'Housekeeping & Laundry', isEngineering: false, propertyId: P },
    { id: 'd-kitchen', code: 'FNB', name: 'Kitchen / Food & Beverage', isEngineering: false, propertyId: P },
    { id: 'd-pool', code: 'SPA', name: 'Pool & Spa', isEngineering: false, propertyId: P },
    { id: 'd-admin', code: 'ADM', name: 'Hotel Administration', isEngineering: false, propertyId: P },
  ];
}

/** Standard checklist library (generator, chiller, fire pump, pump, repair, preventive service). */
export function standardTemplates(P: string, createdById: string, when: (daysAgo: number) => string): Template[] {
  const genFieldsV1: TemplateField[] = [
    { id: 'g_fuel', label: 'Fuel level', type: 'number', unit: '%', required: true, normalMin: 40, critMin: 20, help: 'Read from day-tank gauge' },
    { id: 'g_oil', label: 'Engine oil level', type: 'select', options: ['Normal', 'Low', 'Critically low'], warnOptions: ['Low'], critOptions: ['Critically low'], required: true },
    { id: 'g_coolant', label: 'Coolant level', type: 'select', options: ['Normal', 'Low', 'Critically low'], warnOptions: ['Low'], critOptions: ['Critically low'], required: true },
    { id: 'g_batt', label: 'Battery voltage', type: 'number', unit: 'V', required: true, normalMin: 24.5, normalMax: 28.8, critMin: 23, critMax: 30 },
    { id: 'g_hours', label: 'Operating hours (meter)', type: 'number', unit: 'h', required: true },
    { id: 'g_leak', label: 'Leakage observed', type: 'yesno', required: true, warnOptions: ['Yes'] },
    { id: 'g_leak_type', label: 'Leakage type', type: 'select', options: ['Fuel', 'Oil', 'Coolant', 'Exhaust'], required: true, showIf: { fieldId: 'g_leak', equals: 'Yes' } },
    { id: 'g_leak_sev', label: 'Leak severity', type: 'select', options: ['Minor seep', 'Active drip', 'Major leak'], critOptions: ['Major leak'], warnOptions: ['Active drip'], required: true, showIf: { fieldId: 'g_leak', equals: 'Yes' } },
    { id: 'g_leak_photo', label: 'Close-up photo of leak', type: 'photo', required: true, showIf: { fieldId: 'g_leak', equals: 'Yes' } },
    { id: 'g_sound', label: 'Unusual sound or vibration', type: 'yesno', required: true, warnOptions: ['Yes'] },
    { id: 'g_damage', label: 'Visible equipment damage', type: 'yesno', required: true, warnOptions: ['Yes'] },
    { id: 'g_cond', label: 'Overall condition', type: 'select', options: ['Good', 'Fair', 'Poor'], warnOptions: ['Fair'], critOptions: ['Poor'], required: true },
    { id: 'g_remarks', label: 'Technician remarks', type: 'text', required: false },
  ];
  const genFieldsV2: TemplateField[] = [
    ...genFieldsV1.slice(0, 12),
    { id: 'g_panel_photo', label: 'Control panel photo (readings visible)', type: 'photo', required: true },
    genFieldsV1[12],
  ];
  const chillerFields: TemplateField[] = [
    { id: 'c_chws', label: 'Chilled water supply temperature', type: 'number', unit: '°C', required: true, normalMin: 5.5, normalMax: 8, critMax: 10 },
    { id: 'c_chwr', label: 'Chilled water return temperature', type: 'number', unit: '°C', required: true, normalMin: 10, normalMax: 14 },
    { id: 'c_cond_p', label: 'Condenser pressure', type: 'number', unit: 'bar', required: true, normalMin: 7, normalMax: 11.5, critMax: 14 },
    { id: 'c_oil_p', label: 'Oil pressure differential', type: 'number', unit: 'bar', required: true, normalMin: 1.2, critMin: 0.8 },
    { id: 'c_leak', label: 'Refrigerant or water leakage observed', type: 'yesno', required: true, warnOptions: ['Yes'] },
    { id: 'c_leak_loc', label: 'Leak location & description', type: 'text', required: true, showIf: { fieldId: 'c_leak', equals: 'Yes' } },
    { id: 'c_leak_photo', label: 'Close-up photo of leak', type: 'photo', required: true, showIf: { fieldId: 'c_leak', equals: 'Yes' } },
    { id: 'c_vib', label: 'Compressor vibration & noise check', type: 'passfail', required: true },
    { id: 'c_photo', label: 'Chiller control panel photo', type: 'photo', required: true },
    { id: 'c_remarks', label: 'Technician remarks', type: 'text', required: false },
  ];
  const fireFields: TemplateField[] = [
    { id: 'f_start', label: 'Automatic start on pressure drop', type: 'passfail', required: true },
    { id: 'f_press', label: 'Discharge pressure at churn', type: 'number', unit: 'bar', required: true, normalMin: 7, normalMax: 10, critMin: 5.5 },
    { id: 'f_run', label: 'Test run duration', type: 'number', unit: 'min', required: true, normalMin: 30 },
    { id: 'f_fuel', label: 'Driver fuel tank level', type: 'number', unit: '%', required: true, normalMin: 66, critMin: 50 },
    { id: 'f_leak', label: 'Leakage at pump / pipework', type: 'yesno', required: true, warnOptions: ['Yes'] },
    { id: 'f_leak_photo', label: 'Close-up photo of leak', type: 'photo', required: true, showIf: { fieldId: 'f_leak', equals: 'Yes' } },
    { id: 'f_photo', label: 'Pump set photo', type: 'photo', required: true },
    { id: 'f_remarks', label: 'Technician remarks', type: 'text', required: false },
  ];
  const pumpFields: TemplateField[] = [
    { id: 'p_dis', label: 'Discharge pressure', type: 'number', unit: 'bar', required: true, normalMin: 3, normalMax: 6 },
    { id: 'p_amp', label: 'Motor current', type: 'number', unit: 'A', required: true, normalMax: 18, critMax: 22 },
    { id: 'p_seal', label: 'Mechanical seal leakage', type: 'yesno', required: true, warnOptions: ['Yes'] },
    { id: 'p_strainer', label: 'Strainer basket cleaned', type: 'passfail', required: true },
    { id: 'p_photo', label: 'Pump photo', type: 'photo', required: true },
    { id: 'p_remarks', label: 'Technician remarks', type: 'text', required: false },
  ];
  const repairFields: TemplateField[] = [
    { id: 'r_before', label: 'Before-work photo', type: 'photo', required: true },
    { id: 'r_diag', label: 'Diagnosis / root cause', type: 'text', required: true },
    { id: 'r_work', label: 'Work performed', type: 'text', required: true },
    { id: 'r_test', label: 'Post-repair functional test', type: 'passfail', required: true },
    { id: 'r_after', label: 'After-work photo', type: 'photo', required: true },
    { id: 'r_remarks', label: 'Remarks / follow-up needed', type: 'text', required: false },
  ];
  const serviceFields: TemplateField[] = [
    { id: 's_isol', label: 'Equipment isolated & locked out', type: 'passfail', required: true },
    { id: 's_filters', label: 'Filters / strainers replaced or cleaned', type: 'passfail', required: true },
    { id: 's_tasks', label: 'All manufacturer service tasks completed', type: 'passfail', required: true },
    { id: 's_before', label: 'Before-service photo', type: 'photo', required: true },
    { id: 's_after', label: 'After-service photo', type: 'photo', required: true },
    { id: 's_notes', label: 'Service notes', type: 'text', required: true },
  ];
  const tv = (version: number, fields: TemplateField[], daysAgo: number, note: string) => ({ version, fields, createdAt: when(daysAgo), createdById, note });
  return [
    { id: 'tpl-gen', name: 'Generator Daily Inspection', category: 'Generators', description: 'Daily visual inspection, fluid levels, battery and run-hours.', versions: [tv(1, genFieldsV1, 90, 'Initial version'), tv(2, genFieldsV2, 35, 'Added mandatory control-panel photo')], propertyId: P },
    { id: 'tpl-chiller', name: 'Chiller Weekly Inspection', category: 'Chillers', description: 'Water temperatures, pressures, leakage and vibration.', versions: [tv(1, chillerFields, 80, 'Initial version')], propertyId: P },
    { id: 'tpl-fire', name: 'Fire Pump Weekly Run Test', category: 'Fire Pumps', description: 'Automatic start, churn pressure and run duration.', versions: [tv(1, fireFields, 80, 'Initial version')], propertyId: P },
    { id: 'tpl-pump', name: 'Pump Routine Inspection', category: 'Pumps', description: 'Pressure, current, seal leakage and strainer.', versions: [tv(1, pumpFields, 80, 'Initial version')], propertyId: P },
    { id: 'tpl-repair', name: 'Corrective Repair Report', category: 'General', description: 'Diagnosis, work performed, test, before/after evidence.', versions: [tv(1, repairFields, 90, 'Initial version')], propertyId: P },
    { id: 'tpl-service', name: 'Preventive Service Checklist', category: 'General', description: 'Isolation, filters, service tasks, before/after evidence.', versions: [tv(1, serviceFields, 90, 'Initial version')], propertyId: P },
  ];

}


export function buildSeed(): Db {
  const T = pkDate();
  const NOW = new Date().toISOString();
  const day = (n: number) => addDays(T, n);
  const at = (n: number, time: string) => pkAt(day(n), time);

  // ------------------------------------------------------------ org
  const departments: Department[] = standardDepartments(P);

  const u = (o: Omit<User, 'status' | 'propertyId'>): User => ({ ...o, status: 'active', propertyId: P });
  const users: User[] = [
    u({ id: 'u-admin', employeeId: 'ISB-0007', name: 'Sana Mirza', email: 'sana.mirza@demo.serena', phone: '+92 300 0000007', role: 'admin', designation: 'Systems Administrator', departmentId: 'd-admin', skills: [], shift: 'General' }),
    u({ id: 'u-ce', employeeId: 'ISB-1001', name: 'Tariq Mahmood', email: 'tariq.mahmood@demo.serena', phone: '+92 300 0001001', role: 'manager', designation: 'Chief Engineer', departmentId: 'd-eng', skills: ['HVAC', 'Electrical', 'Power Generation'], shift: 'General' }),
    u({ id: 'u-sup1', employeeId: 'ISB-1012', name: 'Imran Siddiqui', email: 'imran.siddiqui@demo.serena', phone: '+92 300 0001012', role: 'supervisor', designation: 'Supervisor — Mechanical / HVAC', departmentId: 'd-mech', supervisorId: 'u-ce', skills: ['HVAC', 'Chillers', 'Generators'], shift: 'Morning' }),
    u({ id: 'u-sup2', employeeId: 'ISB-1018', name: 'Naveed Akhtar', email: 'naveed.akhtar@demo.serena', phone: '+92 300 0001018', role: 'supervisor', designation: 'Supervisor — Electrical & Fire Safety', departmentId: 'd-elec', supervisorId: 'u-ce', skills: ['Electrical', 'Fire Systems'], shift: 'Morning' }),
    u({ id: 'u-t1', employeeId: 'ISB-2031', name: 'Bilal Ahmed', email: 'bilal.ahmed@demo.serena', phone: '+92 300 0002031', role: 'technician', designation: 'Mechanical Technician', departmentId: 'd-mech', supervisorId: 'u-sup1', skills: ['Generators', 'Refrigeration', 'HVAC'], shift: 'Morning' }),
    u({ id: 'u-t2', employeeId: 'ISB-2044', name: 'Usman Raza', email: 'usman.raza@demo.serena', phone: '+92 300 0002044', role: 'technician', designation: 'Electrical Technician', departmentId: 'd-elec', supervisorId: 'u-sup2', skills: ['Electrical', 'Generators', 'Fire Pumps'], shift: 'Morning' }),
    u({ id: 'u-t3', employeeId: 'ISB-2052', name: 'Kamran Shah', email: 'kamran.shah@demo.serena', phone: '+92 300 0002052', role: 'technician', designation: 'Plumbing Technician', departmentId: 'd-plumb', supervisorId: 'u-sup1', skills: ['Pumps', 'Plumbing', 'Pool Plant'], shift: 'Evening' }),
    u({ id: 'u-t4', employeeId: 'ISB-2067', name: 'Hamza Iqbal', email: 'hamza.iqbal@demo.serena', phone: '+92 300 0002067', role: 'technician', designation: 'HVAC Technician', departmentId: 'd-mech', supervisorId: 'u-sup1', skills: ['Chillers', 'HVAC', 'Laundry Equipment'], shift: 'Morning' }),
    u({ id: 'u-hk', employeeId: 'ISB-3105', name: 'Rabia Noor', email: 'rabia.noor@demo.serena', phone: '+92 300 0003105', role: 'requester', designation: 'Executive Housekeeper', departmentId: 'd-hk', skills: [], shift: 'Morning' }),
    u({ id: 'u-chef', employeeId: 'ISB-3220', name: 'Adnan Malik', email: 'adnan.malik@demo.serena', phone: '+92 300 0003220', role: 'requester', designation: 'Executive Sous Chef', departmentId: 'd-kitchen', skills: [], shift: 'Morning' }),
  ];

  const L = (id: string, parentId: string | null, name: string, type: Location['type']): Location => ({ id, parentId, name, type, propertyId: P });
  const locations: Location[] = [
    L('loc-isb', null, 'Islamabad Serena Hotel', 'property'),
    L('loc-main', 'loc-isb', 'Main Building', 'building'),
    L('loc-bsmt', 'loc-main', 'Basement', 'floor'),
    L('loc-plant', 'loc-bsmt', 'Mechanical Plant Room', 'area'),
    L('loc-gen', 'loc-bsmt', 'Generator Hall', 'area'),
    L('loc-pump', 'loc-bsmt', 'Water Pump Room', 'area'),
    L('loc-fire', 'loc-bsmt', 'Fire Pump Room', 'area'),
    L('loc-gf', 'loc-main', 'Ground Floor', 'floor'),
    L('loc-kitchen', 'loc-gf', 'Main Kitchen', 'area'),
    L('loc-laundry', 'loc-gf', 'Laundry', 'area'),
    L('loc-lobby', 'loc-gf', 'Lobby & Front Office', 'area'),
    L('loc-guest', 'loc-isb', 'Guest Wing', 'building'),
    L('loc-f3', 'loc-guest', 'Third Floor', 'floor'),
    L('loc-305', 'loc-f3', 'Room 305', 'room'),
    L('loc-306', 'loc-f3', 'Room 306', 'room'),
    L('loc-grounds', 'loc-isb', 'Grounds & Leisure', 'building'),
    L('loc-pool', 'loc-grounds', 'Pool & Spa Plant', 'area'),
  ];

  const A = (o: Omit<Asset, 'propertyId' | 'documents'> & { documents?: Asset['documents'] }): Asset => ({
    documents: [
      { name: `${o.code} — Operation & Maintenance Manual.pdf`, size: '4.2 MB' },
      { name: `${o.code} — Warranty Certificate.pdf`, size: '320 KB' },
    ],
    ...o,
    propertyId: P,
  });
  const assets: Asset[] = [
    A({ id: 'as-gen1', code: 'GEN-001', name: 'Main Diesel Generator', category: 'Generators', manufacturer: 'Cummins (demo)', model: 'C1100 D5', serial: 'DEMO-GN-48213', locationId: 'loc-gen', departmentId: 'd-elec', supervisorId: 'u-sup1', installDate: '2017-03-14', warrantyUntil: '2022-03-14', vendor: 'PowerGen Services (demo)', criticality: 'critical', condition: 'operational', specs: { 'Rated output': '1100 kVA', Fuel: 'Diesel', 'Battery system': '24 V DC', 'Tank capacity': '2,000 L' } }),
    A({ id: 'as-gen2', code: 'GEN-002', name: 'Backup Diesel Generator', category: 'Generators', manufacturer: 'Cummins (demo)', model: 'C825 D5', serial: 'DEMO-GN-48977', locationId: 'loc-gen', departmentId: 'd-elec', supervisorId: 'u-sup2', installDate: '2019-08-02', warrantyUntil: '2024-08-02', vendor: 'PowerGen Services (demo)', criticality: 'critical', condition: 'operational', specs: { 'Rated output': '825 kVA', Fuel: 'Diesel', 'Battery system': '24 V DC' } }),
    A({ id: 'as-ch1', code: 'CH-001', name: 'Centrifugal Chiller No. 1', category: 'Chillers', manufacturer: 'Carrier (demo)', model: '19XR', serial: 'DEMO-CH-22018', locationId: 'loc-plant', departmentId: 'd-mech', supervisorId: 'u-sup1', installDate: '2016-05-20', warrantyUntil: '2021-05-20', vendor: 'CoolTech HVAC (demo)', criticality: 'critical', condition: 'operational', specs: { Capacity: '450 TR', Refrigerant: 'R-134a' } }),
    A({ id: 'as-ch2', code: 'CH-002', name: 'Centrifugal Chiller No. 2', category: 'Chillers', manufacturer: 'Carrier (demo)', model: '19XR', serial: 'DEMO-CH-22019', locationId: 'loc-plant', departmentId: 'd-mech', supervisorId: 'u-sup1', installDate: '2016-05-20', warrantyUntil: '2021-05-20', vendor: 'CoolTech HVAC (demo)', criticality: 'high', condition: 'operational', specs: { Capacity: '450 TR', Refrigerant: 'R-134a' } }),
    A({ id: 'as-wp1', code: 'WP-001', name: 'Domestic Water Booster Pump', category: 'Water Pumps', manufacturer: 'Grundfos (demo)', model: 'Hydro MPC-E', serial: 'DEMO-WP-90311', locationId: 'loc-pump', departmentId: 'd-plumb', supervisorId: 'u-sup1', installDate: '2020-01-11', warrantyUntil: '2025-01-11', vendor: 'AquaFlow Engineering (demo)', criticality: 'high', condition: 'operational', specs: { Flow: '45 m³/h', Motor: '11 kW' } }),
    A({ id: 'as-fp1', code: 'FP-001', name: 'Diesel Fire Pump', category: 'Fire Pumps', manufacturer: 'Patterson (demo)', model: 'Split-case 6x4', serial: 'DEMO-FP-77120', locationId: 'loc-fire', departmentId: 'd-fls', supervisorId: 'u-sup2', installDate: '2015-11-02', warrantyUntil: '2020-11-02', vendor: 'SafeGuard Fire Systems (demo)', criticality: 'critical', condition: 'operational', specs: { 'Rated flow': '1000 GPM', Driver: 'Diesel engine' } }),
    A({ id: 'as-kf1', code: 'KF-001', name: 'Walk-in Freezer — Main Kitchen', category: 'Kitchen Refrigeration', manufacturer: 'Foster (demo)', model: 'WI-F 3.0', serial: 'DEMO-KF-11845', locationId: 'loc-kitchen', departmentId: 'd-mech', supervisorId: 'u-sup1', installDate: '2021-06-30', warrantyUntil: '2026-06-30', vendor: 'ColdChain Kitchens (demo)', criticality: 'high', condition: 'out_of_service', specs: { 'Set point': '−18 °C', Refrigerant: 'R-404A' } }),
    A({ id: 'as-lw1', code: 'LW-001', name: 'Industrial Washer Extractor No. 1', category: 'Laundry Equipment', manufacturer: 'Electrolux (demo)', model: 'WH6-33', serial: 'DEMO-LW-55102', locationId: 'loc-laundry', departmentId: 'd-mech', supervisorId: 'u-sup1', installDate: '2019-02-18', warrantyUntil: '2023-02-18', vendor: 'LaundryPro (demo)', criticality: 'medium', condition: 'degraded', specs: { Capacity: '33 kg' } }),
    A({ id: 'as-pf1', code: 'PF-001', name: 'Pool Filtration Pump', category: 'Pool Equipment', manufacturer: 'Pentair (demo)', model: 'WhisperFlo', serial: 'DEMO-PF-30440', locationId: 'loc-pool', departmentId: 'd-plumb', supervisorId: 'u-sup1', installDate: '2022-04-05', warrantyUntil: '2025-04-05', vendor: 'BlueWater Pools (demo)', criticality: 'medium', condition: 'operational', specs: { Motor: '2.2 kW' } }),
    A({ id: 'as-ac305', code: 'AC-305', name: 'Guest Room Fan Coil Unit — 305', category: 'Guest Room HVAC', manufacturer: 'Daikin (demo)', model: 'FWD-12', serial: 'DEMO-AC-30512', locationId: 'loc-305', departmentId: 'd-mech', supervisorId: 'u-sup1', installDate: '2018-09-09', warrantyUntil: '2021-09-09', vendor: 'CoolTech HVAC (demo)', criticality: 'low', condition: 'operational', specs: { Type: 'Ceiling concealed FCU' } }),
  ];

  // ------------------------------------------------------------ templates
  const templates: Template[] = standardTemplates(P, 'u-sup1', (daysAgo: number) => at(-daysAgo, '10:00'));

  // ------------------------------------------------------------ plans
  const plan = (o: Omit<MaintenancePlan, 'propertyId' | 'active' | 'createdAt' | 'createdById' | 'requiresApproval' | 'endDate'> & { createdById?: string }): MaintenancePlan => ({
    createdById: 'u-sup1', ...o, active: true, requiresApproval: true, createdAt: at(-45, '10:00'), propertyId: P,
  });
  const plans: MaintenancePlan[] = [
    plan({ id: 'pl-gen1', name: 'GEN-001 Daily Inspection', assetId: 'as-gen1', templateId: 'tpl-gen', type: 'inspection', frequency: 'daily', interval: 1, startDate: day(-40), dueTime: '08:00', windowHours: 10, assigneeId: 'u-t1', supervisorId: 'u-sup1', priority: 'medium' }),
    plan({ id: 'pl-gen2', name: 'GEN-002 Daily Inspection', assetId: 'as-gen2', templateId: 'tpl-gen', type: 'inspection', frequency: 'daily', interval: 1, startDate: day(-40), dueTime: '08:30', windowHours: 10, assigneeId: 'u-t2', supervisorId: 'u-sup2', priority: 'medium', createdById: 'u-sup2' }),
    plan({ id: 'pl-ch1', name: 'CH-001 Weekly Inspection', assetId: 'as-ch1', templateId: 'tpl-chiller', type: 'inspection', frequency: 'weekly', interval: 1, startDate: day(-28), dueTime: '10:00', windowHours: 6, assigneeId: 'u-t4', supervisorId: 'u-sup1', priority: 'medium' }),
    plan({ id: 'pl-fp1', name: 'FP-001 Weekly Run Test', assetId: 'as-fp1', templateId: 'tpl-fire', type: 'inspection', frequency: 'weekly', interval: 1, startDate: day(-29), dueTime: '11:00', windowHours: 6, assigneeId: 'u-t2', supervisorId: 'u-sup2', priority: 'high', createdById: 'u-sup2' }),
    plan({ id: 'pl-pf1', name: 'PF-001 Weekly Inspection', assetId: 'as-pf1', templateId: 'tpl-pump', type: 'inspection', frequency: 'weekly', interval: 1, startDate: day(-30), dueTime: '09:00', windowHours: 6, assigneeId: 'u-t3', supervisorId: 'u-sup1', priority: 'low' }),
    plan({ id: 'pl-wp1', name: 'WP-001 Monthly Inspection', assetId: 'as-wp1', templateId: 'tpl-pump', type: 'preventive', frequency: 'every_n_days', interval: 30, startDate: day(-20), dueTime: '10:00', windowHours: 8, assigneeId: 'u-t3', supervisorId: 'u-sup1', priority: 'medium' }),
  ];

  // ------------------------------------------------------------ work orders + history
  const workOrders: WorkOrder[] = [];
  const submissions: Submission[] = [];
  const reviews: Review[] = [];
  const audit: AuditEvent[] = [];
  const notifications: Notification[] = [];
  const comments: Db['comments'] = [];
  let counter = 0;
  const year = new Date().getFullYear();
  const num = () => `WO-${year}-${String(++counter).padStart(4, '0')}`;
  const ev = (atIso: string, actorId: string, action: string, entityId: string, extra: Partial<AuditEvent> = {}) =>
    audit.push({ id: `ev-s${audit.length}`, at: atIso, actorId, action, entity: 'work_order', entityId, ...extra });

  const tplVer = (id: string) => templates.find((t) => t.id === id)!.versions.slice(-1)[0];

  function wo(o: Partial<WorkOrder> & Pick<WorkOrder, 'id' | 'title' | 'type' | 'priority' | 'status' | 'supervisorId' | 'requestedById' | 'createdAt' | 'scheduledFor' | 'dueAt'>): WorkOrder {
    const asset = assets.find((a) => a.id === o.assetId);
    const w: WorkOrder = {
      number: num(), description: '', locationId: asset?.locationId ?? 'loc-main', departmentId: asset?.departmentId ?? 'd-eng',
      helperIds: [], instructions: '', safety: 'Follow standard isolation procedures.', requiresApproval: true, reworkCount: 0, source: 'manual', propertyId: P,
      ...o,
    } as WorkOrder;
    workOrders.push(w);
    return w;
  }

  function sub(w: WorkOrder, version: number, by: string, atIso: string, answers: Record<string, AnswerValue>, photos: Photo[], notes = '', startedMinBefore = 25, partsUsed = '') {
    const tpl = templates.find((t) => t.id === w.templateId)!;
    const fields = (tpl.versions.find((v) => v.version === w.templateVersion) ?? tpl.versions.slice(-1)[0]).fields;
    const s: Submission = {
      id: `sub-${w.id}-${version}`, woId: w.id, version, submittedById: by, submittedAt: atIso, startedAt: addMinutes(atIso, -startedMinBefore),
      templateId: w.templateId, templateVersion: w.templateVersion, answers, photos, notes, partsUsed, flags: evaluateFlags(fields, answers),
    };
    submissions.push(s);
    return s;
  }
  function review(w: WorkOrder, s: Submission, by: string, atIso: string, decision: Review['decision'], comment: string, newDueAt?: string) {
    reviews.push({ id: `rv-${s.id}`, woId: w.id, submissionId: s.id, version: s.version, reviewerId: by, decision, comment, at: atIso, newDueAt });
  }
  const ph = (label: string, hue: number, variant: number, by: string, stage: Photo['stage'], fieldId: string | undefined, atIso: string) =>
    makePhoto(demoPhoto(label, hue, variant), by, stage, label, fieldId, atIso);

  // --- GEN-001 daily inspection history (13 days) — feeds the reading trend chart
  const battSeries = [27.2, 27.1, 27.3, 27.0, 26.9, 27.1, 27.0, 26.8, 24.1, 27.2, 27.1, 26.9, 27.0];
  const fuelSeries = [92, 86, 80, 74, 68, 62, 95, 89, 83, 77, 71, 65, 58];
  for (let i = 13; i >= 1; i--) {
    const idx = 13 - i;
    const occ = day(-i);
    const sched = pkAt(occ, '08:00');
    const w = wo({
      id: `wo-gen1-h${i}`, title: 'GEN-001 Daily Inspection', type: 'inspection', priority: 'medium', status: 'closed', assetId: 'as-gen1', supervisorId: 'u-sup1', requestedById: 'u-sup1', leadTechId: 'u-t1',
      createdAt: addHours(sched, -2), scheduledFor: sched, dueAt: addHours(sched, 4), templateId: 'tpl-gen', templateVersion: 2, planId: 'pl-gen1', occurrenceDate: occ, source: 'schedule',
      instructions: 'Complete the "Generator Daily Inspection" checklist for GEN-001.',
    });
    const subAt = addMinutes(sched, 35 + (idx % 4) * 10);
    const s = sub(w, 1, 'u-t1', subAt, {
      g_fuel: fuelSeries[idx], g_oil: 'Normal', g_coolant: 'Normal', g_batt: battSeries[idx], g_hours: 18420 + idx * 3 + (idx > 8 ? 2 : 0), g_leak: 'No', g_sound: 'No', g_damage: 'No', g_cond: 'Good',
      g_remarks: battSeries[idx] < 24.5 ? 'Battery voltage low on reading. Charger LED amber.' : '',
    }, [ph('GEN-001 control panel', 150, 2, 'u-t1', 'reading', 'g_panel_photo', subAt)]);
    const rvAt = addMinutes(subAt, 40);
    review(w, s, 'u-sup1', rvAt, 'approved', battSeries[idx] < 24.5 ? 'Charger breaker had tripped — reset by electrical. Voltage back to normal on re-check.' : '');
    w.startedAt = s.startedAt; w.submittedAt = subAt; w.completedAt = w.closedAt = rvAt;
    ev(w.createdAt, 'system', 'Generated by scheduler', w.id, { to: 'assigned', reason: `Plan "GEN-001 Daily Inspection" · occurrence ${occ}` });
    ev(s.startedAt!, 'u-t1', 'Work started', w.id, { from: 'assigned', to: 'in_progress' });
    ev(subAt, 'u-t1', 'Report submitted (v1)', w.id, { reason: s.flags.length ? `${s.flags.length} abnormal reading(s)` : undefined });
    ev(subAt, 'u-t1', 'Submitted for review', w.id, { from: 'in_progress', to: 'submitted' });
    ev(rvAt, 'u-sup1', 'Approved v1 · report finalised', w.id, { from: 'submitted', to: 'closed' });
  }

  // --- GEN-002: daily history, including a successfully completed re-inspection (T-3)
  for (let i = 3; i >= 1; i--) {
    const occ = day(-i);
    const sched = pkAt(occ, '08:30');
    const w = wo({
      id: `wo-gen2-h${i}`, title: 'GEN-002 Daily Inspection', type: 'inspection', priority: 'medium', status: 'closed', assetId: 'as-gen2', supervisorId: 'u-sup2', requestedById: 'u-sup2', leadTechId: 'u-t2',
      createdAt: addHours(sched, -2), scheduledFor: sched, dueAt: addHours(sched, 4), templateId: 'tpl-gen', templateVersion: 2, planId: 'pl-gen2', occurrenceDate: occ, source: 'schedule',
      instructions: 'Complete the "Generator Daily Inspection" checklist for GEN-002.',
    });
    ev(w.createdAt, 'system', 'Generated by scheduler', w.id, { to: 'assigned', reason: `Plan "GEN-002 Daily Inspection" · occurrence ${occ}` });
    const base = { g_fuel: 88 - i * 4, g_oil: 'Normal', g_coolant: 'Normal', g_batt: 27.0, g_hours: 6120 + (3 - i) * 2, g_leak: 'No', g_sound: 'No', g_damage: 'No', g_cond: 'Good', g_remarks: '' };
    const s1At = addMinutes(sched, 30);
    ev(addMinutes(s1At, -20), 'u-t2', 'Work started', w.id, { from: 'assigned', to: 'in_progress' });
    if (i === 3) {
      const s1 = sub(w, 1, 'u-t2', s1At, base, [ph('GEN-002 panel (blurred)', 30, 2, 'u-t2', 'reading', 'g_panel_photo', s1At)], '', 20);
      ev(s1At, 'u-t2', 'Report submitted (v1)', w.id);
      ev(s1At, 'u-t2', 'Submitted for review', w.id, { from: 'in_progress', to: 'submitted' });
      const r1 = addMinutes(s1At, 50);
      review(w, s1, 'u-sup2', r1, 'evidence', 'Panel photo is blurred and the battery voltage is not legible. Please retake the control-panel photo with the readings clearly visible.', addHours(r1, 3));
      ev(r1, 'u-sup2', 'Additional evidence requested on v1', w.id, { from: 'submitted', to: 'rework', reason: 'Panel photo is blurred and the battery voltage is not legible.' });
      const s2At = addMinutes(r1, 70);
      ev(addMinutes(s2At, -15), 'u-t2', 'Rework started', w.id, { from: 'rework', to: 'in_progress' });
      const s2 = sub(w, 2, 'u-t2', s2At, { ...base, g_batt: 27.1, g_remarks: 'Retook panel photo in better light.' }, [ph('GEN-002 control panel — retaken', 150, 2, 'u-t2', 'reading', 'g_panel_photo', s2At)], 'Retook panel photo in better light.', 15);
      ev(s2At, 'u-t2', 'Report submitted (v2)', w.id);
      ev(s2At, 'u-t2', 'Resubmitted for review', w.id, { from: 'in_progress', to: 'submitted' });
      const r2 = addMinutes(s2At, 25);
      review(w, s2, 'u-sup2', r2, 'approved', 'Readings legible now. Approved.');
      ev(r2, 'u-sup2', 'Approved v2 · report finalised', w.id, { from: 'submitted', to: 'closed' });
      w.reworkCount = 1; w.startedAt = s2.startedAt; w.submittedAt = s2At; w.completedAt = w.closedAt = r2;
    } else {
      const s = sub(w, 1, 'u-t2', s1At, base, [ph('GEN-002 control panel', 150, 2, 'u-t2', 'reading', 'g_panel_photo', s1At)], '', 20);
      ev(s1At, 'u-t2', 'Report submitted (v1)', w.id);
      ev(s1At, 'u-t2', 'Submitted for review', w.id, { from: 'in_progress', to: 'submitted' });
      const r = addMinutes(s1At, 45);
      review(w, s, 'u-sup2', r, 'approved', '');
      ev(r, 'u-sup2', 'Approved v1 · report finalised', w.id, { from: 'submitted', to: 'closed' });
      w.startedAt = s.startedAt; w.submittedAt = s1At; w.completedAt = w.closedAt = r;
    }
  }

  // --- CH-001 weekly inspection: SUBMITTED today, awaiting supervisor review (with a flagged reading)
  {
    const sched = addMinutes(NOW, -110);
    const w = wo({
      id: 'wo-ch1-today', title: 'CH-001 Weekly Inspection', type: 'inspection', priority: 'medium', status: 'submitted', assetId: 'as-ch1', supervisorId: 'u-sup1', requestedById: 'u-sup1', leadTechId: 'u-t4',
      createdAt: addHours(sched, -2), scheduledFor: sched, dueAt: addHours(sched, 6), templateId: 'tpl-chiller', templateVersion: 1, planId: 'pl-ch1', occurrenceDate: day(0), source: 'schedule',
      instructions: 'Complete the "Chiller Weekly Inspection" checklist for CH-001. Record all readings with units.',
      safety: 'Hearing protection mandatory in the plant room. Do not open energised starter panels.',
    });
    // previous weeks for chart
    for (const k of [21, 14, 7]) {
      const occ = day(-k);
      const sch = pkAt(occ, '10:00');
      const h = wo({ id: `wo-ch1-h${k}`, title: 'CH-001 Weekly Inspection', type: 'inspection', priority: 'medium', status: 'closed', assetId: 'as-ch1', supervisorId: 'u-sup1', requestedById: 'u-sup1', leadTechId: 'u-t4', createdAt: addHours(sch, -2), scheduledFor: sch, dueAt: addHours(sch, 6), templateId: 'tpl-chiller', templateVersion: 1, planId: 'pl-ch1', occurrenceDate: occ, source: 'schedule' });
      const sAt = addMinutes(sch, 60);
      const s = sub(h, 1, 'u-t4', sAt, { c_chws: 6.6 + (k % 3) * 0.2, c_chwr: 11.8, c_cond_p: 10.1 + (21 - k) * 0.12, c_oil_p: 1.6, c_leak: 'No', c_vib: 'Pass', c_remarks: '' }, [ph('CH-001 control panel', 200, 0, 'u-t4', 'reading', 'c_photo', sAt)], '', 40);
      const r = addMinutes(sAt, 90);
      review(h, s, 'u-sup1', r, 'approved', '');
      h.startedAt = s.startedAt; h.submittedAt = sAt; h.completedAt = h.closedAt = r;
      ev(h.createdAt, 'system', 'Generated by scheduler', h.id, { to: 'assigned' });
      ev(sAt, 'u-t4', 'Submitted for review', h.id, { from: 'in_progress', to: 'submitted' });
      ev(r, 'u-sup1', 'Approved v1 · report finalised', h.id, { from: 'submitted', to: 'closed' });
    }
    const sAt = addMinutes(sched, 55);
    w.startedAt = addMinutes(sAt, -42);
    w.submittedAt = sAt;
    sub(w, 1, 'u-t4', sAt, { c_chws: 7.1, c_chwr: 12.4, c_cond_p: 12.6, c_oil_p: 1.5, c_leak: 'No', c_vib: 'Pass', c_remarks: 'Condenser pressure higher than last week. Cooling tower fan 2 sounded rough.' },
      [ph('CH-001 control panel', 200, 0, 'u-t4', 'reading', 'c_photo', sAt), ph('CH-001 condenser side', 200, 1, 'u-t4', 'general', undefined, sAt)], 'Condenser pressure higher than last week. Cooling tower fan 2 sounded rough.', 42);
    ev(w.createdAt, 'system', 'Generated by scheduler', w.id, { to: 'assigned', reason: `Plan "CH-001 Weekly Inspection" · occurrence ${day(0)}` });
    ev(w.startedAt, 'u-t4', 'Work started', w.id, { from: 'assigned', to: 'in_progress' });
    ev(sAt, 'u-t4', 'Report submitted (v1)', w.id, { reason: '1 abnormal reading(s)' });
    ev(sAt, 'u-t4', 'Submitted for review', w.id, { from: 'in_progress', to: 'submitted' });
    notifications.push({ id: 'nt-s1', userId: 'u-sup1', at: sAt, title: 'Report awaiting your review', body: `${w.number} · CH-001 Weekly Inspection — by Hamza Iqbal`, link: `/work-orders/${w.id}/review`, read: false, level: 'info' });
    notifications.push({ id: 'nt-s2', userId: 'u-sup1', at: sAt, title: 'Abnormal reading flagged', body: 'CH-001: Condenser pressure 12.6 bar', link: `/work-orders/${w.id}/review`, read: false, level: 'warning' });
  }

  // --- FP-001 weekly run test: REJECTED → rework required
  {
    const occ = day(-1);
    const sched = pkAt(occ, '11:00');
    const w = wo({
      id: 'wo-fp1-rework', title: 'FP-001 Weekly Run Test', type: 'inspection', priority: 'high', status: 'rework', assetId: 'as-fp1', supervisorId: 'u-sup2', requestedById: 'u-sup2', leadTechId: 'u-t2',
      createdAt: addHours(sched, -2), scheduledFor: sched, dueAt: addHours(sched, 6), templateId: 'tpl-fire', templateVersion: 1, planId: 'pl-fp1', occurrenceDate: occ, source: 'schedule', reworkCount: 1,
      instructions: 'Run the diesel fire pump for at least 30 minutes. Record churn pressure and confirm automatic start.',
      safety: 'Notify security control room before the test run. Do not disable the fire alarm interface.',
    });
    const sAt = addMinutes(sched, 50);
    const s = sub(w, 1, 'u-t2', sAt, { f_start: 'Pass', f_press: 8.4, f_run: 30, f_fuel: 81, f_leak: 'No', f_remarks: 'Pump inspected. No visible leakage.' },
      [ph('FP-001 pump set — wide view', 10, 3, 'u-t2', 'general', 'f_photo', sAt)], 'Pump inspected. No visible leakage.', 45);
    const rAt = addMinutes(sAt, 65);
    const newDue = addHours(NOW, 5);
    review(w, s, 'u-sup2', rAt, 'rework', 'Wide photo shows staining under the lower discharge pipe connection. Please inspect the lower pipe connection again, attach close-up photographs, and record the discharge pressure reading at the gauge.', newDue);
    w.startedAt = s.startedAt; w.submittedAt = sAt; w.dueAt = newDue;
    ev(w.createdAt, 'system', 'Generated by scheduler', w.id, { to: 'assigned', reason: `Plan "FP-001 Weekly Run Test" · occurrence ${occ}` });
    ev(s.startedAt!, 'u-t2', 'Work started', w.id, { from: 'assigned', to: 'in_progress' });
    ev(sAt, 'u-t2', 'Report submitted (v1)', w.id);
    ev(sAt, 'u-t2', 'Submitted for review', w.id, { from: 'in_progress', to: 'submitted' });
    ev(rAt, 'u-sup2', 'Rework requested on v1', w.id, { from: 'submitted', to: 'rework', reason: 'Inspect the lower pipe connection again, attach close-ups, record discharge pressure.' });
    notifications.push({ id: 'nt-s3', userId: 'u-t2', at: rAt, title: 'Rework required', body: `${w.number}: Please inspect the lower pipe connection again, attach close-up photographs…`, link: `/work-orders/${w.id}`, read: false, level: 'warning' });
    // previous weeks
    for (const k of [8, 15]) {
      const o2 = day(-k);
      const sc = pkAt(o2, '11:00');
      const h = wo({ id: `wo-fp1-h${k}`, title: 'FP-001 Weekly Run Test', type: 'inspection', priority: 'high', status: 'closed', assetId: 'as-fp1', supervisorId: 'u-sup2', requestedById: 'u-sup2', leadTechId: 'u-t2', createdAt: addHours(sc, -2), scheduledFor: sc, dueAt: addHours(sc, 6), templateId: 'tpl-fire', templateVersion: 1, planId: 'pl-fp1', occurrenceDate: o2, source: 'schedule' });
      const a2 = addMinutes(sc, 50);
      const s2 = sub(h, 1, 'u-t2', a2, { f_start: 'Pass', f_press: 8.6, f_run: 32, f_fuel: 85, f_leak: 'No' }, [ph('FP-001 pump set', 10, 3, 'u-t2', 'general', 'f_photo', a2)], '', 45);
      const r2 = addMinutes(a2, 60);
      review(h, s2, 'u-sup2', r2, 'approved', '');
      h.startedAt = s2.startedAt; h.submittedAt = a2; h.completedAt = h.closedAt = r2;
      ev(r2, 'u-sup2', 'Approved v1 · report finalised', h.id, { from: 'submitted', to: 'closed' });
    }
  }

  // --- KF-001 walk-in freezer: EMERGENCY breakdown in progress
  {
    const rep = addMinutes(NOW, -95);
    const w = wo({
      id: 'wo-kf1-emerg', title: 'Walk-in freezer not holding temperature', description: 'Freezer display showing −6 °C and rising. Compressor running continuously, evaporator iced up. Stock moved to reach-in freezers.',
      type: 'emergency', priority: 'critical', status: 'in_progress', assetId: 'as-kf1', supervisorId: 'u-sup1', requestedById: 'u-chef', leadTechId: 'u-t1',
      createdAt: rep, scheduledFor: rep, dueAt: addHours(rep, 4), templateId: 'tpl-repair', templateVersion: 1, source: 'fault', startedAt: addMinutes(rep, 40),
      instructions: 'Diagnose the reported fault, record findings, repair, and test before submitting. Attach before and after photographs.',
      safety: 'Isolate the condensing unit at the local isolator and apply lockout/tagout before opening panels.',
      fault: { severity: 'critical', guestImpact: true, equipmentOperational: false, safetyConcern: false, immediateAction: 'Stock transferred to reach-in freezers. Door kept closed.', reportedAt: rep, photos: [ph('KF-001 display −6 °C', 220, 0, 'u-chef', 'defect', undefined, rep)] },
    });
    ev(rep, 'u-chef', 'Fault reported', w.id, { to: 'triage', reason: w.description });
    ev(rep, 'u-chef', 'Asset condition changed', 'as-kf1');
    audit[audit.length - 1].entity = 'asset';
    audit[audit.length - 1].from = 'operational';
    audit[audit.length - 1].to = 'out_of_service';
    ev(addMinutes(rep, 12), 'u-sup1', 'Triaged & technician dispatched', w.id, { from: 'triage', to: 'assigned', reason: 'Critical — F&B stock at risk.' });
    ev(addMinutes(rep, 40), 'u-t1', 'Work started', w.id, { from: 'assigned', to: 'in_progress' });
    comments.push({ id: 'cm-s1', woId: w.id, userId: 'u-t1', text: 'Evaporator coil fully iced. Defrost heater not drawing current — checking defrost timer and heater element.', at: addMinutes(rep, 75) });
    comments.push({ id: 'cm-s2', woId: w.id, userId: 'u-sup1', text: 'Keep me posted. If heater element is open-circuit, use the spare from store.', at: addMinutes(rep, 85) });
    w.draft = { answers: { r_diag: 'Defrost heater element open-circuit; evaporator iced, airflow blocked.' }, photos: [ph('KF-001 evaporator — iced', 220, 1, 'u-t1', 'before', 'r_before', addMinutes(rep, 50))], notes: '', partsUsed: '', savedAt: addMinutes(rep, 78) };
    notifications.push({ id: 'nt-s4', userId: 'u-ce', at: rep, title: 'EMERGENCY fault reported', body: `${w.number} · Walk-in freezer not holding temperature (KF-001)`, link: `/work-orders/${w.id}`, read: false, level: 'critical' });
  }

  // --- PF-001 weekly inspection: OVERDUE (2 days)
  {
    const occ = day(-2);
    const sched = pkAt(occ, '09:00');
    const w = wo({
      id: 'wo-pf1-overdue', title: 'PF-001 Weekly Inspection', type: 'inspection', priority: 'low', status: 'assigned', assetId: 'as-pf1', supervisorId: 'u-sup1', requestedById: 'u-sup1', leadTechId: 'u-t3',
      createdAt: addHours(sched, -2), scheduledFor: sched, dueAt: addHours(sched, 6), templateId: 'tpl-pump', templateVersion: 1, planId: 'pl-pf1', occurrenceDate: occ, source: 'schedule',
      instructions: 'Complete the "Pump Routine Inspection" checklist for PF-001.',
    });
    ev(w.createdAt, 'system', 'Generated by scheduler', w.id, { to: 'assigned', reason: `Plan "PF-001 Weekly Inspection" · occurrence ${occ}` });
    const o2 = day(-9);
    const sc = pkAt(o2, '09:00');
    const h = wo({ id: 'wo-pf1-h9', title: 'PF-001 Weekly Inspection', type: 'inspection', priority: 'low', status: 'closed', assetId: 'as-pf1', supervisorId: 'u-sup1', requestedById: 'u-sup1', leadTechId: 'u-t3', createdAt: addHours(sc, -2), scheduledFor: sc, dueAt: addHours(sc, 6), templateId: 'tpl-pump', templateVersion: 1, planId: 'pl-pf1', occurrenceDate: o2, source: 'schedule' });
    const a2 = addMinutes(sc, 80);
    const s2 = sub(h, 1, 'u-t3', a2, { p_dis: 2.4, p_amp: 9.1, p_seal: 'No', p_strainer: 'Pass' }, [ph('PF-001 pump', 190, 1, 'u-t3', 'general', 'p_photo', a2)], '', 30);
    const r2 = addMinutes(a2, 120);
    review(h, s2, 'u-sup1', r2, 'approved', 'Discharge pressure slightly low — monitor next week.');
    h.startedAt = s2.startedAt; h.submittedAt = a2; h.completedAt = h.closedAt = r2;
    ev(r2, 'u-sup1', 'Approved v1 · report finalised', h.id, { from: 'submitted', to: 'closed' });
  }

  // --- LW-001: repair AWAITING PARTS
  {
    const rep = at(-3, '15:10');
    const w = wo({
      id: 'wo-lw1-parts', title: 'Washer extractor — loud drum noise during spin', description: 'Grinding noise from drum at high spin speed. Machine still usable at reduced load.',
      type: 'corrective', priority: 'high', status: 'on_hold', holdReason: 'Awaiting parts: drum bearing & seal kit (ordered, ETA 3 days)', assetId: 'as-lw1', supervisorId: 'u-sup1', requestedById: 'u-hk', leadTechId: 'u-t4',
      createdAt: rep, scheduledFor: rep, dueAt: at(2, '18:00'), templateId: 'tpl-repair', templateVersion: 1, source: 'fault', startedAt: at(-3, '16:30'),
      fault: { severity: 'high', guestImpact: false, equipmentOperational: true, safetyConcern: false, immediateAction: 'Reduced load to 20 kg per cycle.', reportedAt: rep, photos: [] },
    });
    ev(rep, 'u-hk', 'Fault reported', w.id, { to: 'triage', reason: w.description });
    ev(at(-3, '15:40'), 'u-sup1', 'Triaged & technician dispatched', w.id, { from: 'triage', to: 'assigned' });
    ev(at(-3, '16:30'), 'u-t4', 'Work started', w.id, { from: 'assigned', to: 'in_progress' });
    ev(at(-3, '17:45'), 'u-t4', 'Put on hold', w.id, { from: 'in_progress', to: 'on_hold', reason: 'Awaiting parts: drum bearing & seal kit (ordered, ETA 3 days)' });
    comments.push({ id: 'cm-s3', woId: w.id, userId: 'u-t4', text: 'Main drum bearing worn — play felt at drum. Requested bearing & seal kit from store; not in stock.', at: at(-3, '17:40') });
  }

  // --- GEN-002 annual service: multi-technician job, scheduled tomorrow
  {
    const sched = at(1, '09:00');
    const w = wo({
      id: 'wo-gen2-annual', title: 'GEN-002 Annual Comprehensive Service', description: 'Annual service per manufacturer schedule: oil & filters, coolant check, belts, load bank test.',
      type: 'preventive', priority: 'high', status: 'assigned', assetId: 'as-gen2', supervisorId: 'u-sup2', requestedById: 'u-ce', leadTechId: 'u-t2', helperIds: ['u-t1', 'u-t4'],
      createdAt: at(-6, '11:00'), scheduledFor: sched, dueAt: at(1, '17:00'), templateId: 'tpl-service', templateVersion: 1,
      instructions: 'Follow the attached O&M manual section 7 (annual service). GEN-001 must be confirmed available as standby before isolating GEN-002.',
      safety: 'Permit-to-work required. Lockout/tagout on ATS and battery isolator. Engine must be cool before draining fluids.',
    });
    ev(w.createdAt, 'u-ce', 'Work order created', w.id, { to: 'assigned' });
    ev(w.createdAt, 'u-ce', 'Assigned', w.id, { to: 'Usman Raza (lead), Bilal Ahmed, Hamza Iqbal' });
  }

  // --- CH-002 quarterly service: COMPLETED preventive maintenance
  {
    const sched = at(-10, '09:00');
    const w = wo({
      id: 'wo-ch2-pm', title: 'CH-002 Quarterly Preventive Service', description: 'Quarterly service: clean condenser tubes, check refrigerant charge, inspect starter contacts.',
      type: 'preventive', priority: 'medium', status: 'closed', assetId: 'as-ch2', supervisorId: 'u-sup1', requestedById: 'u-ce', leadTechId: 'u-t4', helperIds: ['u-t1'],
      createdAt: at(-17, '10:00'), scheduledFor: sched, dueAt: at(-10, '17:00'), templateId: 'tpl-service', templateVersion: 1,
    });
    const sAt = at(-10, '15:20');
    const s = sub(w, 1, 'u-t4', sAt, { s_isol: 'Pass', s_filters: 'Pass', s_tasks: 'Pass', s_notes: 'Condenser tubes brushed. Refrigerant charge within range. Starter contacts cleaned.' },
      [ph('CH-002 condenser — before', 30, 1, 'u-t4', 'before', 's_before', at(-10, '09:20')), ph('CH-002 condenser — after cleaning', 160, 1, 'u-t4', 'after', 's_after', sAt)], '', 360, 'Condenser brush set (reusable), 2× gasket');
    const rAt = at(-10, '16:30');
    review(w, s, 'u-sup1', rAt, 'approved', 'Good work. Before/after evidence clear.');
    w.startedAt = s.startedAt; w.submittedAt = sAt; w.completedAt = w.closedAt = rAt;
    ev(w.createdAt, 'u-ce', 'Work order created', w.id, { to: 'assigned' });
    ev(s.startedAt!, 'u-t4', 'Work started', w.id, { from: 'assigned', to: 'in_progress' });
    ev(sAt, 'u-t4', 'Submitted for review', w.id, { from: 'in_progress', to: 'submitted' });
    ev(rAt, 'u-sup1', 'Approved v1 · report finalised', w.id, { from: 'submitted', to: 'closed' });
  }

  // --- AC-305 earlier housekeeping request (closed, confirmed by requester)
  {
    const rep = at(-38, '10:15');
    const w = wo({
      id: 'wo-ac305-old', title: 'Room 305 AC dripping water', description: 'Guest complained of water dripping from ceiling grille.',
      type: 'corrective', priority: 'medium', status: 'closed', assetId: 'as-ac305', supervisorId: 'u-sup1', requestedById: 'u-hk', leadTechId: 'u-t1',
      createdAt: rep, scheduledFor: rep, dueAt: addHours(rep, 24), templateId: 'tpl-repair', templateVersion: 1, source: 'fault', requesterConfirmation: 'confirmed',
      fault: { severity: 'medium', guestImpact: true, equipmentOperational: true, safetyConcern: false, immediateAction: 'Guest moved to Room 306.', reportedAt: rep, photos: [] },
    });
    const sAt = at(-38, '13:00');
    const s = sub(w, 1, 'u-t1', sAt, { r_diag: 'Condensate drain line blocked.', r_work: 'Flushed drain line, cleaned drain pan, tested flow.', r_test: 'Pass' },
      [ph('AC-305 drain pan — before', 30, 3, 'u-t1', 'before', 'r_before', at(-38, '11:30')), ph('AC-305 drain pan — after', 160, 3, 'u-t1', 'after', 'r_after', sAt)], '', 80);
    const rAt = at(-38, '14:10');
    review(w, s, 'u-sup1', rAt, 'approved', '');
    w.startedAt = s.startedAt; w.submittedAt = sAt; w.completedAt = rAt; w.returnedToServiceAt = rAt; w.closedAt = at(-38, '17:00');
    ev(rep, 'u-hk', 'Fault reported', w.id, { to: 'triage' });
    ev(rAt, 'u-sup1', 'Approved v1', w.id, { from: 'submitted', to: 'completed' });
    ev(w.closedAt, 'u-hk', 'Requester confirmed resolution', w.id, { from: 'completed', to: 'closed' });
  }

  // --- WP-001 last monthly inspection (closed)
  {
    const occ = day(-20);
    const sc = pkAt(occ, '10:00');
    const h = wo({ id: 'wo-wp1-h20', title: 'WP-001 Monthly Inspection', type: 'preventive', priority: 'medium', status: 'closed', assetId: 'as-wp1', supervisorId: 'u-sup1', requestedById: 'u-sup1', leadTechId: 'u-t3', createdAt: addHours(sc, -2), scheduledFor: sc, dueAt: addHours(sc, 8), templateId: 'tpl-pump', templateVersion: 1, planId: 'pl-wp1', occurrenceDate: occ, source: 'schedule' });
    const a2 = addMinutes(sc, 70);
    const s2 = sub(h, 1, 'u-t3', a2, { p_dis: 4.6, p_amp: 15.2, p_seal: 'No', p_strainer: 'Pass' }, [ph('WP-001 booster set', 190, 1, 'u-t3', 'general', 'p_photo', a2)], '', 35);
    const r2 = addMinutes(a2, 60);
    review(h, s2, 'u-sup1', r2, 'approved', '');
    h.startedAt = s2.startedAt; h.submittedAt = a2; h.completedAt = h.closedAt = r2;
    ev(r2, 'u-sup1', 'Approved v1 · report finalised', h.id, { from: 'submitted', to: 'closed' });
  }

  // sort WO numbers chronologically by creation
  workOrders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  workOrders.forEach((w, i) => (w.number = `WO-${year}-${String(i + 1).padStart(4, '0')}`));
  // fix notification bodies to new numbers
  notifications.forEach((n) => {
    const id = n.link.split('/')[2];
    const w = workOrders.find((x) => x.id === id);
    if (w) n.body = n.body.replace(/WO-\d{4}-\d{4}/, w.number);
  });

  return {
    schemaVersion: 3,
    seededAt: new Date().toISOString(),
    property: { id: P, name: 'Islamabad Serena Hotel', group: 'Serena Hotels', timezone: 'Asia/Karachi', city: 'Islamabad' },
    users, departments, locations, assets, templates, plans, workOrders, submissions, reviews, comments, audit, notifications,
    counters: { wo: workOrders.length },
  };
}
