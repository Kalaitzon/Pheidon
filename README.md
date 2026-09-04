# Pheidon

A personal finance tracker built around a simple question: **how much can I actually
spend this month without derailing anything?**

Pheidon was a king of Argos in the 7th century BC, credited with the first system of
weights and measures in the Greek world. His name comes from the verb *pheidomai*,
to spare or economise.

Greek and English interface, light and dark themes, works offline.

---

## What makes it different

Most expense trackers show you what you spent. Pheidon tries to answer what you can
spend next.

**A free-to-spend limit that accounts for everything else.** Income, minus fixed
costs, minus essentials, minus what your goals require, minus a buffer for the
unexpected. What remains is genuinely discretionary. Goals are funded before
discretionary spending, not from whatever happens to be left over.

**Recurring entries that project forward.** Declare your rent once and it is both
recorded each month and included in every future projection. Declare that a contract
ends in February and the forecast for March drops on its own.

**Trip mode.** On a three-day trip you make twenty small purchases. Picking a
category for each one is work nobody does, so in practice nothing gets recorded.
Drop a description and an amount into the trip instead; when it closes, everything
merges into a single transaction.

**Category flexibility drives the logic.** Every category is fixed, essential or
discretionary, and only discretionary spending counts toward the free-to-spend
limit. You can also mark any category as untouchable, and it will never be suggested
for a cut regardless of how tight things get.

**AI suggestions that never do arithmetic.** All figures are computed locally and
exactly. A language model receives those finished numbers and writes the
interpretation. This is deliberate: a model doing the maths is the surest way to get
a confidently wrong figure. Suggestions are validated in code afterwards, so a
proposal to cut rent or an untouchable category is discarded before it is shown.

---

## Stack

React 18 · TypeScript · Vite · Tailwind CSS v4 · Recharts · Zustand · i18next
Supabase for auth and storage · Google Gemini for suggestions · deployed on Vercel

---

## Getting started

```bash
npm install
npm run dev
```

Runs at `http://localhost:5173` **without an account**. Data is stored in the
browser. For accounts and sync, see `DEPLOYMENT.md`.

| Command | Purpose |
|---|---|
| `npm run dev` | Local development |
| `npm run build` | Production build in `dist/` |
| `npm run typecheck` | Type checking only |
| `npm run preview` | Preview the production build |

---

## Architecture

The codebase separates logic from presentation strictly, so a future React Native
port needs only the screens rewritten.

```
src/
├─ lib/          Pure TypeScript. No React, no DOM. All calculation lives here.
├─ types/        The data model.
├─ features/     Screens, organised by feature rather than by file type.
├─ store/        Storage behind a repository interface: local or Supabase.
└─ i18n/         Greek and English, kept in sync.
api/             Vercel serverless function that talks to Gemini.
supabase/        Schema and row-level security policies.
```

Amounts are stored as integer minor units, never floats, and the number of decimal
places comes from the currency: 100 units in a euro, none in a yen.

See `ARCHITECTURE.md` for the reasoning behind the structure.

---

## Install on a phone

Pheidon is a progressive web app, so it installs from the browser without an app
store.

**Android** — open the site in Chrome, tap the menu, then *Install app*.

**iPhone** — open the site in **Safari**, tap the Share button, then *Add to Home
Screen*. Safari is required: on iOS only Safari can install a web app.

Once installed it runs in its own window without a browser bar, keeps its icon on
the home screen, and opens without a connection. Updates arrive on their own, with
no store review.

---

## Privacy

Each account sees only its own data. Separation is enforced by row-level security in
the database rather than by application code, so it cannot be forgotten in a query.

Only per-category aggregates are sent to the language model: the category key, its
average, the current month's total and the trend. Individual transactions, merchant
names, notes and email addresses never leave the device.

---

## Status

Working: transactions, categories with custom editing, recurring entries, trips,
month navigation with projections, charts, the free-to-spend limit, analysis, auth,
Greek and English, light and dark themes.

Implemented but without a UI yet: financial goals and declared income periods. The
logic in `lib/goals.ts` and `lib/forecast.ts` is written and tested; only the screens
to enter them are missing.

---

© 2026 Pheidon · Developed by Ioannis Kalaitzidis. All rights reserved.
