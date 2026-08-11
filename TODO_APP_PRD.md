# Product Requirements Document
## Working title: **Tally** — a to-do web app for people who plan by time, not by list

| Field | Value |
|---|---|
| Document owner | Product |
| Status | Draft v1.0 — for build |
| Target release | v1.0 (MVP) |
| Build scope | Solo developer, ~2 week build window |
| Last updated | July 31, 2026 |

---

## 1. TL;DR

Tally is a browser-based task manager that lets a person capture a task in under three seconds, give it a date and time, organize it into lists, and check it off. It opens instantly, requires no account, and works offline.

The bet: most to-do apps fail not because they lack features, but because the cost of *entering* a task is higher than the cost of remembering it. Tally optimizes for the capture-to-completion loop and refuses to add anything that slows it down.

---

## 2. Problem statement

**The observable problem.** People maintain their tasks across a fragmented set of tools — phone notes, WhatsApp messages to themselves, sticky notes, memory. Tasks get lost between them. Deadlines are known but not surfaced at the moment they matter.

**Why existing tools don't solve it.** The two dominant categories both miss:

- **Heavyweight managers** (Notion, ClickUp, Todoist Pro) require setup before they deliver value — workspaces, projects, tags, filters. The user is doing configuration work before doing actual work. Abandonment happens in week one.
- **Bare note apps** (phone Notes, plain paper) have near-zero capture friction but no structure: no due dates, no completion state, no separation between "today" and "someday."

**The gap.** There is room for a tool with the capture friction of a notepad and the structure of a task manager — and nothing else.

**Evidence needed (honest gap in this doc).** This problem statement is currently reasoned, not researched. Before v1.1, run 8–10 short interviews with the target segment on how they currently track tasks. See §12, Open Questions.

---

## 3. Target user

### Primary persona — "The overloaded student-professional"

- Age 18–26, university student, early-career, or both simultaneously.
- Juggles 3–6 concurrent obligation streams: coursework, internship deliverables, personal projects, exams, life admin.
- Deadlines are time-specific, not just date-specific — a 6:00 PM submission is different from "Tuesday."
- Has tried Notion or Todoist and abandoned it. Reason given is usually some version of "too much."
- Uses a laptop for most focused work; phone for capture on the move.

**Jobs to be done**
1. When something lands on me, help me get it out of my head and into a trusted place *immediately*, so I stop carrying it.
2. When I sit down to work, show me what's due now so I don't have to decide what to decide.
3. Let me feel progress, so I keep coming back.

### Secondary persona — "The household organizer"
Manages recurring domestic and family logistics. Values lists (Groceries, Bills, Errands) over dates. Lower priority for v1 but the list model serves them without extra work.

### Explicit anti-personas — we are **not** building for:
- **Teams.** No shared workspaces, assignees, or permissions. This decision cascades through the entire architecture and is deliberate.
- **Project managers.** No dependencies, Gantt views, sprints, or estimation.
- **Power-user tinkerers** who want custom filters, saved queries, and plugin ecosystems. They are loud, they are a minority, and building for them destroys the product for the primary persona.

---

## 4. Goals and non-goals

### Product goals (v1)
| # | Goal | How we'd know |
|---|---|---|
| G1 | Capture must be effortless | Median time from page load to first task saved < 10s |
| G2 | The app must be trusted with real work | ≥ 60% of users who create 5+ tasks return within 7 days |
| G3 | Time-based tasks are first-class | ≥ 40% of created tasks carry a due date/time |
| G4 | Zero onboarding cost | No signup, no tutorial, usable within 5 seconds of first load |

### Non-goals (v1)
- Being feature-competitive with Todoist or TickTick.
- Multi-device sync (see §10 for why this is the hardest cut).
- Monetization. v1 has no pricing model and does not need one.

---

## 5. Feature requirements

Classified using MoSCoW. **Must** = MVP is broken without it. **Should** = high value, ships in v1.1 if time runs out. **Could** = nice-to-have, only if everything above is polished. **Won't** = explicitly out, see §10.

### 5.1 MUST HAVE (defines the MVP)

**M1 — Create a task**
- Single always-visible input field at the top of the task view.
- Enter key commits the task. No modal, no "New task" button required to begin typing.
- Minimum viable task = title only. Every other field is optional.
- *Acceptance:* typing text and pressing Enter creates a task and clears the input, with focus retained for the next entry.

