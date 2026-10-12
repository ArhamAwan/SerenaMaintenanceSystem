# Serena Maintenance Hub — MVP Demo Script

**Open:** double-click `Serena Maintenance Hub - DEMO.html` (Chrome or Edge). No install or internet needed.

The app has **two separate workspaces** in the same file. Switching between them never deletes either one.

| Workspace | What it is | Use it to |
|---|---|---|
| **Your own workspace** | Starts completely empty. You create the admin account and enter everything yourself. | Show the team the app as a real tool: "this is what day one looks like". |
| **Demo workspace** | Pre-filled with fictional staff, machines and history. | Show dashboards, trends and the review/rework story without typing. |

Switch on the sign-in screen (card at the bottom), from your name menu (top right), or in **Settings → Workspace**.

---

# Part A — Fresh workspace (start from zero, ~10 min)

**Before the meeting (2 min):** open the file → **Use your own workspace**. You'll see *Set up your workspace*.
If you rehearsed earlier and want a clean slate: sign in → **Settings → Erase my workspace**.

### A1. Create the workspace (1 min)
Fill in hotel, your name, email and a password (8+ characters). Leave the three starter boxes ticked:
departments, a basic building structure and the checklist library. These are structure only, with no fake records.
→ **Create workspace**. You land on the dashboard with a **Get ready** checklist (6 steps). It ticks itself as you go.

### A2. Map one plant room (30 sec)
**Locations** → select *Main Building › Basement* → **Add location** → *Generator Hall* (type: room).

### A3. Invite the team (2 min)
**People & departments → Invite employee**, three times. Give each a temporary password and write it down:
- an **Engineering Supervisor** (e.g. *Ali*)
- a **Maintenance Technician** (e.g. *Zain*)
- a **Department Manager** (e.g. *Housekeeping*); they report faults

Each person signs in with **their own email + password**. Wrong passwords are rejected.

### A4. Register a machine (1 min)
**Assets & machinery → Register first asset** → code *GEN-01*, name *Main Diesel Generator*, location *Generator Hall*, criticality.
A QR label and history page are created instantly.

### A5. Issue the first job, live in two windows (3 min) ⭐
1. Open a **second Chrome window** with the same file. In window 1 sign in as the **supervisor**, in window 2 as the **technician**.
   (Each window keeps its own person. In a meeting you can also click your name → pick a person, with no password: *presentation mode*.)
2. Supervisor: **Work orders → New** → GEN-01 → lead technician *Zain* → checklist *Generator Daily Inspection* → **Create**.
3. Technician window: the job appears on **My day** immediately, with a bell notification.
4. Technician: **Start work** → fill readings (try battery **23** to see the live warning) → photo → **Submit for review**.
5. Supervisor: **Approvals** → open it → **Request rework** or **Approve**.

### A6. Fault from a department (1 min)
Department manager → **Report a fault** → location, *"Lobby light flickering"* → Submit.
The supervisor sees it under *New requests to triage* → **Triage & assign**.

### A7. Recurring maintenance (1 min)
Supervisor → **Maintenance calendar → New maintenance plan** → GEN-01, daily, technician *Zain* → today's job is generated automatically, and duplicates are prevented.

**Then switch to the demo workspace** (name menu → *Open the demo workspace*) to show what it looks like after months of use: dashboards, trends, rework history. Use Part B below.

---

# Part B — Demo workspace (pre-filled story)

**Before you start:** in the demo workspace, sign in as anyone → **Settings → Reset demo data**. This re-creates every record relative to *today*, so dates, "due today" and "overdue" look right.

**Best demo trick — two windows side by side:** open the demo file in two Chrome windows (Cmd+N, then drag the file in). Sign in as **Imran** in one and **Bilal** in the other. Everything you do in one appears in the other instantly: assign work, submit, approve, report a fault. Each window keeps its own user.

**Switching people:** click your name (top right) → pick another user. Every screen changes to that role's permissions.

| Person | Role | Shows |
|---|---|---|
| Bilal Ahmed | Technician | Mobile task list, checklist, photos |
| Imran Siddiqui | Supervisor (Mechanical) | Review queue, rework, scheduling |
| Naveed Akhtar | Supervisor (Electrical) | Reviews fire pump / GEN-002 |
| Tariq Mahmood | Chief Engineer | Engineering dashboard, escalations |
| Rabia Noor | Housekeeping manager | Reports faults, confirms repairs |
| Sana Mirza | Super Admin | Users, departments, templates, audit |

Demo password if you type instead of clicking: `serena123`

---

## 0. First impression (20 sec)
Press **⌘K / Ctrl+K** anywhere → type *GEN-001*, *freezer* or *Bilal* → Enter. A command palette searches every asset, serial number, work order and person.

