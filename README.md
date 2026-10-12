# Serena Maintenance Hub (MVP demo)

React + TypeScript + Tailwind + Vite. All data lives in the browser (localStorage), seeded with fictional demo records.

```bash
npm install
npm run dev      # http://localhost:5173 (and a Network URL for phones on the same Wi-Fi)
npm run build    # -> dist/index.html (single self-contained file)
```

Structure
- `src/lib/types.ts` – domain model (mirrors the planned Postgres schema)
- `src/lib/store.ts` – business rules: work-order state machine, self-approval block, immutable submissions, idempotent scheduler, notifications, audit log
- `src/lib/seed.ts` – demo data (relative to today)
- `src/pages/*` – screens