**M2 — Set due date and time**
- Native date and time pickers, defaulted to empty.
- Date without time is valid (treated as end-of-day). Time without date is invalid — force a date.
- Overdue tasks are visually distinct (color + label).
- *Acceptance:* a task with a due timestamp in the past renders as overdue on next load.

**M3 — Mark complete / uncomplete**
- One click on a checkbox toggles state.
- Completed tasks do not vanish immediately — they render struck-through and dimmed in place for the session, then collapse into a "Completed" section. Instant disappearance breaks the sense of progress and makes accidental completion unrecoverable.
- *Acceptance:* toggling is reversible and persists across reload.

**M4 — Edit a task**
- Inline edit of title on double-click or edit icon. Date/time editable from the same row.
- Escape cancels, Enter or blur commits.
- *Acceptance:* no edit action requires navigating away from the task list.

**M5 — Delete a task**
- Delete with a short-lived undo affordance (toast, ~5s). No confirmation dialog — confirmation dialogs punish the 99% of intentional deletions to protect the 1%.
- *Acceptance:* deletion is undoable within the toast window; after that it is permanent.

**M6 — Lists**
- User can create, rename, and delete named lists (e.g. Uni, Internship, Personal).
- A default "Inbox" list exists and cannot be deleted — every task needs a home, and forcing list selection at capture time violates G1.
- Deleting a list prompts: move its tasks to Inbox, or delete them.
- Sidebar shows all lists with an open-task count.
- *Acceptance:* a task created without choosing a list lands in Inbox.

**M7 — Persistence**
- All data survives browser refresh and close. Local persistence (IndexedDB or localStorage) is sufficient for v1.
- *Acceptance:* full state restores on reload with no user action.

**M8 — Today view**
- A pinned view showing every task across all lists due today or overdue, sorted by time.
- This is the app's answer to "what do I do now" and is the single highest-leverage feature in the doc.
- *Acceptance:* Today is the default landing view when any task is due today; otherwise Inbox.

**M9 — Responsive layout**
- Fully usable at 360px width and above. Sidebar collapses to a drawer on mobile.
- *Acceptance:* no horizontal scroll and no unreachable controls at 360×640.

### 5.2 SHOULD HAVE

| ID | Feature | Rationale |
|---|---|---|
| S1 | Search across all tasks | Becomes essential past ~50 tasks; not before |
| S2 | Reorder tasks (drag or move up/down) | Manual priority is how the target user actually prioritizes |
| S3 | Three-level priority flag | Cheap to build, visible payoff in Today view sorting |
| S4 | Notes field on a task | Supports the "task with context" case without a second app |
| S5 | Keyboard shortcuts (`n` new, `/` search, `Esc` cancel) | Directly serves G1 for the power segment of the primary persona |
| S6 | Dark mode | Table stakes for this audience; low cost |
| S7 | Export data as JSON | Trust signal. Local-only storage without export feels like a hostage situation |

### 5.3 COULD HAVE

| ID | Feature | Note |
|---|---|---|
| C1 | Repeating tasks | Genuinely useful, but recurrence logic is a deceptively large surface — edit-this vs edit-all-future, DST, month-end. Not a v1 side quest |
| C2 | Subtasks (one level deep) | Adds hierarchy to the data model; defer until list usage validates the need |
| C3 | Browser notifications for due times | Requires permission prompt on first load, which conflicts with G4 |
| C4 | Simple weekly completion stat | Motivational, not functional |
| C5 | Tags | Overlaps with lists. Shipping both invites organizational paralysis |

---

## 6. User flows

### 6.1 First-run flow (cold start)
1. User loads the URL. No signup, no splash screen.
2. Lands on Inbox, empty state visible: a headline, the input field focused, and 2–3 greyed example tasks demonstrating what a task with a due time looks like.
3. User types a task title, presses Enter. Task appears.
4. Empty state is replaced permanently.

**Design constraint:** the user must be able to create their first task without reading anything. No tour, no tooltip sequence, no modal.

### 6.2 Core loop — capture
1. User clicks input (or presses `n`).
2. Types title → Enter → task saved to current list, input clears, focus retained.
3. *Optional branch:* before committing, user clicks the calendar icon → picks date, optionally time → Enter.

Every optional step is genuinely optional. No required field beyond title.

