# SCT_WD_4 — Tally

A to-do web app for people who plan by time, not by list. Capture a task in
under three seconds, give it a date and a time, put it in a list, and check it
off. It opens instantly, needs no account, and keeps your data on your own
device.

**The app lives in [`tally/`](tally). Its README is the real documentation** —
architecture, the design system, the testing story, and every place the
implementation departs from the specification and why.

```
.
├── tally/                      The application
├── TODO_APP_PRD.md             Product requirements
├── TODO_APP_ARCHITECTURE.md    Data model, storage, the v2 sync schema
├── TODO_APP_FRONTEND_SPEC.md   Component and interaction specification
├── TODO_APP_SECURITY.md        Threat model and the security decisions
└── TODO_APP_TICKETS.md         The build, broken into tickets
```

## Running it

```bash
cd tally
npm install
npm run dev
```

Then open http://localhost:3000. There is nothing to configure — the app runs
correctly with no `.env` file at all.

| Command | What it does |
|---|---|
| `npm run check` | Typecheck, lint and 122 unit tests |
| `npm run e2e` | 22 end-to-end tests against a production build |
| `npm run build` | Production build |

## Deploying

Hosted on Vercel, from this repository.

**The one setting that matters: Root Directory must be `tally`.** The app is not
at the repository root, and Vercel will otherwise look for a `package.json`
beside this file and fail to detect the framework.

1. On [vercel.com/new](https://vercel.com/new), import `SCT_WD_4`.
2. Set **Root Directory** to `tally`.
3. Leave everything else alone — Next.js is detected, and there are no
   environment variables to set.

Every push to `main` redeploys. Pull requests get their own preview URL.

Deploying to a static host instead would cost the security headers in
[`tally/next.config.ts`](tally/next.config.ts) — the Content-Security-Policy,
`X-Frame-Options` and the rest are sent as real HTTP headers, which only a
server can do.
