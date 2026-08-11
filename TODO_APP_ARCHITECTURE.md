# Technical Architecture Document
## Tally — To-Do Web App

| Field | Value |
|---|---|
| Document type | Technical Architecture |
| Status | v1.0 — for build |
| Companion doc | `TODO_APP_PRD.md` |
| Scope | v1.0 (local-first SPA) with a defined migration path to v2 (accounts + sync) |
| Last updated | July 31, 2026 |

---

## 1. Architecture at a glance

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (client)                    │
│                                                         │
│   ┌──────────────┐   ┌──────────────┐   ┌───────────┐   │
│   │   UI Layer   │──▶│  Store       │──▶│  Repo     │   │
│   │  React + TS  │◀──│  (Zustand)   │◀──│ Interface │   │
│   └──────────────┘   └──────────────┘   └─────┬─────┘   │
│                                               │         │
│                                    ┌──────────┴───────┐ │
│                              v1 ──▶│ LocalRepository  │ │
│                                    │ (Dexie/IndexedDB)│ │
│                                    └──────────────────┘ │
│                                    ┌──────────────────┐ │
│                              v2 ──▶│ SupabaseRepo     │─┼──▶ Postgres
│                                    └──────────────────┘ │     + Auth
└─────────────────────────────────────────────────────────┘     + RLS
```

**The entire architecture is one idea:** the UI never knows where data lives. It talks to a repository interface. v1 wires that interface to IndexedDB; v2 swaps in Supabase. If you get this boundary right, v2 is a two-week project. If you get it wrong — if `localStorage.setItem` appears anywhere inside a React component — v2 is a rewrite.

---

## 2. Constraints inherited from the PRD

These are not negotiable inputs to the design:

1. No user accounts in v1 → no server-side session, no auth provider, no backend at all.
2. Data must survive refresh and browser restart → durable client storage required.
3. Time-to-first-task < 10s median → aggressive bundle size budget; no blocking network on first paint.
4. Usable at 360px → mobile-first CSS, not desktop-first with media queries bolted on.
5. Accounts and sync are the v2 theme → today's decisions must not foreclose them.
6. Solo developer, ~2 week window → boring, well-documented tools only. No novel infrastructure.

---

## 3. Recommended tech stack

### 3.1 Summary table

| Layer | Choice | Version target |
|---|---|---|
| Language | TypeScript | 5.x, `strict: true` |
| UI framework | React | 19.x |
| Build tool | Vite | 6.x |
| Styling | Tailwind CSS | 4.x |
| Client state | Zustand | 5.x |
| Local persistence | Dexie.js (IndexedDB wrapper) | 4.x |
| Date handling | date-fns + date-fns-tz | 4.x |
| IDs | `crypto.randomUUID()` (native) | — |
| Unit/component tests | Vitest + React Testing Library | — |
| E2E smoke tests | Playwright | — |
| Lint / format | ESLint + Prettier | — |
| Hosting | Vercel or Netlify (static) | — |
| v2 backend | Supabase (Postgres + Auth + RLS) | — |

### 3.2 Reasoning, choice by choice

**TypeScript — not optional here.**
The task model has nullable fields (`dueAt`, `notes`, `completedAt`) and a boolean that changes the meaning of another field (`hasTime` determines whether `dueAt`'s time component is real). This is exactly the shape of data where JavaScript silently does the wrong thing. `strict: true` with `strictNullChecks` turns "why is it showing 12:00 AM" into a compile error. Set it on day one — retrofitting types onto a finished codebase is miserable work you will not do.

**React — the boring, correct choice.**
The app is a stateful, interactive, client-heavy UI with no SEO requirement. That is React's core competency. The ecosystem depth matters more than any framework's benchmark advantage at this scale.

*Rejected:* **Vanilla JS.** Genuinely viable for a to-do app, and it wins on bundle size. It loses on the parts you'll actually spend time on: reconciling list state after edits, drag-reordering, and keeping the Today view in sync with three list views. You'd end up hand-rolling a worse renderer.
*Rejected:* **Svelte/Vue.** Both are fine. React wins purely on the density of solutions to problems you'll hit at 2 AM.

**Vite — not Next.js.**
This is the choice most likely to be second-guessed, so here's the full argument.

Next.js gives you SSR, file-based routing, API routes, and server components. This app needs none of them. There is no SEO surface (the content is the user's private data), no server rendering benefit (the first paint is an empty input field), and in v1 no server at all. Next.js would add a framework's worth of concepts — hydration boundaries, server/client component rules, route handlers — in exchange for nothing.

The usual counter is "but you'll need Next.js for v2 auth." You won't. Supabase Auth works in a plain SPA; the session lives in the client and RLS enforces access at the database. A Vite SPA on a CDN plus Supabase is a complete, production-grade SaaS architecture. Many shipped products run exactly this.

Vite also gives you sub-second HMR, which over a two-week build is worth more than any of the above.

**Tailwind CSS.**
Utility classes keep styling colocated with markup, which matters when one developer is moving fast. Mobile-first breakpoints (`sm:`, `md:`) match constraint #4 exactly. The design-token layer (`@theme` in v4) gives you a real color/spacing system without writing a design-system package.

*Rejected:* **CSS Modules.** Perfectly good, but you'll spend time naming things and switching files.
*Rejected:* **A component library** (MUI, Chakra, Ant). The app has maybe eight distinct components. A library ships hundreds of kilobytes to save you from writing a checkbox, and then fights you on the one custom interaction you actually care about — inline editing. Use **Radix UI primitives** (unstyled, accessible) for the two or three genuinely hard components: dropdown menu, dialog, toast. Style them with Tailwind. That's the right trade.

**Zustand for state.**
The store is small: a list of tasks, a list of lists, and the current view. Zustand is ~1KB, has no provider boilerplate, and — critically — can be read and written from outside React, which matters for keyboard shortcut handlers and the persistence layer.

*Rejected:* **Redux Toolkit.** Correct for large teams and complex async orchestration. Here it's ceremony.
*Rejected:* **React Context alone.** Works, but every context update re-renders every consumer. With a task list that updates on every keystroke during inline edit, you'd be adding memoization workarounds within a week.
*Rejected:* **TanStack Query.** It's a server-state cache. In v1 there is no server. Introduce it in v2 alongside Supabase, where it earns its place.

**Dexie.js over raw IndexedDB — and IndexedDB over localStorage.**

This is a load-bearing decision. `localStorage` is the obvious choice and the wrong one:
- It's synchronous, so every write blocks the main thread.
- It stores strings only, so you `JSON.parse` the entire dataset on every read.
- It caps around 5MB, and the failure mode is a thrown exception mid-write.
- It has no indexes, so "tasks due today across all lists" means loading and scanning everything.

IndexedDB is asynchronous, transactional, indexed, and has storage quotas in the hundreds of megabytes. Its raw API is famously unpleasant, which is what Dexie solves — you get `db.tasks.where('dueAt').between(start, end).toArray()` backed by a real index. That query *is* the Today view.

Dexie also gives you schema versioning with migration hooks, which you will need the first time you add a field.

**date-fns + date-fns-tz.**
The PRD flags timezone/DST bugs as a medium risk. Do not hand-roll date logic. date-fns is modular (tree-shakes to only what you import) and immutable. `date-fns-tz` handles the one genuinely hard operation: converting between a user's local wall-clock time and stored UTC across a DST boundary.

*Rejected:* **Moment.js** — deprecated, mutable, large. *Rejected:* **Day.js** — fine, but plugin-based timezone support is less robust. *Rejected:* **Temporal API** — the correct future answer, not yet safe to depend on without a polyfill.

**`crypto.randomUUID()` for IDs.**
Native, no dependency, cryptographically random. Generate IDs on the **client**, not the database. This is what makes offline creation and later sync possible: a task created with no network already has its permanent identity. Never use auto-incrementing integers for anything that will sync.

**Vitest + React Testing Library, Playwright for smoke.**
Vitest shares Vite's config and transform pipeline — zero extra build setup. Given the timeline, don't chase coverage. Test the things that are hard to verify by clicking: date/timezone conversion, the reordering algorithm, and the repository layer. Then write three Playwright tests for create → complete → reload-and-still-there.

**Hosting: Vercel or Netlify.**
A Vite build is static files. Both give you CDN, HTTPS, preview deploys per branch, and a free tier. Either is a five-minute setup. No meaningful difference at this scale.

---

## 4. The critical decision: the repository boundary

**Rule: no component, hook, or store action may reference Dexie, IndexedDB, `localStorage`, or `supabase` directly. Ever.**

Everything goes through one interface:

```ts
// src/data/repository.ts

