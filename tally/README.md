# Tally

A to-do web app for people who plan by time, not by list.

Capture a task in under three seconds, give it a date and a time, put it in a
list, and check it off. It opens instantly, needs no account, and keeps your
data on your own device.

Built from the specification in the four documents one directory up:
`TODO_APP_PRD.md`, `TODO_APP_ARCHITECTURE.md`, `TODO_APP_FRONTEND_SPEC.md` and
`TODO_APP_SECURITY.md`.

---

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Unit tests — dates, ordering, import validation |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run check` | All three of the above, in order |
| `npm run e2e` | End-to-end suite on Chromium, Firefox, WebKit and mobile Safari |
| `npm run e2e:chromium` | The same suite on one engine, for a faster loop |

There is nothing to configure. `.env.example` documents the optional variables;
the app runs correctly with no `.env` file at all.

---

## What it does

**Capture.** One always-visible field. Type, press Enter, keep typing. The
field holds focus so ten tasks take ten sentences and no mouse.

**Time.** A due date is optional; a time is optional on top of that. A task due
"Tuesday" and a task due "Tuesday at 18:00" are different things and are stored
as different things — which is why a date-only task never renders as 12:00 AM.

**Today.** Everything still open across every list that is due before tonight,
with anything already late pulled out and put on top. It rolls over at local
midnight on its own.

**Lists.** Create, rename, delete. Deleting a list that still holds tasks asks
what should happen to them; deleting an empty one just goes. Inbox cannot be
removed, because every task needs somewhere to live.

**Repeats.** Daily, weekly, monthly or yearly, set beside the date it counts
from and disabled until there is one. Ticking a repeating task completes the
occurrence you ticked — which keeps its own date, as the record of what was
actually done — and opens the next one. Unticking takes that next one back out
again, days later and across reloads: the link is a field on the task, not
something held in the tab. Nothing rewrites a task you already finished, and
nothing withdraws an occurrence you have edited, completed, or already carried
forward.

**Completed, in view.** Above 1280px, finished work is a column beside the open
list, grouped by the day it was actually done. Below that it collapses to a
fold-down under the list, which is where it has always been and works down to
360px.

**Activity.** A year of days, one square each, darkest where the most got
finished. A to-do list only ever shows the present tense — what is left — and
is therefore very good at making a productive month feel like nothing happened;
this is the other half of the record. Clicking a square opens that day: what
was completed on it, and what was due on it and was not.

The two counts are deliberately not halves of one number. **Completed** is
bucketed by when the work was actually done. **Outstanding** is bucketed by the
due date and asks what that day still owed when it ended — so a task due Monday
and finished Thursday is outstanding on Monday *and* completed on Thursday. A
day that ended owing something is ringed rather than recoloured, because a
second hue would compete with the one the whole grid is built on.

**A guided tour.** On a first visit — an empty database, nothing imported —
the app offers a fourteen-step walk through every feature, spotlighting the
real interface rather than a set of screenshots. It never advances on its own
and never touches your data. Skip it and it does not come back; ask for it
again from the compass in the sidebar footer. Arrow keys move through it, Escape
leaves.

**Undo, not confirm.** Deleting takes one click and no dialog. A five-second
undo sits at the bottom of the screen. A confirmation prompt taxes the
ninety-nine deletions in a hundred that were meant, to guard the one that was
not.

**Export.** One file, all your data, any time. With no account and no server,
this is the only thing standing between you and a browser that clears its
storage — so it ships in version one rather than "later".

**Offline, and installable.** A service worker caches the shell and the
content-hashed bundles, so the app opens on a plane exactly as it does on
Wi-Fi — the tasks were always local; now the app is too. A web manifest lets
the browser install it to a home screen, where it runs without an address bar.
Registered in production only: a worker in front of the dev server serves
yesterday's chunks and calls it a cache hit.

Also here: search, drag-and-keyboard reordering, three-level priority, notes,
the powder theme, and keyboard shortcuts (press `?`).

---

## How it is put together

```
src/
  data/            The only code that knows where data lives
    repository.ts    The interface every other layer talks to
    bundle.ts        Import validation — the one untrusted input
    local/           IndexedDB (Dexie), plus an in-memory fallback
  store/           Zustand state, optimistic writes, pure selectors
  features/        tasks/ lists/ today/ activity/ search/ tutorial/ data/
  components/      Generic pieces with no domain knowledge
  lib/             dates, ordering, ids, keyboard, the shared clock