### 6.3 Core loop — triage and completion
1. User opens the app. If tasks are due today, Today view loads.
2. Tasks render sorted by due time; overdue items sit at top, marked.
3. User clicks a checkbox → task strikes through, list count decrements.
4. Completed items collapse into a "Completed" section at the bottom of the view.

### 6.4 Organize flow
1. User clicks "+ New list" in the sidebar → inline name input → Enter.
2. User moves a task via its row menu → "Move to…" → list picker.
3. Sidebar counts update immediately.

### 6.5 Edge cases and error states
| Case | Behavior |
|---|---|
| Empty title submitted | No-op. Do not create, do not error-message |
| Very long title (>200 chars) | Accept, truncate visually with expand-on-click |
| Due date set in the past | Allow. Immediately render as overdue. Do not block — backdating is a legitimate use |
| localStorage full or unavailable | Non-blocking banner: data won't persist this session. Offer JSON export |
| Deleting a list containing tasks | Modal with two explicit choices: move to Inbox, or delete all. Never silently orphan |
| Zero tasks in Today view | Positive empty state ("Nothing due today") — not an error tone |

---

## 7. Data model (v1)

```
List
  id          uuid
  name        string (1–40 chars)
  isDefault   boolean       // true only for Inbox
  order       integer
  createdAt   timestamp

Task
  id          uuid
  listId      uuid → List.id
  title       string (1–200 chars)
  notes       string | null           // S4
  dueAt       ISO-8601 | null         // null = no due date
  hasTime     boolean                 // false = date-only, treat as EOD
  priority    enum(none|low|med|high) // S3
  isComplete  boolean
  order       integer
  createdAt   timestamp
  updatedAt   timestamp
  completedAt timestamp | null
```

Notes for implementation:
- Store `dueAt` in UTC, render in the user's local timezone.
- `hasTime` avoids the common bug of a date-only task appearing as "12:00 AM."
- `order` is a float or gapped integer so reordering (S2) doesn't require rewriting every row.
- The schema is deliberately flat. No parent/child on Task — that door stays closed until C2 is justified.

---

## 8. MVP definition

**The MVP is M1 through M9. Nothing else.**

A one-sentence test for scope: *a user can capture a task with a due time, find it in Today, and check it off — and it's still there tomorrow.* If a feature isn't required for that sentence, it's below the line.

### Build sequence
| Phase | Contents | Est. |
|---|---|---|
| 1 | Data layer, persistence, task CRUD (M1, M3, M4, M5, M7) | 3–4 days |
| 2 | Lists and sidebar (M6) | 2 days |
| 3 | Due date/time and Today view (M2, M8) | 2–3 days |
| 4 | Responsive pass + empty states + polish (M9) | 2 days |
| 5 | Buffer / SHOULD-tier pickup in priority order (S6 → S5 → S2 → S7) | 2 days |

### Definition of done for v1
- All MUST acceptance criteria pass.
- Works on current Chrome, Firefox, Safari, and mobile Safari/Chrome.
- Usable at 360px width.
- No console errors on any core flow.
- Data survives a hard refresh and a browser restart.
- All interactive elements are keyboard-reachable with visible focus states; contrast meets WCAG AA.

---

## 9. Success metrics

**North Star: Weekly Active Completers** — unique users who complete at least one task in a 7-day window. It captures the full loop (capture *and* completion), which raw signups or task counts do not.

### Supporting metrics

| Layer | Metric | v1 target | Why |
|---|---|---|---|
| Activation | % of first-time visitors who create ≥1 task | 60% | Tests whether the empty state works |
| Activation | Time from load to first task created | < 10s median | Direct test of G1 |
| Engagement | % of tasks that get completed (not deleted, not abandoned) | > 50% | Low completion rate means tasks are being captured but not surfaced — a Today view failure |
| Engagement | % of created tasks carrying a due date | > 40% | Validates the core time-based bet (G3) |
| Retention | D7 return rate for users with 5+ tasks | > 60% | The only metric that indicates real trust |
| Retention | D30 return rate | > 25% | Habit formation |
| Quality | Undo rate on delete | < 10% | High rate means the delete affordance is mis-tuned |

### Counter-metrics (things that must NOT get worse)
- Median tasks per session should not fall as features are added. If it does, the app has gotten heavier.
- Time-to-first-task must never exceed 15s median.

