# Feature Ticket List
## Tally — To-Do Web App (v1.0)

| Field | Value |
|---|---|
| Document type | Engineering Backlog |
| Source | `TODO_APP_PRD.md` |
| Total tickets | 38 |
| Must-have for launch | 24 |
| Should-have | 9 |
| Nice-to-have | 5 |
| Estimated must-have effort | ~68 hours |

---

## How to use this document

Each ticket is written in imperative voice addressed to a coding agent, so **the ticket body is the prompt**. Copy a ticket verbatim into Cursor, Antigravity, Claude Code, or similar.

**Paste Ticket 00 once at the start of every session.** It carries the stack, tokens, and file layout that all other tickets assume. Without it the agent will invent its own conventions and every ticket after the third will fight the previous ones.

**Work in dependency order.** Dependencies are listed per ticket and are hard, not advisory.

**Priority labels**
- `MUST` — required for launch. Maps to PRD §5.1 (M1–M9) or is enabling work those features depend on.
- `SHOULD` — PRD §5.2. Ships in v1.1 if the two-week window closes first.
- `NICE` — PRD §5.3. Only after everything above is polished.

**Tickets marked ⚑ are enabling work not named in the PRD.** They have no user-facing feature attached, but the MUST features cannot be built correctly without them. This is the invisible half of the estimate.

---

# TICKET 00 — Session context (paste first, every session)

```
You are building "Tally", a local-first to-do web app. No backend, no accounts.
All data lives in the browser via IndexedDB.

STACK
- React 19 + TypeScript (strict: true, noUncheckedIndexedAccess: true)
- Vite 6
- Tailwind CSS 4
- Zustand 5 for state
- Dexie 4 over IndexedDB for persistence
- date-fns + date-fns-tz for all date logic
- Radix UI primitives for Dialog, DropdownMenu, Toast only
- crypto.randomUUID() for IDs — always client-generated

ARCHITECTURE RULE (non-negotiable)
No component, hook, or store action may import Dexie, IndexedDB, or localStorage
directly. All data access goes through the Repository interface in src/data/.
The UI must not know where data is stored.

FILE LAYOUT
src/
  data/       index.ts, repository.ts, types.ts, local/{db,LocalRepository,seed}.ts
  store/      useTaskStore.ts, useUIStore.ts, selectors.ts
  features/   tasks/, lists/, today/
  components/ Button, Dialog, DropdownMenu, Toast, Icon  (no domain knowledge)
  lib/        dates.ts, ordering.ts, keyboard.ts, id.ts, analytics.ts

DESIGN TOKENS (CSS variables, defined in src/index.css — use these, never raw hex)
--paper #F2F4F3   --surface #FFFFFF      --surface-sunk #EAEDEB
--ink #16201D     --ink-2 #55635E        --ink-3 #8A9691
--rule #DEE4E1    --rule-strong #C6D0CB
--accent #0F5F4C  --accent-hover #0B4A3B --accent-soft #E4F0EC
--overdue #B22D3A --overdue-soft #FBEDEE
Spacing: --sp-1 4px … --sp-8 64px (4px base)
Radius: --r-sm 6 --r-md 8 --r-lg 12 --r-xl 16
Fonts: --font-ui 'Switzer', --font-mono 'Geist Mono'

DESIGN RULES
- Crimson (--overdue) appears ONLY on overdue tasks. Never on delete buttons,
  never on validation errors, never for emphasis.
- Never rely on colour alone — overdue also gets a text label; completed also
  gets strikethrough plus opacity 0.55.
- Signature element: a fixed 64px left column ("time gutter") holding the due
  time in tabular monospaced figures, right-aligned. Tasks with no time show an
  em-dash in --ink-3. The column never changes width.
- Borders are always 1px. Shadows only on hovered rows, popovers, and modals.

QUALITY FLOOR (every ticket)
- Keyboard reachable, visible :focus-visible outline (2px solid --accent, offset 2px)
- Works at 360px width with no horizontal scroll
- Respects prefers-reduced-motion
- WCAG AA contrast
- No console errors
```

---

# EPIC A — Foundation ⚑

*No user-facing output. Everything else depends on it. Do not skip ahead.*

---

### A1 — Project scaffold
**Priority:** `MUST` ⚑ · **Depends on:** none · **Est:** 1h

Initialise a Vite + React + TypeScript project named `tally`. Install and configure Tailwind CSS 4, ESLint, and Prettier. Set up the folder structure from Ticket 00 with `.gitkeep` files in empty directories.