```

**One rule holds the whole thing up:** no component, hook or store action may
import Dexie, IndexedDB or `localStorage`. Everything goes through the
`Repository` interface. Adding accounts and sync later means writing a second
implementation of that interface and changing one line in `src/data/index.ts` —
no UI file is touched. There is an ESLint rule enforcing it, because the version
of you at midnight is not to be trusted with a convention.

Two more boundaries worth knowing:

- **`lib/dates.ts` is the only file allowed to import `date-fns`.** Timezone and
  daylight-saving logic is exactly the kind of thing that ends up subtly wrong
  in fourteen places if it is allowed to spread. Also lint-enforced.
- **`dangerouslySetInnerHTML` is a lint error.** React escapes text by default
  and there is precisely one way to switch that off, so it is never switched
  off. That is the whole of the XSS defence, and it is enough.

### The stack, and why

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript, `strict` plus `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS 4, tokens in `@theme` |
| State | Zustand |
| Storage | Dexie over IndexedDB |
| Dates | date-fns + date-fns-tz |
| Primitives | Radix UI — dialog, dropdown, popover, toast |
| Reordering | dnd-kit |

Storage is IndexedDB rather than `localStorage` deliberately: `localStorage` is
synchronous, so every write blocks the main thread; it stores strings only, so
every read re-parses the whole dataset; it caps out near 5 MB; and it has no
indexes at all.

There is no component library and no icon library. Eight components and eleven
icons are not worth several hundred kilobytes and a few hundred packages — and a
dependency you never install is a supply-chain risk you never take, which the
security document names as one of the two threats actually worth defending
against.

Tests run on Node's own test runner with Node 24's built-in type stripping. No
test framework, no bundler, no extra dependency; `tests/resolver.mjs` teaches the
loader the `@/` alias in about thirty lines. **131 unit tests** cover the dates,
ordering, recurrence, activity bucketing, import validation, repository contract,
selectors and the store — including the optimistic-rollback path, which is the
one place the screen and the database can disagree.

The recurrence set is worth naming, because each case is one that a naive
implementation gets wrong and no amount of clicking around finds: a daily task
holding its wall-clock time across a daylight-saving boundary, a monthly task
on the 31st clamping to February and then *returning* to the 31st, 29 February
falling back to the 28th, a date-only task not sliding a day for users west of
UTC, and a task finished three weeks late producing one occurrence rather than
three.

**33 end-to-end tests** run against a production build on Chromium, WebKit and
mobile Safari (Firefox is configured but could not launch in this environment).
They cover what only a real browser can answer: that IndexedDB survives a
reload, that Enter genuinely commits, that nothing logs to the console, that
the app still opens with the network switched off, that ticking a repeating row
leaves two rows behind and unticking it *after a reload* still withdraws the
one it created, that the completed column becomes a fold-down below 1280px, that every
step of the guided tour lands inside the viewport, and that 5,000 tasks do not
freeze the list. The two offline tests are
Chromium-only — Playwright's service worker support elsewhere is partial enough
that a failure would be the harness's, not Tally's.

---

## Design — Navy & Powder

Two colours, and everything else derived from them. A palette this narrow is
what makes a thing read as expensive: one hue, held all the way down.

| | | |
|---|---|---|
| `#0A2540` | **navy** | The deep ground at night, and the ink and the interactive colour by day. |
| `#C7DDEB` | **powder** | The ground by day, and the ink and the gilt at night. |

Every other token is one of those two lifted, dropped, or thinned to an alpha.
No third hue is introduced anywhere, with one exception: the warning tint,
which has a job no blue can do in a palette that is blue from end to end.

**Navy** is the default ground; **powder** is the same room with the shutters
open, not a different one. Gilt appears as gilding actually does — a hairline,
an edge, a set time — and never as a fill.

The surfaces are **glass**. Every panel is a pane held above the ground: it
lets the colour behind it through, blurs and slightly over-saturates what it
catches, and takes a bright frosted hairline along its top edge where the light
lands. The page underneath is not a flat fill but three pools of light, so the
panes have something real to bend.

The translucency is held at 0.66 alpha rather than the 0.2 the effect is
usually drawn at. Composited over a ground of the same hue that is still
unmistakably glass; composited over anything else it is a legibility bug
waiting for the one user whose wallpaper shows through. Every text pair clears
WCAG AA **as flattened** — body ink measures 11.08:1 against the ground in both
themes, secondary 7.48:1 on navy and 5.11:1 on powder — so nothing depends on
the blur landing. A browser without `backdrop-filter` loses the effect and
keeps every contrast ratio.

The blur lives on the panels, the overlays and the sidebar, and never on a task
row. `backdrop-filter` costs a fresh snapshot of everything behind the element
on every frame it changes; four of them is a look, five thousand of them is a
scroll at single-digit frames. The list is one pane with rows inside it.

The design's job is to make time visible.

The **time gutter** is the signature element: a fixed 64px column on the left,
set in tabular monospaced figures and right-aligned, so every digit stacks into a
vertical spine down the page. You read the day as a column of numbers before you
read a single word. It never changes width, and a task with no time shows an
em-dash on the same edge — the absence of a time is itself information. A time
that *is* set is the one number rendered in gilt, because it is the thing the
whole product is arranged around.