## 1. The problem (30 sec)
Paper logs, WhatsApp, spreadsheets → no history, no evidence, no accountability.
*"Every machine has a history. Every inspection has evidence. Every correction stays traceable."*

## 2. Chief Engineer's view (1 min) — **Tariq Mahmood**
- **Facility health index** ring (hover *How KPIs are calculated* for the formula), sparklines for 14-day trends, SLA countdown bars on anything critical.
- Dashboard: assets, out of service, PM compliance, overdue, open emergencies, rework rate, MTTR.
- Click **KPI definitions** to show every number has a written formula.
- **Critical attention:** the walk-in freezer emergency (KF-001) and the fire pump rework.

## 3. Scheduled daily inspection, end to end (3 min) — Workflow A
1. Switch to **Bilal** → his **My day** dashboard shows Next up, today’s shift timeline, his performance and supervisor feedback. Open **GEN-001 Daily Inspection** from the shift timeline (or **My Tasks**, the full work queue) (the scheduler generated it this morning).
2. **Start work**. Fill in the checklist:
   - Battery voltage **23.6** → the threshold gauge marker slides into the amber band and the card flags **WARNING** live.
   - Leakage **Yes** → extra fields appear (type, severity, mandatory close-up photo). This is conditional logic.
   - Tap **Submit** without photos → plain-language validation.
   - Add photos (on a laptop, "From gallery" works with any image) → **Submit for review**.
3. The draft autosaves. Mention that a basement with no signal doesn't lose work.

## 4. Review → rework → resubmission (2 min) — Workflow B
1. Switch to **Imran** → bell shows *Report awaiting review* + *Abnormal reading* → **Approvals**.
2. Open GEN-001: flagged readings at the top, photos, last 5 inspections of this machine.
3. **Request rework**, click a quick chip, write: *"Re-check charger output, attach close-up of battery terminals."* → Send.
4. **Bilal**: red/orange banner with Imran's exact words → **Start rework** (previous answers pre-filled) → battery **27.0**, new photo → Submit (= **v2**).
5. **Imran**: **Compare with v1**. Changed values highlighted, v1 and v2 photos side by side → **Approve**.
6. Open the work order → **Report / PDF**: both versions, the review decisions and the audit trail on one printable page.
7. Try it: as Bilal, open `Approvals` → *Access restricted*. A reviewer can't approve their own work.

## 5. Department request / breakdown (2 min) — Workflows C & E
1. **Rabia** → **Report a fault** → AC-305, *"AC not cooling in Room 305"*, High, guests affected → Submit.
2. **Imran** → dashboard shows *Faults awaiting triage* → **Triage & assign** → Bilal (picker shows skills + current workload).
3. **Bilal** → start → before photo, diagnosis, work done, test Pass, after photo → submit.
4. **Imran** → approve → **Return to service**. This is a separate step from closing, as safety requires.
5. **Rabia** → *Needs your confirmation* → **Confirm resolved** (or *Issue persists* to reopen).

## 6. Asset history (1 min)
**Assets → GEN-001**: identity, condition, plans with the next 14 days, **Readings & trends** (battery voltage chart with the out-of-range dip), full history, documents, **QR code** label.

## 7. Preventive planning & scheduler (1 min) — Workflow D
**Imran → Maintenance Calendar → New maintenance plan** → CH-002 + Chiller Weekly Inspection + Hamza → Create.
Today's work order appears immediately. Click **Run scheduler now**: *"0 new · N already existed (duplicates prevented)"*.

## 8. Controls (30 sec)
- **Sana** (Admin): Employees → Invite employee; Departments; Settings → permission matrix (an admin cannot approve work).
- **Audit Log** (as Tariq): every action with who, when, from → to, and reason. Read-only.
- **Inspection Templates**: no-code checklist builder; every save creates a new version, and old reports keep their version.

## 9. Close (30 sec): what's next
This MVP stores data in the browser on this computer (each workspace separately). Production build:
- Postgres + API server, real logins (SSO / MFA)
- Private photo storage
- Email / WhatsApp alerts
- Offline mode
- Phase 2: inventory, shifts and handover, contractors, safety permits

---

### If asked
- **"Can we start using it?"** The fresh workspace works end to end, but data lives only in this browser on this computer. Other people's phones won't see it until the server version is built.
- **"Is this real data?"** In the fresh workspace, yes: only what you typed. In the demo workspace, no: all staff, equipment and readings are fictional demo records, and thresholds are placeholders until engineering supplies manufacturer limits.
- **"Does it work on phones?"** Yes, the layout is mobile-first. For a phone demo, run `npm install && npm run dev` in the `app` folder and open the Network URL on a phone on the same Wi-Fi. Each device keeps its own data.
- **"Where is the data stored?"** For the demo, in this browser only. Production uses a central database with per-property isolation.