In `tsconfig.json` enable `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, and a `@/*` path alias to `./src/*`. Mirror the alias in `vite.config.ts` under `resolve.alias`.

Add an ESLint `no-restricted-imports` rule blocking imports of `dexie`, `**/data/local/*`, and `localStorage` from within `src/features/**` and `src/components/**`.

Create `.env.example` documenting `VITE_APP_NAME`, `VITE_DB_NAME`, and `VITE_ANALYTICS_DOMAIN`. Add `.env`, `.env.local`, `node_modules/`, and `dist/` to `.gitignore`.

**Acceptance criteria**
- `npm run dev` starts with no errors and no TypeScript warnings
- `npm run build` produces a `dist/` folder
- The `@/` alias resolves in both TypeScript and Vite
- Importing `dexie` from a file under `src/features/` produces a lint error

---

### A2 — Design tokens and global styles
**Priority:** `MUST` ⚑ · **Depends on:** A1 · **Est:** 2h

Create `src/index.css` defining every token from Ticket 00 as CSS custom properties on `:root`, using Tailwind 4's `@theme` block so they are available as utility classes.

Self-host both fonts. Place `woff2` files in `public/fonts/`, declare `@font-face` with `font-display: swap`, and preload the variable Switzer file in `index.html`. **Do not use the Google Fonts CDN.**

Add a global reset: `box-sizing: border-box`, zero default margins, `--paper` background, `--ink` text, `--font-ui` body font, and antialiased rendering. Add the `prefers-reduced-motion` block that collapses all animation and transition durations to `0.01ms`.

Define a `.sr-only` utility class for screen-reader-only text.

**Acceptance criteria**
- Every token from Ticket 00 is available as a CSS variable
- Both fonts render locally with no network request to fonts.googleapis.com
- Enabling "reduce motion" in OS settings disables all transitions
- No layout shift on font load

---

### A3 — Type definitions
**Priority:** `MUST` ⚑ · **Depends on:** A1 · **Est:** 1h

Create `src/data/types.ts` with these exact types:

```ts
export type Priority = 'none' | 'low' | 'medium' | 'high';

export interface List {
  id: string; name: string; isDefault: boolean;
  position: number; createdAt: string; updatedAt: string;
}

export interface Task {
  id: string; listId: string; title: string; notes: string | null;
  dueAt: string | null;      // ISO-8601 UTC
  hasTime: boolean;          // false ⇒ date-only, treat as end of local day
  priority: Priority; isComplete: boolean; position: number;
  createdAt: string; updatedAt: string; completedAt: string | null;
}

export interface TaskFilter {
  listId?: string; isComplete?: boolean;
  dueBefore?: string; search?: string;
}

export interface ExportBundle {
  version: 1; exportedAt: string; lists: List[]; tasks: Task[];
}

export type NewTask = Pick<Task, 'title'> &
  Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewList = Pick<List, 'name'> & Partial<Pick<List, 'position'>>;
```

Also create `src/lib/id.ts` exporting `newId(): string` wrapping `crypto.randomUUID()`.

**Acceptance criteria**
- File compiles under `strict: true`
- No `any` anywhere
- All timestamps typed as `string`, not `Date`

---

### A4 — Repository interface
**Priority:** `MUST` ⚑ · **Depends on:** A3 · **Est:** 1h

Create `src/data/repository.ts` exporting a `Repository` interface with these methods, all returning Promises:

```
getLists(): List[]
createList(input: NewList): List
updateList(id, patch: Partial<List>): List
deleteList(id, strategy: 'move-to-inbox' | 'delete-tasks'): void
getTasks(filter?: TaskFilter): Task[]
getTasksDueBy(endISO: string): Task[]
createTask(input: NewTask): Task
updateTask(id, patch: Partial<Task>): Task
deleteTask(id): void
reorderTask(id, newPosition: number): Task
exportAll(): ExportBundle
importAll(bundle: ExportBundle): void
```

Write the interface only — no implementation. This is the contract every other data ticket implements against.

**Acceptance criteria**
- Interface compiles and is exported
- No implementation code in this file
- Every method returns a Promise

---

### A5 — Dexie database and LocalRepository
**Priority:** `MUST` ⚑ · **Depends on:** A4 · **Est:** 4h

Create `src/data/local/db.ts` defining a Dexie database named from `VITE_DB_NAME` (default `tally`), version 1:

```
lists: 'id, position, name'
tasks: 'id, listId, dueAt, isComplete, position, [listId+isComplete]'
```

Create `src/data/local/LocalRepository.ts` implementing `Repository` against it. Requirements:

- `createTask` generates the id client-side, sets `createdAt`/`updatedAt` to now, defaults `position` to `max(position) + 1000` within the list, and defaults `listId` to the Inbox list when not supplied.
- `updateTask` always refreshes `updatedAt`. When `isComplete` flips to `true`, set `completedAt`; when it flips to `false`, null it.
- `deleteList` with `move-to-inbox` reassigns every task's `listId` to Inbox **before** removing the list. With `delete-tasks` it removes tasks and list in a single Dexie transaction.
- `deleteList` throws if the target list has `isDefault: true`.
- `getTasksDueBy` uses the `dueAt` index and excludes completed tasks.

Create `src/data/local/seed.ts` that, on first run only, creates the Inbox list (`isDefault: true`, `position: 1000`).

Create `src/data/index.ts` exporting a single `repository: Repository` singleton wired to `LocalRepository`.

**Acceptance criteria**
- Every `Repository` method is implemented
- Inbox is created exactly once, never duplicated across reloads
- Attempting to delete Inbox throws
- `deleteList('move-to-inbox')` leaves zero orphaned tasks
- All multi-step writes run inside a Dexie transaction
- Nothing outside `src/data/local/` imports Dexie

---

### A6 — Zustand store and selectors
**Priority:** `MUST` ⚑ · **Depends on:** A5 · **Est:** 3h

Create `src/store/useTaskStore.ts` holding `tasks: Task[]`, `lists: List[]`, `isLoading`, and `error`, with async actions mirroring the repository: `loadAll`, `addTask`, `editTask`, `toggleComplete`, `removeTask`, `addList`, `renameList`, `removeList`, `moveTask`.

**Every mutating action must update local state optimistically first, then persist.** On persistence failure, roll back the optimistic change and set `error`. The UI must never wait on IndexedDB before rendering.

Create `src/store/useUIStore.ts` holding `activeView: { type: 'today' } | { type: 'list'; listId: string }`, `isSidebarOpen`, and `theme`.

Create `src/store/selectors.ts` with pure functions: `selectTasksForList`, `selectOpenCount(listId)`, `selectCompletedTasks`, `selectTodayTasks` (leave the last one stubbed until D3).

**Acceptance criteria**
- A created task appears in the UI in under 50ms, before persistence resolves
- A forced repository rejection rolls the optimistic update back
- Store imports only from `src/data`, never from `src/data/local`
- Selectors are pure and independently unit-testable

---

# EPIC B — Task core

*PRD M1, M3, M4, M5, M7.*

---

### B1 — Date and time utilities ⚑
**Priority:** `MUST` ⚑ · **Depends on:** A3 · **Est:** 3h

Create `src/lib/dates.ts` as the **only** file in the project permitted to import `date-fns` or `date-fns-tz`. Export:

```ts
getUserTimezone(): string                     // Intl.DateTimeFormat().resolvedOptions().timeZone
toUTC(local: Date, tz: string): string
fromUTC(iso: string, tz: string): Date
effectiveDueAt(task: Task, tz: string): Date  // hasTime false ⇒ 23:59:59 local that day
isOverdue(task: Task, now: Date, tz: string): boolean
todayRangeUTC(now: Date, tz: string): { start: string; end: string }
formatGutter(task: Task, tz: string): string  // "18:00" | "—" | "Yesterday" | "3 days ago"
```

Rules: store UTC always, convert only at the boundary, and compute "today" from **local** midnight-to-midnight converted to UTC — never UTC midnight.

Write unit tests in `tests/unit/dates.test.ts` covering: a date-only task sorting correctly against a timed task; a task due during the March and November DST transitions in `America/New_York`; a task due at exactly local midnight; and `todayRangeUTC` for a user in `Asia/Kolkata` (UTC+5:30).

**Acceptance criteria**
- All listed functions exported and typed
- DST tests pass in both directions
- A date-only task never renders as "12:00 AM"
- No other file imports date-fns

---

### B2 — Fractional ordering utility ⚑
**Priority:** `MUST` ⚑ · **Depends on:** A3 · **Est:** 1h

Create `src/lib/ordering.ts`:

```ts
const GAP = 1000;
export function positionBetween(before?: number, after?: number): number;
export function needsRebalance(before: number, after: number): boolean; // gap < 0.0001
export function rebalance(items: {id: string; position: number}[]): {id: string; position: number}[];
```

`positionBetween` returns the midpoint of two neighbours, `after - GAP` when appended to the front, `before + GAP` when appended to the end, and `GAP` for an empty list. A reorder must be a single-row update.

Unit-test the precision-exhaustion path: 60 consecutive midpoint insertions into the same gap must trigger `needsRebalance`.

**Acceptance criteria**
- Reordering updates exactly one record
- `needsRebalance` fires before float precision is lost
- `rebalance` reassigns clean positions preserving relative order

---

### B3 — Capture input (PRD M1)
**Priority:** `MUST` · **Depends on:** A6 · **Est:** 3h

Build `src/features/tasks/TaskInput.tsx` — the always-visible field at the top of the task view, and the most important component in the product.

Specification: 52px tall, full width, `--surface` background, `1px solid --rule-strong`, `--r-md`, `--shadow-sm`, padding `0 --sp-4 0 --sp-5`. **Font size exactly 16px** — below 16px iOS Safari zooms the viewport on focus and does not zoom back. Placeholder `Add a task` in `--ink-3`. On focus: border `--accent`, `box-shadow: 0 0 0 3px var(--accent-soft)`, native outline replaced not removed.

Behaviour: Enter commits the task to the currently active list and clears the field **while retaining focus** so the next task can be typed immediately. Empty or whitespace-only input is silently ignored — no error message. Titles cap at 200 characters. Autofocus on mount.

**Acceptance criteria**
- Type text, press Enter → task appears at the bottom of the list, field clears, focus retained
- Ten tasks can be entered consecutively without touching the mouse
- Whitespace-only submission does nothing and shows no error
- On a real iPhone, focusing the field does not zoom the viewport
- Task created in the active list, or Inbox when Today is active

---

### B4 — Task row and list rendering
**Priority:** `MUST` · **Depends on:** A6, B1 · **Est:** 4h

Build `src/features/tasks/TaskRow.tsx` and `src/features/tasks/TaskList.tsx`.

Row layout, left to right: **time gutter (64px fixed, `--font-mono` 13px, `font-variant-numeric: tabular-nums`, right-aligned, `--ink-2`)** → checkbox (20px) → title (flex-1, 15px) → `⋯` actions button (24px).

Row height 40px at ≥1024px, 44px at ≥768px, 48px below. Background `--surface`, `1px solid --rule` separator between rows only. On hover: `--surface-sunk` background, `--r-md`, `--shadow-sm`, actions button fades in over 120ms. On touch devices the actions button is always visible.

Gutter content comes from `formatGutter()`. Tasks with no due date show an em-dash in `--ink-3` aligned to the same right edge — **the gutter never changes width and is never omitted.**

`TaskList` renders a `<ul>` of `<li>` rows, sorted by `position` ascending, with completed tasks excluded (they belong to the Completed section in B5).

**Acceptance criteria**
- Every time in the gutter aligns to a single vertical edge, including em-dash rows
- Digits are tabular — `11:00` and `18:00` occupy identical width
- Titles wrap to two lines maximum then truncate with an ellipsis
- Rows are semantic `<ul>`/`<li>`
- Row height meets the 44px minimum touch target on mobile

---

### B5 — Complete and uncomplete (PRD M3)
**Priority:** `MUST` · **Depends on:** B4 · **Est:** 3h

Add completion to `TaskRow` using a real `<input type="checkbox">` with an associated label — not a styled `<div>`.

Checkbox: 20×20px, `--r-sm`, `1.5px solid --rule-strong`. On check it fills `--accent` and a white tick draws over 180ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`.

**The completed row holds in place for 400ms before moving.** It must not vanish on click — the pause is the moment of satisfaction and is a deliberate retention mechanic. After the hold, the row animates into a `Completed` section at the bottom of the view, collapsed by default, with a `--t-label` header showing the count.

Completed styling: `line-through` with `text-decoration-color: var(--ink-3)` and `opacity: 0.55`. Toggling is fully reversible and returns the task to its original `position`.

Announce state changes through an `aria-live="polite"` region.

**Acceptance criteria**
- Clicking the checkbox toggles state and persists across reload
- The row visibly holds for ~400ms before relocating
- Unchecking restores the task to its previous position in the open list
- Completion is operable by keyboard (Space) with a visible focus ring
- Screen readers announce the change

---

### B6 — Inline edit (PRD M4)
**Priority:** `MUST` · **Depends on:** B4 · **Est:** 3h

Add inline title editing to `TaskRow` via `src/features/tasks/hooks/useInlineEdit.ts`. Triggered by double-click on the title or by "Edit" in the row's `⋯` menu.

The edit state must have **no visible input chrome** — `--surface-sunk` background, no border, `--r-sm`. It should read as the text becoming editable, not as a form appearing. Place the caret at the click position.

Enter or blur commits. Escape reverts to the original value and exits. An empty result reverts rather than deleting the task. The row must not change height between display and edit modes.

No edit action may navigate away from the list.

**Acceptance criteria**
- Double-click enters edit mode with the caret at the click point
- Escape reverts; Enter commits; blur commits
- Clearing the field and committing reverts instead of deleting
- Row height is identical in both modes — no layout shift
- Edit mode is reachable by keyboard

---

### B7 — Delete with undo (PRD M5)
**Priority:** `MUST` · **Depends on:** B4 · **Est:** 3h

Add deletion via the row's `⋯` menu. **No confirmation dialog.**

Build `src/components/Toast.tsx` on Radix Toast. Bottom-centre on desktop, bottom full-width on mobile, 16px from the edge. `--surface`, `--r-md`, `--shadow-md`, `--sp-3` padding, `--t-meta` type. Message `Task deleted` on the left, ghost `Undo` button on the right. A hairline `--accent` progress rule drains along the bottom edge over 5 seconds. Hover pauses the timer. Maximum one toast at a time.

Deletion is optimistic: remove from the store immediately, hold the record in memory for the toast window, and commit the repository delete only when the toast expires. Undo restores the task at its original `position`.

**Acceptance criteria**
- Delete removes the row instantly with no confirmation step
- Undo within 5s restores the task in its original position
- After the toast expires the deletion is permanent and survives reload
- Hovering the toast pauses the countdown
- Deleting a second task replaces the first toast rather than stacking

---

# EPIC C — Lists

*PRD M6.*

---

### C1 — Sidebar shell
**Priority:** `MUST` · **Depends on:** A6 · **Est:** 3h

Build `src/features/lists/Sidebar.tsx` and `ListItem.tsx`. Fixed 260px width at ≥1024px, `--paper` background, `1px solid --rule` right border.

Structure: a `Today` entry pinned at top, a `--t-label` "LISTS" header, then all lists ordered by `position` with Inbox first, then a `+ New list` ghost button.

Each row: 36px tall, `--t-body-strong`, with an open-task count right-aligned in `--ink-3` `--t-meta`. Active row gets `--accent-soft` background and `--ink` text. Counts come from `selectOpenCount` and update immediately on any task change.

Wrap in `<nav>`. Include `.sr-only` text on counts: `12 open tasks`.

**Acceptance criteria**
- Counts reflect open tasks only and update without reload
- Active list is visually distinct and marked `aria-current="page"`
- Inbox always sorts first
- Fully keyboard navigable

---

### C2 — Create and rename lists
**Priority:** `MUST` · **Depends on:** C1 · **Est:** 2h

Build `src/features/lists/NewListInput.tsx`. Clicking `+ New list` replaces the button with an inline 32px input in place — no modal. Enter commits, Escape cancels, blur commits if non-empty.

Rename uses the same inline pattern, triggered from the list row's context menu.

Names are 1–40 characters, enforced in the UI and validated in the repository. Duplicate names are **allowed** — this is not an error condition. Over-length input shows a `--t-meta` `--ink-2` message below the field: `List names are limited to 40 characters.` **Not crimson** — crimson is reserved for overdue only.

New lists get `position = max + 1000`.

**Acceptance criteria**
- Creating a list adds it to the sidebar immediately and persists
- Escape cancels without creating
- Duplicate names are accepted silently
- Over-length input is prevented with non-crimson guidance
- Inbox cannot be renamed

---

### C3 — Delete list dialog
**Priority:** `MUST` · **Depends on:** C1 · **Est:** 3h

Build `src/components/Dialog.tsx` on Radix Dialog, then `src/features/lists/DeleteListDialog.tsx`.

Dialog spec: overlay `rgba(16,22,20,0.4)` with `backdrop-filter: blur(2px)`; container `--surface`, `--r-xl`, `--shadow-lg`, `max-width: 440px`, `--sp-5` padding. Title `--t-title`, body `--t-meta` `--ink-2` capped at 40ch. Actions right-aligned, secondary left of primary. On mobile it becomes a bottom sheet sliding up over 240ms with `--r-xl` top corners only.

Content when the list has tasks: title `Delete "Uni"?`, body `This list has 7 tasks. Choose what happens to them.`, and three actions — `Cancel` (secondary), `Move to Inbox` (secondary), `Delete tasks too` (primary). When the list is empty, delete immediately with no dialog.

Inbox has no delete option anywhere in the UI.

**Acceptance criteria**
- Focus moves into the dialog on open and is trapped
- Escape and overlay click both close without deleting
- Focus returns to the trigger element on close
- Body scroll is locked while open
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` set
- "Move to Inbox" leaves zero orphaned tasks
- Empty lists delete with no dialog

---

### C4 — Move a task to another list
**Priority:** `MUST` · **Depends on:** B4, C1 · **Est:** 2h

Build `src/components/DropdownMenu.tsx` on Radix, then add `Move to…` to the task row's `⋯` menu opening a submenu of all lists except the current one. Selecting one updates `listId` and assigns `position = max + 1000` in the destination.

Menu spec: `--surface`, `--r-lg`, `--shadow-md`, `--sp-1` padding, 32px items, `--t-meta`.

**Acceptance criteria**
- The task disappears from the source list and appears in the destination
- Both sidebar counts update immediately
- The menu is keyboard navigable with arrow keys and Escape
- The current list is not offered as a destination

---

# EPIC D — Time

*PRD M2, M8. The product's core differentiator.*

---

### D1 — Due date and time picker (PRD M2)
**Priority:** `MUST` · **Depends on:** B1, B4 · **Est:** 4h

Build `src/features/tasks/DueDatePicker.tsx` using **native** `<input type="date">` and `<input type="time">` — native pickers eliminate an entire class of validation bugs and are already accessible and localised.

Two entry points: a calendar icon inside `TaskInput` (set before committing), and `Set date` in the row's `⋯` menu (set after).

Rules: both fields default to empty. **A date alone is valid** and sets `hasTime: false`. **A time alone is invalid** — disable the time field until a date is chosen. Convert the local selection to UTC via `toUTC()` before storing. Past dates are permitted — backdating is legitimate and must not be blocked.

Include a `Clear` action removing both `dueAt` and `hasTime`.

**Acceptance criteria**
- Date without time stores `hasTime: false` and renders in the gutter as an em-dash
- The time field is disabled until a date exists
- A past date is accepted and immediately renders as overdue
- Stored `dueAt` is UTC; the picker displays local time
- Setting 6:00 PM local produces the correct UTC instant in `Asia/Kolkata`

---

### D2 — Overdue state
**Priority:** `MUST` · **Depends on:** D1 · **Est:** 2h

Render overdue tasks distinctly wherever they appear. A task is overdue when `isOverdue()` returns true — incomplete, with `dueAt` before now, using end-of-local-day for date-only tasks.

Treatment: gutter text in `--overdue`; row background `--overdue-soft`; the gutter shows a **relative label** (`Yesterday`, `3 days ago`) instead of a clock time.

**The relative label is mandatory, not decorative** — it is what makes the state perceivable without colour, and roughly 1 in 12 men cannot distinguish the crimson.

Overdue state must recompute when the app regains focus so a tab left open overnight is correct on return.

**Acceptance criteria**
- Overdue is identifiable in a greyscale screenshot
- `--overdue` appears nowhere else in the app
- A task becoming overdue while the tab is open updates on refocus
- Completed tasks are never marked overdue

---

### D3 — Today view (PRD M8)
**Priority:** `MUST` · **Depends on:** D2, C1 · **Est:** 4h

Build `src/features/today/TodayView.tsx` and complete `selectTodayTasks`.

Contents: every incomplete task across **all** lists whose `dueAt` falls before local end-of-day, including overdue. Two sections — an `OVERDUE` group (`--t-label` header) at top, then today's tasks sorted by `dueAt` ascending. Tasks with no due date never appear here.

Use `todayRangeUTC()` for the boundary. Never hardcode UTC midnight.

**Routing rule from the PRD:** Today is the default landing view when any task is due today or overdue; otherwise the app lands on Inbox.

The view must roll over at local midnight without a manual refresh — recompute on an interval and on window focus.

**Acceptance criteria**
- Shows tasks from every list, not just the active one
- Overdue tasks group above today's, both correctly sorted
- Undated tasks never appear
- Correct boundaries for a user in `Asia/Kolkata`
- Landing view follows the routing rule on cold load
- Left open past midnight, the view updates without a refresh

---

# EPIC E — Responsive and polish

*PRD M9.*

---

### E1 — Mobile drawer
**Priority:** `MUST` · **Depends on:** C1 · **Est:** 3h

Below 1024px the sidebar becomes an off-canvas drawer. A hamburger button in the header opens it; it slides in from the left over 240ms with `cubic-bezier(0.16, 1, 0.3, 1)` behind a `rgba(16,22,20,0.4)` overlay.

Closes on overlay tap, Escape, and on selecting a list. Traps focus while open. Locks body scroll. All touch targets ≥44px.

**Acceptance criteria**
- Drawer opens and closes smoothly at 360px width
- Selecting a list closes the drawer and navigates
- Focus is trapped while open and returns to the hamburger on close
- Respects `prefers-reduced-motion`

---

### E2 — Responsive pass
**Priority:** `MUST` · **Depends on:** E1, D3 · **Est:** 3h

Audit every view at 360px, 768px, and 1280px. Apply: content `max-width: 720px` centred; time gutter 64px at ≥768px, 52px below; row heights 48/44/40px by breakpoint.

Fix any horizontal overflow. Verify long unbroken strings wrap rather than overflow. Verify the time gutter still aligns at the narrow width.

**Acceptance criteria**
- No horizontal scroll at 360×640
- No unreachable controls at any width
- Gutter alignment holds at 52px
- A 200-character title with no spaces wraps correctly
- Verified on a real mobile browser, not only devtools emulation

---

### E3 — Empty states
**Priority:** `MUST` · **Depends on:** D3 · **Est:** 2h

Build `src/features/tasks/EmptyState.tsx`. Centred block, `--sp-8` vertical padding. Headline `--t-display` in `--ink`, body `--t-meta` in `--ink-2`. **No illustrations, no icons, no mascot** — the design direction is quiet and an illustration breaks it.

| Context | Headline | Body |
|---|---|---|
| First run | Start with one thing | Type it above and press Enter. Add a time if it has a deadline. |
| Today, nothing due | Nothing due today | Anything without a date is waiting in Inbox. |
| Empty list | This list is empty | Add your first task above. |
| Search, no results | No tasks match "*query*" | Try a shorter search. |

The first-run state must be replaced permanently once any task exists. The capture input stays visible and focused in every empty state.

**Acceptance criteria**
- Correct copy per context
- First-run state never returns after the first task
- Capture input remains focused and usable
- Tone is directional, not apologetic

---

### E4 — Keyboard and accessibility audit
**Priority:** `MUST` · **Depends on:** E3 · **Est:** 3h

Audit the entire app against the quality floor.

Verify: every interactive element is Tab-reachable in visual order; `:focus-visible` shows `2px solid --accent` with `2px` offset everywhere; checkboxes are real inputs with labels; the task list is `<ul>`/`<li>` and the sidebar is `<nav>`; counts carry `.sr-only` text; an `aria-live="polite"` region announces completion and deletion; all text meets WCAG AA in both themes; touch targets are ≥44px on mobile.

**Complete the entire core loop — create, set a time, complete, delete, undo — using only the keyboard. If any step is impossible, the ticket is not done.**

**Acceptance criteria**
- Full core loop completable without a mouse
- No element has `outline: none` without a replacement
- Axe DevTools reports zero critical or serious issues
- Verified with VoiceOver or NVDA on the core loop

---

# EPIC F — Durability

*Not in the PRD's MUST tier. See the note on F1.*

---

### F1 — JSON export
**Priority:** `MUST` *(promoted from PRD S7 — see note)* · **Depends on:** A5 · **Est:** 2h

> **Why promoted.** The PRD ranks export as a should-have, but browsers can evict IndexedDB under storage pressure, private mode may discard it on close, and clearing browsing data wipes it. With no accounts and no server, export is the only thing standing between a user and total unrecoverable data loss. It is two hours of work. Build it in week one.

Implement `exportAll()` producing an `ExportBundle` (`version: 1`, `exportedAt`, all lists, all tasks) and download it as `tally-export-YYYY-MM-DD.json` via a Blob URL. Trigger from a small `Export data` link in the sidebar footer.

**Acceptance criteria**
- Produces valid JSON containing every list and task
- Filename carries the date
- Round-trips through F2 with zero data loss
- Works with 1,000+ tasks without freezing the UI

---

### F2 — JSON import
**Priority:** `SHOULD` · **Depends on:** F1 · **Est:** 3h

Implement `importAll()` behind a file picker accepting `.json`.

**Validate the entire file before writing anything.** Use Zod: check `version === 1`, validate every list and task against the schema, reject unknown fields rather than ignoring them, and cap file size at 5MB. Import inside a single Dexie transaction so a failure changes nothing.

Regenerate all IDs on import to avoid collisions with existing data. Offer two modes: merge into existing data, or replace everything (replace requires a confirmation dialog).

On a malformed file: `That file doesn't look like a Tally export. Nothing was changed.`

**Acceptance criteria**
- A malformed file changes zero records
- A partially-valid file is rejected whole, not partially applied
- Merge does not create duplicate IDs
- Files over 5MB are rejected with a clear message

---

### F3 — Storage availability handling
**Priority:** `MUST` · **Depends on:** A5 · **Est:** 2h

On startup call `navigator.storage.persist()` if available and handle denial gracefully.

Detect a failed IndexedDB open (private mode, blocked storage) and fall back to an in-memory repository so the app stays usable. Show a persistent non-blocking banner: `Heads up — this browser isn't letting Tally save your tasks, so they'll disappear when you close the tab. You can export them any time.` with an export link.

Handle quota-exceeded errors on write: block the write, never partially write, and surface `Your browser's storage is full. Export your tasks, then remove some completed items.`

On a corrupted database, do **not** auto-wipe. Offer the raw data as a download and let the user decide.

**Acceptance criteria**
- The app loads and functions in private/incognito mode
- The banner appears when storage is unavailable and never blocks input
- Quota errors never leave a half-written record
- A corrupted database is never silently destroyed

---

# EPIC G — Should-have tier

*PRD §5.2. Build in this order if time remains.*

---

### G1 — Dark theme (PRD S6)
**Priority:** `SHOULD` · **Depends on:** A2 · **Est:** 2h

Add a `[data-theme="dark"]` token block on `<html>`: `--paper #101614`, `--surface #18211E`, `--surface-sunk #0B0F0E`, `--ink #E8EDEB`, `--ink-2 #9AA8A3`, `--ink-3 #6B7873`, `--rule #252F2B`, `--rule-strong #38443F`, `--accent #3FBF9C`, `--accent-hover #5BD3B2`, `--accent-soft #152A25`, `--overdue #F0808C`, `--overdue-soft #2A1518`.

Default to `prefers-color-scheme`, with a manual toggle in the sidebar footer persisted in the store. Apply the attribute before first paint via an inline script in `index.html` to prevent a flash of the wrong theme.

**Acceptance criteria**
- No flash of light theme on load in dark mode
- Every token pair meets WCAG AA in dark
- Manual choice persists across reload
- Overdue remains distinguishable in dark

---

### G2 — Keyboard shortcuts (PRD S5)
**Priority:** `SHOULD` · **Depends on:** E4 · **Est:** 2h

Create `src/lib/keyboard.ts` registering global handlers: `n` focuses the capture input, `/` focuses search, `Escape` cancels the current edit or closes the open overlay, `?` opens a shortcuts help dialog.

**Shortcuts must not fire while an input, textarea, or contenteditable has focus.** Guard on `event.target`.

**Acceptance criteria**
- Typing "n" inside a text field inserts the letter and does not trigger the shortcut
- Escape cancels edit mode without closing an unrelated dialog
- The help dialog lists every shortcut

---

### G3 — Task reordering (PRD S2)
**Priority:** `SHOULD` · **Depends on:** B2, B4 · **Est:** 4h

Add drag-to-reorder within a list using `@dnd-kit/sortable`. On drop, compute the new position with `positionBetween()` and issue **one** repository update.

Provide a keyboard alternative — `Move up` / `Move down` in the row menu, bound to `Alt+↑` / `Alt+↓`. Drag-only reordering is not accessible.

Call `needsRebalance()` after each move and rebalance the list when it returns true.

**Acceptance criteria**
- Dragging updates exactly one record
- Order persists across reload
- Reordering is fully achievable by keyboard
- Sixty consecutive insertions into one gap trigger a rebalance without visible change
- Disabled in Today view, which is time-sorted

---

### G4 — Search (PRD S1)
**Priority:** `SHOULD` · **Depends on:** C1 · **Est:** 3h

Add a search input to the sidebar filtering tasks by title and notes across all lists, case-insensitive, debounced at 200ms. Results render in the main area grouped by list with the matched substring in `--ink` and surrounding text in `--ink-2`.

Empty query returns to the previous view. No results shows the E3 empty state with the query echoed.

**Acceptance criteria**
- Matches across every list, not just the active one
- Debounced — no filtering on every keystroke
- `/` focuses the field (with G2)
- Clearing restores the previous view
- Highlighting does not use `dangerouslySetInnerHTML`

---

### G5 — Priority flags (PRD S3)
**Priority:** `SHOULD` · **Depends on:** B4 · **Est:** 2h

Add a priority control to the row menu cycling `none → low → medium → high`. Display as a small flag icon left of the title. **Use weight and opacity to differentiate, not colour** — colour is reserved.

In Today view, sort by `dueAt` first, then priority descending as a tiebreaker.

**Acceptance criteria**
- Priority persists and survives reload
- No new colour is introduced
- Today's tiebreak ordering is correct
- Settable by keyboard

---

### G6 — Notes field (PRD S4)
**Priority:** `SHOULD` · **Depends on:** B6 · **Est:** 2h

Add an expandable notes area to the task row, opened via `Add note` in the row menu or by clicking an existing note indicator. Plain textarea, auto-growing to 6 lines then scrolling, 2,000 character cap, `--surface-sunk` background, no border.

Rows with notes show a small indicator after the title. **Render notes as plain text — never `dangerouslySetInnerHTML`.**

**Acceptance criteria**
- Notes persist and survive reload
- Auto-grows to a maximum of six lines
- HTML typed into notes displays as literal text
- The indicator appears only when a note exists

---

# EPIC H — Launch

---

### H1 — Analytics
**Priority:** `SHOULD` · **Depends on:** E4 · **Est:** 2h

Create `src/lib/analytics.ts` wrapping Plausible. **No-op entirely when `VITE_ANALYTICS_DOMAIN` is unset** so development never pollutes production data.

`POST https://plausible.io/api/event` with `{ name, url, domain, props }`. Events: `task_created` (`has_due_date`, `has_time`, `list_type`), `task_completed` (`was_overdue`), `task_deleted` (`was_undone`), `list_created`, `data_exported`.

**Never send task content.** No titles, no notes, no list names — send `list_type: "custom"`, never the actual name. Props are strings from a fixed enumerable set. Never block the UI on the response; never surface an analytics failure to the user.

**Acceptance criteria**
- Fully disabled when the env var is unset
- Network inspection confirms no task text is transmitted
- A failed request produces no user-visible error
- Every PRD §9 metric is derivable from these events

---

### H2 — Deployment configuration
**Priority:** `MUST` · **Depends on:** E4 · **Est:** 2h

Configure Vercel or Netlify deployment. **Include the SPA rewrite** — `/(.*)` → `/index.html` — or deep links 404 on refresh.

Add security headers: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://plausible.io; frame-ancestors 'none'; base-uri 'self'`, plus `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.

Add `rollup-plugin-visualizer` and confirm the gzipped initial JS bundle is under 150KB.

**Acceptance criteria**
- Refreshing on a deep link returns the app, not a 404
- CSP headers present in the production response
- Initial JS under 150KB gzipped
- Lighthouse Performance ≥ 90 on mobile
- HTTPS enforced

---

### H3 — Definition-of-done verification
**Priority:** `MUST` · **Depends on:** all MUST tickets · **Est:** 3h

Verify the PRD §8 definition of done. This ticket is a checklist, not new code.

- [ ] All M1–M9 acceptance criteria pass
- [ ] Works on current Chrome, Firefox, Safari, mobile Safari, mobile Chrome
- [ ] Usable at 360px with no horizontal scroll
- [ ] Zero console errors across every core flow
- [ ] Data survives hard refresh and full browser restart
- [ ] Core loop completable by keyboard alone
- [ ] WCAG AA contrast in both themes
- [ ] Two tabs open simultaneously do not corrupt state
- [ ] Time-to-first-task under 10s on a cold load over 4G
- [ ] `--overdue` appears nowhere except overdue tasks
- [ ] Time gutter aligns across every row in every view
- [ ] DST tests pass in both directions
- [ ] Export produces a file that re-imports cleanly

Write three Playwright smoke tests in `tests/e2e/core-loop.spec.ts`: create a task with a due time and confirm it appears in Today; complete it and confirm it moves to Completed; reload and confirm state persists.

**Acceptance criteria**
- Every box ticked with evidence
- All three Playwright tests pass
- Any failure is filed as a new ticket rather than silently fixed

---

## Appendix — Dependency order

```
A1 → A2
A1 → A3 → A4 → A5 → A6
A3 → B1 ─┐
A3 → B2  │
A6 ──────┴→ B3 → B4 → B5, B6, B7
A6 → C1 → C2, C3
B4 + C1 → C4
B1 + B4 → D1 → D2 → D3
C1 → E1 → E2 → E3 → E4
A5 → F1 → F2
A5 → F3
E4 → G1…G6, H1, H2 → H3
```

**Critical path to a demoable app:** A1 → A3 → A4 → A5 → A6 → B1 → B3 → B4 → B5 → D1 → D3. Approximately 30 hours. Everything else improves an app that already works.

## Appendix — Effort summary

| Epic | Tickets | Must-have hours |
|---|---|---|
| A — Foundation | 6 | 12 |
| B — Task core | 7 | 20 |
| C — Lists | 4 | 10 |
| D — Time | 3 | 10 |
| E — Responsive & polish | 4 | 11 |
| F — Durability | 3 | 4 (F2 is SHOULD) |
| G — Should-have | 6 | 0 |
| H — Launch | 3 | 5 (H1 is SHOULD) |
| **Total MUST** | **24** | **~68h** |

At 6 productive hours a day that is roughly 11–12 working days — consistent with the PRD's two-week window, with almost no slack. **If you fall behind, cut from Epic G, never from Epic F.**