### The material

Surfaces are skeuomorphic, and consistently so. There is one light source, high
and slightly forward:

- **Raised** things — task lists, menus, dialogs, the toast — take a bright line
  along their top edge, a dark one along the bottom, a soft downward cast, and a
  gilt hairline across the top.
- **Pressed** things — the capture field, search, notes, the inline title editor
  — are wells cut *into* the page: a dark line inside the top edge, a light one
  along the bottom. Focus lights the recess with a gilt ring rather than drawing
  a rectangle over it.
- **Buttons and checkboxes** genuinely depress. On press the highlight and the
  shadow swap sides and the element shifts down a pixel. That swap is the whole
  trick; something that merely darkens on click reads as a picture of a button.
  An empty checkbox is a socket; a ticked one is a domed powder stud.
- A **fine grain** is fixed over the viewport at 5% opacity, so large areas of
  navy read as material rather than as a screen fill, and the page carries a
  soft radial pool of light above the capture field.

Getting the raised and pressed light directions backwards is what makes
skeuomorphism look cheap, so both are defined once, as tokens, in `globals.css`.

Three typefaces, all self-hosted, no CDN: **Zodiak** — a high-contrast didone —
for the wordmark, headings and empty states; **Switzer** for the interface; and
**Geist Mono** for the numerals.

### Overdue does not rely on colour

This palette is blue from end to end, so no single hue can own "late" — and
roughly one man in twelve cannot reliably separate the one warm mark in a cool
field anyway. Colour alone was never going to carry the state.

So lateness is carried four ways at once: a written label ("Yesterday", "3 days
ago"), a solid bar at the row's leading edge, the row tint, and its position at
the top of Today. The state stays legible in a greyscale screenshot.

### Where this departs from the specifications

- **The palette and the material are yours, not the frontend spec's.**
  `TODO_APP_FRONTEND_SPEC.md` prescribes a monochrome "ledger" with hairline
  rules, minimal shadow and a single reserved warm colour. Navy/powder plus
  glass replaces that deliberately. Everything the spec asked for
  *structurally* — the 64px gutter, tabular figures, the 16px capture field, the
  44px touch targets, reduced-motion, WCAG AA — is intact.
- **Contrast was recomputed from scratch,** against the *flattened* colour each
  translucent surface actually composites to rather than against the token, and
  both themes clear WCAG AA on every text and control pair. One consequence
  worth knowing: gilt is a deep steel (`#1D4E7A`) in the powder theme rather
  than powder itself, because powder on powder is invisible and the gutter time
  is text rather than ornament.
- **The theme identifiers are still `mahogany` and `porcelain`.** They are a
  persisted value in every existing browser, and renaming them would be a data
  migration dressed up as a colour change. Only the words the user reads follow
  the palette.
- **The overdue label** sits beside the title rather than replacing the time in
  the gutter. "3 days ago" is ten characters and the gutter is 64px; putting it
  there would have broken the one alignment the design is built on.
- **`isComplete` is not an IndexedDB index.** Booleans are not valid IndexedDB
  keys, so the compound index the architecture document specifies would have
  silently skipped every row rather than failing — which looks exactly like data
  loss. Completion is filtered in memory after an indexed lookup.

> **One trap worth knowing before editing styles.** Tailwind's `shadow-[…]`
> utility cannot carry these shadows. It decomposes its value in order to
> substitute a shadow colour, so a multi-layer shadow arriving as a single
> `var()` — or any `rgb(r g b / a)`, whose slash it reads as an opacity modifier
> — makes it emit *nothing at all*, silently. Every material shadow is therefore
> a plain CSS class in `globals.css` (`.panel`, `.well`, `.raised`, `.stud`,
> `.socket`, `.lifted`) rather than a utility.

---

## Your data

Everything lives in this browser, on this device. Nothing is sent anywhere;
there is no server to send it to, and no account, so nothing to breach.

The honest cost: anyone who uses this browser can read your tasks, and a browser
that clears its storage takes them with it. Tally asks for persistent storage on
first run, falls back to memory rather than crashing when storage is blocked,
says so plainly when that happens, and lets you export everything to a file at
any time.

---

## Not built, on purpose

Accounts, sync, sharing, reminders, calendar integration, tags, attachments,
and analytics dashboards. Each is a real decision with a real cost rather than
an oversight — see `TODO_APP_PRD.md` §10. Accounts and sync are the theme of
version two, and `TODO_APP_ARCHITECTURE.md` §7 already carries the PostgreSQL
schema and row-level-security policies they will need.

Recurrence is deliberately four frequencies and an off switch — no interval, no
end date, no "every third Tuesday". That is a scheduling language rather than a
field, and the moment it exists so does the question of what happens when you
edit occurrence four of eleven.