export interface Repository {
  // Lists
  getLists(): Promise<List[]>;
  createList(input: NewList): Promise<List>;
  updateList(id: string, patch: Partial<List>): Promise<List>;
  deleteList(id: string, strategy: 'move-to-inbox' | 'delete-tasks'): Promise<void>;

  // Tasks
  getTasks(filter?: TaskFilter): Promise<Task[]>;
  getTasksDueBy(end: Date): Promise<Task[]>;   // powers the Today view
  createTask(input: NewTask): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  reorderTask(id: string, newPosition: number): Promise<Task>;

  // Data portability
  exportAll(): Promise<ExportBundle>;
  importAll(bundle: ExportBundle): Promise<void>;
}
```

v1 ships `LocalRepository implements Repository` using Dexie. v2 adds `SupabaseRepository implements Repository`. One line changes in `src/data/index.ts`.

Two secondary benefits: your tests can use an in-memory fake repository and run in milliseconds, and the interface forces you to design your data operations before you write UI, which is where most architectural mistakes get caught cheaply.

**Enforce it with a lint rule** so a tired-at-midnight version of you can't violate it:

```js
// eslint.config.js — no-restricted-imports
{
  patterns: [{
    group: ['dexie', '@supabase/*', '**/data/local/*', '**/data/supabase/*'],
    message: 'Access data only through the Repository interface (src/data).'
  }]
}
```
Scope this rule to `src/features/**` and `src/components/**`, exempting `src/data/**`.

---

## 5. File and folder structure

Organized **by feature**, not by file type. A `components/` folder containing forty unrelated components is how a codebase becomes unnavigable; keeping everything about tasks in one place is how you find it.

```
tally/
├── public/
│   ├── favicon.svg
│   └── manifest.webmanifest          # PWA manifest (installability)
│
├── src/
│   ├── main.tsx                      # entry point; mounts <App/>
│   ├── App.tsx                       # top-level layout + routing shell
│   ├── index.css                     # Tailwind import + @theme tokens
│   │
│   ├── data/                         # ── DATA LAYER (see §4) ──
│   │   ├── index.ts                  # exports the active repository singleton
│   │   ├── repository.ts             # the Repository interface
│   │   ├── types.ts                  # Task, List, TaskFilter, ExportBundle
│   │   ├── local/
│   │   │   ├── db.ts                 # Dexie schema + version migrations
│   │   │   ├── LocalRepository.ts    # Repository impl over Dexie
│   │   │   └── seed.ts               # default Inbox list on first run
│   │   └── supabase/                 # (v2 — empty in v1)
│   │       └── .gitkeep
│   │
│   ├── store/
│   │   ├── useTaskStore.ts           # tasks + lists state, async actions
│   │   ├── useUIStore.ts             # active view, sidebar open, theme
│   │   └── selectors.ts              # derived data (today's tasks, counts)
│   │
│   ├── features/
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskRow.tsx           # display + inline edit in one component
│   │   │   ├── TaskInput.tsx         # the always-visible capture field
│   │   │   ├── TaskCheckbox.tsx
│   │   │   ├── DueDatePicker.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── hooks/
│   │   │       └── useInlineEdit.ts
│   │   ├── lists/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ListItem.tsx
│   │   │   ├── NewListInput.tsx
│   │   │   └── DeleteListDialog.tsx  # move-to-inbox vs delete-tasks
│   │   └── today/
│   │       └── TodayView.tsx         # cross-list, due-today + overdue
│   │
│   ├── components/                   # generic, feature-agnostic only
│   │   ├── Button.tsx
│   │   ├── Dialog.tsx                # Radix wrapper
│   │   ├── DropdownMenu.tsx          # Radix wrapper
│   │   ├── Toast.tsx                 # undo-delete affordance
│   │   └── Icon.tsx
│   │
│   ├── lib/
│   │   ├── dates.ts                  # ALL date logic lives here (see §8)
│   │   ├── ordering.ts               # position calculation (see §9)
│   │   ├── keyboard.ts               # global shortcut registration
│   │   ├── id.ts                     # crypto.randomUUID wrapper
│   │   └── analytics.ts              # thin event wrapper, no-op if unset
│   │
│   └── types/
│       └── global.d.ts
│
├── tests/
│   ├── unit/
│   │   ├── dates.test.ts
│   │   ├── ordering.test.ts
│   │   └── LocalRepository.test.ts
│   └── e2e/
│       └── core-loop.spec.ts
│
├── .env.example                      # committed; documents every var
├── .env.local                        # gitignored; your real values
├── .gitignore
├── eslint.config.js
├── prettier.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── package.json
└── README.md
```

**Notes on structure**
- `TaskRow.tsx` deliberately contains both display and edit modes. Splitting them into `TaskRow` and `TaskRowEdit` means duplicating layout and fighting focus management on the transition.
- `lib/dates.ts` is the only file allowed to import `date-fns`. Same enforcement logic as §4 — centralize the thing that's easy to get subtly wrong.
- `components/` holds only things with zero domain knowledge. If it mentions "task," it belongs in `features/`.

---

## 6. Data model — v1 (client)

### 6.1 Dexie schema

```ts
// src/data/local/db.ts
import Dexie, { type Table } from 'dexie';
import type { Task, List } from '../types';

export class TallyDB extends Dexie {
  tasks!: Table<Task, string>;
  lists!: Table<List, string>;

  constructor() {
    super('tally');
    this.version(1).stores({
      lists: 'id, position, name',
      tasks: 'id, listId, dueAt, isComplete, position, [listId+isComplete]'
    });
  }
}
export const db = new TallyDB();
```

The indexed fields are the ones you filter or sort by. `[listId+isComplete]` is a compound index that makes "open tasks in this list" a single indexed lookup instead of a scan — the most frequent query in the app.

### 6.2 Type definitions

```ts
// src/data/types.ts

export type Priority = 'none' | 'low' | 'medium' | 'high';

export interface List {
  id: string;              // uuid, client-generated
  name: string;            // 1–40 chars
  isDefault: boolean;      // true only for Inbox; exactly one row
  position: number;        // sidebar sort order
  createdAt: string;       // ISO-8601 UTC
  updatedAt: string;
}

export interface Task {
  id: string;
  listId: string;          // → List.id
  title: string;           // 1–200 chars
  notes: string | null;
  dueAt: string | null;    // ISO-8601 UTC; null = no due date
  hasTime: boolean;        // false ⇒ date-only, render as all-day
  priority: Priority;
  isComplete: boolean;
  position: number;        // manual ordering within its list
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
```

**Adding fields later:** bump `this.version(2)` in Dexie and supply an `.upgrade()` callback. Never mutate a released version's schema — existing users' databases are already on disk.

---

## 7. Database schema — v2 (PostgreSQL / Supabase)

Even though v1 has no server, design the relational schema now. Your v1 client model is a faithful subset of it, so migration is a data copy.

### 7.1 DDL

```sql
-- ============ LISTS ============
create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  is_default  boolean not null default false,
  position    double precision not null default 1000,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                      -- soft delete (sync tombstone)
);

-- Exactly one default (Inbox) list per user.
create unique index lists_one_default_per_user
  on public.lists (user_id)
  where is_default = true and deleted_at is null;

create index lists_user_idx on public.lists (user_id, position)
  where deleted_at is null;


-- ============ TASKS ============
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  list_id      uuid not null references public.lists(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  notes        text,
  due_at       timestamptz,
  has_time     boolean not null default false,
  priority     text not null default 'none'
                 check (priority in ('none','low','medium','high')),
  is_complete  boolean not null default false,
  completed_at timestamptz,
  position     double precision not null default 1000,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  -- has_time can only be true when a due date exists
  constraint tasks_time_requires_date
    check (not has_time or due_at is not null),

  -- completed_at and is_complete must agree
  constraint tasks_completion_consistent
    check ((is_complete and completed_at is not null)
        or (not is_complete and completed_at is null))
);

create index tasks_list_open_idx on public.tasks (list_id, is_complete, position)
  where deleted_at is null;

create index tasks_due_idx on public.tasks (user_id, due_at)
  where deleted_at is null and is_complete = false and due_at is not null;


-- ============ AUTO-UPDATE updated_at ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger lists_touch before update on public.lists
  for each row execute function public.touch_updated_at();
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();


-- ============ ROW LEVEL SECURITY ============
alter table public.lists enable row level security;
alter table public.tasks enable row level security;

create policy "own lists" on public.lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============ SEED INBOX ON SIGNUP ============
create or replace function public.create_default_list()
returns trigger language plpgsql security definer as $$
begin
  insert into public.lists (user_id, name, is_default, position)
  values (new.id, 'Inbox', true, 1000);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_default_list();
```

### 7.2 The schema in plain English

**There are two tables: `lists` and `tasks`.**

**A list** is a named container — "Inbox," "Uni," "Groceries." Every list belongs to exactly one user. It has a name (1–40 characters, enforced by the database, not just the UI), a `position` that controls where it sits in the sidebar, and an `is_default` flag that marks the Inbox. That flag has a partial unique index on it, which means the database physically cannot let a user end up with two Inboxes — a rule you'd otherwise have to remember to enforce in application code forever.

**A task** is a single thing to do. Every task belongs to exactly one user *and* exactly one list. It has a title, optional notes, an optional due timestamp, a priority, and a completion flag.

**The relationships, stated directly:**
- One **user** has many **lists**. (`lists.user_id → auth.users.id`)
- One **user** has many **tasks**. (`tasks.user_id → auth.users.id`)
- One **list** has many **tasks**; each task sits in exactly one list. (`tasks.list_id → lists.id`)

That is a plain one-to-many hierarchy: user → lists → tasks. There are no many-to-many relationships, no join tables, and no self-references. This is deliberate. The moment you add tags or subtasks you introduce one, and the PRD explicitly defers both.

**Why `user_id` appears on `tasks` even though it's reachable via `list_id`.** Technically redundant — you could join through `lists`. It's there for two reasons. First, the RLS policy on `tasks` becomes a single-column comparison instead of a subquery on every row, which is a meaningful performance difference. Second, the Today view queries tasks across all lists; having `user_id` directly on the row lets that query use one index rather than joining. This is intentional denormalization with a stated justification, which is the only kind you should accept.

**What `on delete cascade` means here.** If a user deletes their account, every list and task they own is removed automatically. If a list is hard-deleted, its tasks go with it. This is why the PRD's "move to Inbox or delete tasks" dialog matters — the app must reassign `list_id` *before* deleting the list, or the cascade silently takes the tasks.

**Why `deleted_at` instead of actually deleting.** In a synced world, a hard delete is invisible to other devices. Device A deletes a task while offline; device B still has it; when they reconnect, B has no way to distinguish "deleted elsewhere" from "created elsewhere and not yet uploaded" — so the task resurrects. A `deleted_at` timestamp is a tombstone that propagates. Filter it out in every query (the partial indexes do this for you). Purge rows older than ~30 days with a scheduled job. **In v1 you can hard-delete**, since there's one device; add the column now so the migration doesn't need a schema change.

**Why `has_time` is a separate boolean.** A task due "Tuesday" and a task due "Tuesday at 6:00 PM" are different things, but both are stored as a single timestamp. Without a flag distinguishing them, the date-only task renders as "12:00 AM," which is wrong and looks broken. The check constraint additionally prevents the nonsensical state of a time with no date.

**Why the two check constraints exist at all.** Both encode invariants that application code is supposed to maintain. Application code has bugs; the database doesn't forget. Putting the rule in the schema means the invalid state is unrepresentable rather than merely unlikely.

**Why `position` is a floating-point number.** See §9.

---

## 8. Date and time handling

The PRD lists timezone bugs as a live risk. Four rules, all enforced in `src/lib/dates.ts`:

1. **Store UTC. Always.** `dueAt` is an ISO-8601 string with a `Z` suffix, or `timestamptz` in Postgres. Never store a local-time string.
2. **Convert at the boundary only.** UTC → local happens when rendering; local → UTC happens when the user picks a date. Nothing in between touches timezones.
3. **`hasTime: false` means end-of-day local.** For sorting and overdue checks, a date-only task is due at 23:59:59 in the *user's current* timezone. Compute this at read time, not write time — the user may have travelled.
4. **"Today" is a local-timezone concept.** The Today view's boundaries are local midnight to local midnight, converted to UTC for the query. Using UTC midnight puts tasks in the wrong day for most of the world.

```ts
// src/lib/dates.ts — the shape to aim for
export function toUTC(localDate: Date, tz: string): string;
export function fromUTC(iso: string, tz: string): Date;
export function endOfLocalDay(iso: string, tz: string): Date;
export function isOverdue(task: Task, now: Date, tz: string): boolean;
export function todayRangeUTC(now: Date, tz: string): { start: string; end: string };
```

Get the user's timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`. Don't ask them.

**Test these against a DST transition explicitly.** Pick a date in March and November, and a timezone that observes DST (`America/New_York`). This is a fifteen-minute test that saves a day of confused debugging.

---

## 9. Ordering strategy

Manual reordering (PRD item S2) with an integer `order` column requires rewriting every row after the moved one. That's fine at 20 tasks and unacceptable at 2,000, and it makes offline reordering conflict-prone.

Use **fractional positioning**: `position` is a float. To move a task between two neighbours, set its position to their midpoint.

```ts
// src/lib/ordering.ts
const GAP = 1000;

export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return GAP;
  if (before === undefined) return after! - GAP;
  if (after === undefined) return before + GAP;
  return (before + after) / 2;
}
```

A reorder is a **single-row update**. New tasks get `maxPosition + GAP`.

**The one caveat:** repeatedly inserting into the same gap halves the float each time, and doubles run out of precision after roughly 50 consecutive midpoint insertions in one spot. Detect it — if `Math.abs(after - before) < 0.0001`, rebalance that list by reassigning positions as `1000, 2000, 3000, …`. In practice this fires approximately never, but write the check now and add a unit test for it.

---

## 10. Environment variables and configuration

### 10.1 The single most important thing to know

**In Vite, every variable prefixed `VITE_` is embedded in the JavaScript bundle and is publicly readable by anyone who opens DevTools.** There is no such thing as a secret in a client-side app. Vite only exposes `VITE_`-prefixed vars precisely to make you opt in deliberately — but the protection is the prefix, not the `.env` file.

Concretely: a Supabase **anon key** is designed to be public and is safe here, because RLS is what actually protects data. A Supabase **service_role key** bypasses RLS entirely and must never appear in this codebase, in any file, prefixed or not. If one ever does, rotate it immediately — it's in your git history.

### 10.2 `.env.example` (commit this file)

```bash
# ─────────────────────────────────────────────────────────
# v1 — LOCAL-FIRST. No backend. All of these are optional.
# ─────────────────────────────────────────────────────────

# Display name, shown in the UI header and page title.
VITE_APP_NAME="Tally"

# Privacy-friendly analytics (Plausible). Leave blank to disable
# entirely — lib/analytics.ts no-ops when unset.
VITE_ANALYTICS_DOMAIN=
VITE_ANALYTICS_SCRIPT_URL=

# Feature flags. Ship dark work behind these rather than on branches.
VITE_ENABLE_SEARCH=true
VITE_ENABLE_DARK_MODE=true
VITE_ENABLE_EXPORT=true

# IndexedDB database name. Change to reset local data during dev.
VITE_DB_NAME="tally"

# ─────────────────────────────────────────────────────────
# v2 — ACCOUNTS + SYNC. Unused in v1.
# ─────────────────────────────────────────────────────────

# Supabase project URL. Public.
VITE_SUPABASE_URL=

# Supabase ANON key. Public by design; safe only because RLS is on.
# Verify RLS is enabled on every table before shipping.
VITE_SUPABASE_ANON_KEY=

# ⚠️  NEVER add SUPABASE_SERVICE_ROLE_KEY to this project.
#     It bypasses RLS. It belongs only in server-side environments.
```

### 10.3 Configuration notes before you start

**Type your env vars.** Otherwise `import.meta.env.VITE_FOO` is `any` and typos are silent:

```ts
// src/types/global.d.ts
interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_DB_NAME: string;
  readonly VITE_ENABLE_SEARCH: string;   // note: always a string
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
```

Env values are **always strings**. `VITE_ENABLE_SEARCH=false` is the truthy string `"false"`. Parse explicitly: `const on = import.meta.env.VITE_ENABLE_SEARCH === 'true'`.

**`.gitignore` must contain:**
```
.env
.env.local
.env.*.local
node_modules/
dist/
playwright-report/
```

**TypeScript config — turn these on now:**
```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // makes arr[0] correctly T | undefined
    "noUnusedLocals": true,
    "paths": { "@/*": ["./src/*"] }     // mirror in vite.config.ts resolve.alias
  }
}
```

**Set deployment env vars in the host dashboard**, not in a committed file. Vercel and Netlify both let you scope values per environment (production / preview). Remember every one still lands in the public bundle.

**Storage quota is not guaranteed.** Browsers may evict IndexedDB under storage pressure. On first run, request persistence:
```ts
if (navigator.storage?.persist) await navigator.storage.persist();
```
It may be denied; handle that path. This is the technical reality behind the PRD's data-loss risk, and the reason JSON export (S7) deserves promotion to a must-have.

**Private/incognito mode** may restrict or wipe IndexedDB. Detect a failed database open and show the PRD's non-blocking banner rather than crashing.

---

## 11. Performance budgets

Constraint #3 (time-to-first-task under 10s) is really a bundle-size constraint.

| Metric | Budget |
|---|---|
| Initial JS (gzipped) | < 150 KB |
| First Contentful Paint (mid-tier mobile, 4G) | < 1.5 s |
| Time to Interactive | < 2.5 s |
| Task creation → visible in list | < 50 ms |
| Lighthouse Performance | ≥ 90 |

Practical measures: no component library, tree-shakeable date-fns imports (`import { addDays } from 'date-fns'`, never `import * as`), lazy-load the export/import module and any settings surface, and self-host fonts with `font-display: swap`. Add `rollup-plugin-visualizer` on day one so bundle growth is visible rather than discovered at the end.

**Render optimistically.** Every mutation updates the Zustand store first, then persists. The user should never wait on IndexedDB — and in v2, never wait on the network. Reconcile or roll back on failure.

---

## 12. Migration path to v2

Because of §4, the sequence is mechanical:

1. Create the Supabase project; run the §7 DDL; **verify RLS is enabled on both tables** before writing any client code. An unprotected Postgres table behind a public anon key is a full data breach.
2. Add auth UI (email magic link is the lowest-friction option and requires no password handling).
3. Implement `SupabaseRepository` against the existing `Repository` interface. No UI files change.
4. Build a one-time migration: on first login, read everything from `LocalRepository`, write it to `SupabaseRepository`, reassign `user_id`. Client-generated UUIDs mean IDs carry over unchanged — this is the payoff for §3.2's ID decision.
5. For sync, start with last-write-wins on `updated_at`. It is not theoretically correct, but for a single-user product across two or three devices it is correct in practice and buys you months. Only reach for CRDTs if real conflicts appear.
6. Add a `SyncingRepository` that wraps both — write local, queue remote — if you want offline support to survive the transition.

---

## 13. Pre-build checklist

Work through this before writing feature code. Most of these are ten minutes now and hours later.

- [ ] `strict: true` and `noUncheckedIndexedAccess` enabled
- [ ] `Repository` interface written **before** any component
- [ ] ESLint `no-restricted-imports` rule guarding the data layer
- [ ] `.env.example` committed, `.env.local` gitignored
- [ ] Dexie schema at `version(1)` with the compound index
- [ ] `lib/dates.ts` written and DST-tested before any date UI exists
- [ ] `lib/ordering.ts` written with the rebalance-threshold test
- [ ] Bundle visualizer wired into the build
- [ ] Inbox seeded on first run, and made undeletable in both UI and repository
- [ ] `navigator.storage.persist()` requested, with the denial path handled
- [ ] Focus-visible styles present on every interactive element
- [ ] Playwright smoke test: create → complete → reload → still there