**Instrumentation reality check.** With local-only storage and no accounts, "users" means browser sessions, and cross-device behavior is invisible. v1 should use privacy-respecting client analytics (Plausible or equivalent) plus a small set of custom events: `task_created`, `task_completed`, `task_deleted`, `list_created`, `due_date_set`. Treat all retention numbers as directional, not precise, until accounts exist.

---

## 10. Explicitly NOT building in v1

Each of these is a real decision with a real cost, not an oversight.

| # | Not building | Rationale |
|---|---|---|
| 1 | **User accounts and authentication** | Auth is the single largest scope item available and adds zero value to the core loop. It also directly violates G4. The cost is real: data is device-bound and clearing browser storage is destructive. We mitigate with a visible storage-location note and JSON export (S7) |
| 2 | **Cross-device sync** | The hardest and most-requested cut. Sync requires accounts, a backend, and conflict resolution. Deferred to v2 as the primary theme, not sprinkled in |
| 3 | **Collaboration / sharing / assignees** | This is a personal task manager. Adding a second user changes the product, the data model, and the permission surface. Permanently out of the v1 line |
| 4 | **Recurring tasks** | High demand, high complexity. See C1. Top candidate for v1.1 |
| 5 | **Native mobile apps** | Responsive web covers the mobile need at a fraction of the cost. Revisit only if mobile sessions exceed 50% and web friction is measurably hurting capture |
| 6 | **Notifications and reminders** | Requires permission prompts (conflicts with G4) and, for reliability, a backend and service workers. Ties to the sync workstream |
| 7 | **Calendar integration** | Depends on auth, OAuth flows, and third-party API maintenance |
| 8 | **AI features** (auto-prioritization, natural-language parsing, task suggestions) | Natural-language date parsing ("tomorrow 5pm") is the one genuinely compelling candidate and belongs in v1.1 as a capture-speed improvement — not as an "AI feature." Everything else in this category adds surface without serving the jobs in §3 |
| 9 | **Tags, filters, saved views** | Overlaps with lists. Two organizational systems means the user must decide which to use, every time |
| 10 | **Attachments and file uploads** | Requires storage infrastructure. Notes (S4) covers the underlying need |
| 11 | **Themes beyond light/dark, customization settings** | Settings pages are where scope goes to hide |
| 12 | **Analytics dashboards / productivity reports** | Measuring productivity is a different product from doing work |

---

## 11. Risks and assumptions

| Risk | Impact | Mitigation |
|---|---|---|
| Local-only storage causes real data loss | High — destroys trust permanently | Prominent one-time note on where data lives; JSON export (S7) promoted from SHOULD to MUST if user feedback confirms anxiety |
| Category is saturated; no reason to switch | High | Compete on capture speed and restraint, not feature count. Accept that v1's realistic audience is narrow |
| Scope creep from "it's just one small feature" | High | §10 is the contract. Additions require removing something of equal size |
| Timezone and DST bugs in due times | Medium | Store UTC, render local, use a tested date library. Do not hand-roll |
| Feature parity pressure in user feedback | Medium | Weight feedback by whether the requester is the primary persona |

**Assumptions requiring validation**
- That the primary persona genuinely wants *fewer* features rather than saying so and choosing otherwise.
- That time-of-day precision matters to this segment (G3 depends on it entirely).
- That no-account is read as "frictionless" rather than "untrustworthy."

---

## 12. Open questions

1. Does the target user actually set times, or only dates? If it's mostly dates, M2's time component and the Today sort logic get simpler — and the product's positioning weakens. **Resolve via interviews before v1.1.**
2. Is Inbox-by-default correct, or should the last-used list be the default target? Instrument and observe.
3. What's the right completed-task retention window? Indefinite storage will eventually degrade performance.
4. Should overdue tasks roll forward into Today automatically, or stay dated in the past? Currently specified as: stay dated, surface in Today. Worth testing.

---

## 13. Version roadmap (directional)

- **v1.0 — Capture and complete.** M1–M9. The doc above.
- **v1.1 — Speed and durability.** Natural-language date parsing, recurring tasks (C1), keyboard shortcuts (S5), JSON import/export.
- **v2.0 — Accounts and sync.** The full auth + backend workstream. Unlocks notifications and calendar integration. Single-theme release.
- **v3.0 —** Deliberately unplanned. Determined by what v2 users actually do.
