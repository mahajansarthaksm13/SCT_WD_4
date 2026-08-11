# Frontend Specification & Design System
## Tally — To-Do Web App

| Field | Value |
|---|---|
| Document type | Frontend Spec / Design System |
| Status | v1.1 — as built |
| Companion docs | `TODO_APP_PRD.md`, `TODO_APP_ARCHITECTURE.md`, `TODO_APP_SECURITY.md` |
| Implementation | `tally/` — see its README for build and test commands |
| Last updated | August 5, 2026 |

> **This revision describes what shipped.** The original v1.0 specified a
> monochrome "ledger" — hairline rules, minimal shadow, and a single reserved
> warm colour. That was replaced by the mahogany/porcelain palette and a
> skeuomorphic material system. Everything structural survived unchanged: the
> 64px time gutter, tabular figures, the 16px capture field, 44px touch
> targets, reduced-motion, and WCAG AA. Sections 1, 2, 3.1, 4.2, 9 and 10 have
> been rewritten; the rest stands as written.

---

## 1. Design thesis

**The product's promise is that you can see what's due at a glance. The design's job is to make time visible.**

Most to-do apps treat the due time as metadata — a small grey chip pushed to the right edge of a row, different width on every line, impossible to scan. Tally inverts that. Time gets a fixed column on the *left*, set in tabular monospaced figures, right-aligned so every digit stacks into a vertical spine down the page. You read the day as a column of numbers before you read a single word.

That column is the **signature element**. It is the whole design.

**The aesthetic direction is lacquered mahogany and porcelain** — the calm of a good desk rather than the urgency of a productivity dashboard. Deep polished wood, warm parchment, and gilding used the way real gilding is: a hairline, an edge, never a fill.

**Surfaces are skeuomorphic, and consistently so.** There is one light source, high and slightly forward. Raised things catch a highlight along their top edge and cast downward; pressed things take a dark line inside their top edge and a light one along the bottom; buttons genuinely depress. Getting those two directions backwards is what makes skeuomorphism look cheap, so both are defined once as tokens and never improvised.

**The risk being taken:** the palette is warm from end to end, which means no single hue can own "late". Overdue is therefore never signalled by colour alone — see §2.3. The cost is that lateness needs four cues instead of one. That is the correct trade for something a person opens eleven times a day.

---

## 2. Colour

### 2.1 The four colours

| Hex | Name | Job |
|---|---|---|
| `#761A02` | mahogany | Lacquered wood. The interactive colour in daylight; the plate a selected list sits on at night. |
| `#FBF0F6` | porcelain | The page, and the ink written on dark grounds. |
| `#5F5554` | stone | Secondary text. A warm grey that sits beneath the browns without introducing a fifth hue. |
| `#E6CBB8` | vellum | Warm parchment. The gilt at night; the tone the wells are cut into by day. |

### 2.2 Mahogany — the default ground

| Token | Hex | Role |
|---|---|---|
| `--color-paper` | `#241310` | App background |
| `--color-surface` | `#331C17` | Raised panels: task lists, menus, dialogs |
| `--color-surface-sunk` | `#170B09` | Wells: inputs, notes, the sidebar ground |
| `--color-ink` | `#FBF0F6` | Primary text |
| `--color-ink-2` | `#D3C3BF` | Secondary text |
| `--color-ink-3` | `#A9958F` | Placeholders, the em-dash, counts |
| `--color-rule` | `#4A2B23` | Hairline dividers — decorative, exempt from the contrast floor |
| `--color-rule-strong` | `#8E655A` | Control borders — must clear 3:1 |
| `--color-accent` | `#E6CBB8` | Buttons, checked boxes |
| `--color-accent-hover` | `#F4DFD0` | Accent hover |
| `--color-accent-soft` | `#761A02` | The selected-list plate. Mahogany itself. |
| `--color-on-accent` | `#2A1410` | Text on the accent |
| `--color-gilt` | `#E6CBB8` | Gilding, focus rings, a set time |
| `--color-overdue` | `#FF8A6B` | Overdue text and marker |
| `--color-overdue-soft` | `#4A1C12` | Overdue row tint |

### 2.3 Porcelain — the daylight version

Not an inversion. Mahogany becomes the ink, porcelain becomes the paper, and the light model softens: paper scatters light, so its shadows are warm, wide and shallow.

| Token | Hex |
|---|---|
| `--color-paper` | `#FBF0F6` |
| `--color-surface` | `#FFFAFC` |
| `--color-surface-sunk` | `#F2E3D7` |
| `--color-ink` | `#2E1A16` |
| `--color-ink-2` | `#5F5554` |
| `--color-ink-3` | `#6E605E` |
| `--color-rule` | `#ECDDE1` |
| `--color-rule-strong` | `#91796F` |
| `--color-accent` | `#761A02` |
| `--color-accent-hover` | `#5C1401` |
| `--color-accent-soft` | `#E6CBB8` |
| `--color-on-accent` | `#FBF0F6` |
| `--color-gilt` | `#8A5A22` |
| `--color-overdue` | `#B3231A` |
| `--color-overdue-soft` | `#FAE0DA` |

Two values differ from their mahogany counterparts for measured reasons rather than taste. **Gilt is a deep bronze**, because vellum on cream measures 3.2:1 and the gutter time is text, not ornament. **`--color-surface-sunk` is vellum lightened**, because secondary text on full-strength vellum also fails; full-strength vellum is reserved for surfaces carrying nothing but `--color-ink`.

### 2.4 Rules of use

1. **Overdue is never signalled by colour alone.** The palette is warm throughout, and measured, overdue and the accent sit only 1.5:1 apart in luminance. An overdue task therefore carries four cues at once: a written label ("Yesterday", "3 days ago"), a solid bar at its leading edge, the row tint, and its position at the top of Today. This is a hard accessibility requirement, not a preference — roughly one man in twelve cannot pick a warm hue out of a warm field.
2. **Gilt is a hairline, an edge, or a number. Never a fill.** The moment gold becomes a background it stops reading as gilding and starts reading as a highlighter.
3. **Lists have no colours.** Colour-coded lists would compete with the overdue signal and turn the sidebar into a distraction.
4. **Contrast floor: every text and control pair meets WCAG AA in both themes** — 4.5:1 for body text, 3:1 for control borders and large text. This is verified by measurement, not by eye; the lowest passing pair is 3.15:1 (mahogany) and 3.24:1 (porcelain), both control borders.

---

## 3. Typography

### 3.1 Families

**Three families.**

| Role | Family | Source | Why |
|---|---|---|---|
| Display | **Zodiak** | Fontshare, free commercial | A high-contrast didone, used only for the wordmark, view headings and empty states. Thick-to-thin strokes are the oldest visual signal of engraved, expensive printing, and one weight carries it. |
| Interface | **Switzer** | Fontshare (Indian Type Foundry), free commercial | A Swiss grotesque with softer terminals and a taller x-height than Helvetica. Reads cleanly at 13–15px, which is where 95% of this interface lives. Chosen specifically to avoid Inter, which now signals "default" more than it signals anything. |
| Numerals & time | **Geist Mono** | Vercel, MIT | True tabular figures with an unambiguous `1`/`7`/`0`. Every digit occupies identical width, which is what makes the time gutter align into a spine. |

> The earlier revision of this document specified two families and argued against a third on the grounds that a to-do app has almost no large type. That reasoning held for the monochrome ledger it described. The current direction is a *material* one, and a display serif is the single highest-leverage element in it — it is what makes the wordmark read as pressed into the surface rather than set on top of it. It is one weight, subset to Latin, and costs 22 KB.

> **For the builder:** self-host all three. Do not use the Google Fonts CDN — it costs a third-party connection on first paint, complicates your Content Security Policy, and leaks visitor IPs to a third party. `next/font` handles this: `next/font/local` for the Fontshare faces, `next/font/google` for Geist Mono, which it downloads at build time and serves from your own origin.

### 3.2 Scale

| Token | Size / line-height | Weight | Tracking | Used for |
|---|---|---|---|---|
| `--t-display` | 28px / 34px | 600 | -0.02em | Empty-state headline only |
| `--t-title` | 20px / 28px | 600 | -0.01em | View heading ("Today", list name) |
| `--t-input` | 16px / 24px | 400 | 0 | The capture field. **Must be ≥16px** |
| `--t-body` | 15px / 22px | 400 | 0 | Task titles, notes, general text |
| `--t-body-strong` | 15px / 22px | 500 | 0 | Sidebar list names |
| `--t-meta` | 13px / 18px | 400 | 0 | Counts, secondary info, dialog body |
| `--t-mono` | 13px / 18px | 450 | 0.01em | **The time gutter.** `font-variant-numeric: tabular-nums` |
| `--t-label` | 11px / 14px | 550 | 0.07em | Section labels ("Completed", "Overdue"), uppercase |

> **The 16px input rule is not stylistic.** iOS Safari automatically zooms the viewport when a user focuses an input with a font size below 16px, and doesn't zoom back out. It is the single most common mobile polish bug, and it directly damages your PRD's sub-10-second capture goal.

### 3.3 Other type rules

- Sentence case everywhere except `--t-label`. No Title Case On Buttons.
- Task titles wrap to a maximum of two lines, then truncate with an ellipsis. Full text on hover and on expand.
- Completed titles: `line-through` with `text-decoration-color: var(--ink-3)` and `opacity: 0.55`. Struck-through text at full contrast is unpleasant to read past.
- Never justify. Never letter-space body text.

---

## 4. Spacing and layout

### 4.1 Spacing scale

4px base. Use tokens, never arbitrary pixel values.

| Token | Value | Typical use |
|---|---|---|
| `--sp-1` | 4px | Icon-to-label gap |
| `--sp-2` | 8px | Inside small controls |
| `--sp-3` | 12px | Row internal padding |
| `--sp-4` | 16px | Card padding, standard element gap |
| `--sp-5` | 24px | Between component groups |
| `--sp-6` | 32px | Section separation |
| `--sp-7` | 48px | Above/below major sections |
| `--sp-8` | 64px | Empty-state vertical padding |

### 4.2 Radius, borders, and the material

| Token | Value | Applied to |
|---|---|---|
| `--radius-sm` | 7px | Checkboxes, small chips |
| `--radius-md` | 10px | Buttons, inputs, task rows |
| `--radius-lg` | 14px | Cards, popovers, panels |
| `--radius-xl` | 20px | Modals, mobile drawer |

Borders are `1px solid`. **Never thicker than 1px** — heavier borders fight the hairline character.

**The light model.** One source, high and slightly forward. Everything follows from it:

| Token | What it describes |
|---|---|
| `--shadow-raise` | A panel sitting on the page: lit top edge, dark bottom edge, soft downward cast |
| `--shadow-lift` | A panel further off it — dialogs, menus, the toast |
| `--shadow-well` | Something pressed *into* the page: dark line inside the top, light along the bottom |
| `--shadow-button` / `--shadow-button-press` | A pressable face, and the same face held down. On press the highlight and shadow swap sides and the element shifts down 1px |
| `--shadow-stud` / `--shadow-socket` | A checked box (domed) and an empty one (recessed) |
| `--sheen` / `--sheen-button` | The curve of light across a raised surface |
| `--gilt-line` | The hairline that catches the light across a panel's top edge |

These are applied through plain CSS classes — `.panel`, `.well`, `.raised`, `.stud`, `.socket`, `.lifted`, `.gilded` — not Tailwind utilities.

> **This is not a style preference; it is a constraint.** Tailwind's `shadow-[…]` utility decomposes its value in order to substitute a shadow colour. A multi-layer shadow arriving as a single `var()` defeats that, and so does any `rgb(r g b / a)`, whose slash Tailwind reads as an opacity modifier. In both cases it emits **nothing at all**, silently, with a clean build and clean lint. Every material shadow in this system was rendering flat until it was moved out of the utility layer.

A **fine grain** is fixed over the viewport at 5% opacity with `mix-blend-mode: overlay`, so large areas of mahogany read as material rather than as a screen fill. The page also carries a soft radial pool of light above the capture field.

### 4.3 Layout structure

```
Desktop ≥1024px
┌────────────────┬──────────────────────────────────────────┐
│                │                                          │
│   SIDEBAR      │   ┌──────────────────────────────────┐   │
│   260px        │   │  Today                      12   │   │
│   fixed        │   ├──────────────────────────────────┤   │
│                │   │  ┌ + Add a task ───────────────┐ │   │
│  ▸ Today   12  │   │  └───────────────────────────── ┘ │   │
│  ▸ Inbox    4  │   │                                  │   │
│                │   │  OVERDUE                         │   │
│  LISTS         │   │  Yesterday □ Submit lab report   │   │
│  ▸ Uni      7  │   │  ────────────────────────────── │   │
│  ▸ Work     3  │   │  09:00  □ Standup notes          │   │
│  ▸ Personal 2  │   │  11:30  □ Review PR #214         │   │
│                │   │  18:00  □ Assignment deadline    │   │
│  + New list    │   │     —   □ Renew library books    │   │
│                │   │  └┬─┘                            │   │
│                │   │   │ time gutter, 64px            │   │
│                │   │   │ tabular, right-aligned       │   │
│                │   └──────────────────────────────────┘   │
│                │              max-width 720px, centred    │
└────────────────┴──────────────────────────────────────────┘
```

**Content max-width is 720px.** Task titles are short; a full-width list forces long eye travel between the checkbox and the text and makes scanning worse, not better.

**The time gutter is 64px fixed.** It never grows or shrinks. Tasks with no time show an em-dash in `--ink-3`, right-aligned to the same edge — the absence of a time is itself information, and keeping the column intact preserves the spine.

### 4.4 Breakpoints

Mobile-first. Only three.

| Name | Min-width | Change |
|---|---|---|
| base | 0 | Single column. Sidebar becomes a slide-in drawer. Time gutter narrows to 52px. Row height 48px |
| `md` | 768px | Content gains horizontal padding. Row height 44px |
| `lg` | 1024px | Sidebar becomes permanent at 260px. Row height 40px |

Must work at 360px width with no horizontal scroll.

---

## 5. Component specifications

### 5.1 Button

Three variants. Resist adding a fourth.

| Variant | Background | Text | Border | Used for |
|---|---|---|---|---|
| **Primary** | `--accent` | `#FFFFFF` | none | The one main action in a view. Maximum one visible at a time |
| **Secondary** | `--surface` | `--ink` | `1px --rule-strong` | Cancel, secondary dialog actions |
| **Ghost** | transparent | `--ink-2` | none | Row actions, icon buttons, toolbar controls |

**Sizes**

| Size | Height | Padding X | Type |
|---|---|---|---|
| `sm` | 32px | 12px | `--t-meta` |
| `md` (default) | 40px | 16px | `--t-body` 500 |
| `lg` | 48px | 20px | `--t-body` 500 |

**States**

| State | Treatment |
|---|---|
| Hover | Primary → `--accent-hover`. Secondary/Ghost → background `--surface-sunk` |
| Active | `transform: scale(0.98)`, 80ms |
| Focus-visible | `outline: 2px solid var(--accent); outline-offset: 2px` — **never removed** |
| Disabled | `opacity: 0.45; cursor: not-allowed`. Never a spinner without a label |
| Loading | Label stays, small spinner replaces the leading icon slot. Width does not change — reflow on click is disorienting |

```css
.btn {
  display: inline-flex; align-items: center; gap: var(--sp-2);
  height: 40px; padding: 0 var(--sp-4);
  border-radius: var(--r-md);
  font: 500 var(--t-body) 'Switzer', system-ui, sans-serif;
  border: 1px solid transparent;
  transition: background-color 120ms ease, transform 80ms ease;
  cursor: pointer;
}
.btn--primary   { background: var(--accent); color: #fff; }
.btn--primary:hover { background: var(--accent-hover); }
.btn--secondary { background: var(--surface); color: var(--ink); border-color: var(--rule-strong); }
.btn--ghost     { background: transparent; color: var(--ink-2); }
.btn--ghost:hover, .btn--secondary:hover { background: var(--surface-sunk); }
.btn:active:not(:disabled) { transform: scale(0.98); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
```

**Copy rules.** Buttons say what happens: "Save changes", not "Submit". "Delete list", not "OK". The verb on the button matches the verb in the resulting confirmation — a button that says "Delete list" produces a toast that says "List deleted".

### 5.2 Input

**The capture field** is the most important component in the product. It gets its own treatment.

```css
.capture {
  width: 100%;
  height: 52px;                        /* taller than a normal input — it's the hero */
  padding: 0 var(--sp-4) 0 var(--sp-5);
  background: var(--surface);
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-md);
  font: 400 var(--t-input) 'Switzer', system-ui, sans-serif;   /* 16px — see §3.2 */
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.capture::placeholder { color: var(--ink-3); }
.capture:focus {
  outline: none;                                  /* replaced, not removed */
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
```

Placeholder copy: **"Add a task"**. Not "What needs to be done?" — a question demands an answer and adds a beat of thinking. An instruction doesn't.

**Standard inputs** (list name, notes, search) are 40px tall, `--t-body`, otherwise identical in state treatment.

**Inline edit** — the task title editing state — has no visible input chrome at all. Background `--surface-sunk`, no border, `--r-sm`, cursor placed at click position. It should read as the text becoming editable, not as a form appearing. Enter or blur commits; Escape reverts.

**Validation.** Errors appear *below* the field in `--t-meta` at `--ink-2`, with the field border at `--rule-strong` — **not crimson**. Crimson is reserved (§2.3). A validation message is not an emergency; write it as direction: "List names are limited to 40 characters."

### 5.3 Task row — the signature component

```
┌──────────────────────────────────────────────────────┐
│  18:00   ☐   Assignment deadline              ⋯      │
│ └─ 64 ─┘ 20   flex: 1                        24      │
└──────────────────────────────────────────────────────┘
```

| Property | Value |
|---|---|
| Height | 40px desktop / 44px tablet / 48px mobile (min touch target) |
| Background | `--surface` |
| Separator | `1px solid var(--rule)` between rows, not around them |
| Radius | `--r-md`, applied on hover only |
| Hover | Background `--surface-sunk`, `--shadow-sm`, action menu fades in over 120ms |
| Gutter | 64px, `--t-mono`, `tabular-nums`, right-aligned, `--ink-2` |
| No due time | Em-dash `—` in `--ink-3`, same alignment |
| Overdue | Gutter text `--overdue`; row background `--overdue-soft`; relative label ("Yesterday", "3 days ago") replaces the clock time |
| Completed | Title `line-through`, `opacity: 0.55`, gutter drops to `--ink-3` |

**Checkbox.** 20×20px, `--r-sm`, `1.5px solid var(--rule-strong)`. On check: fills `--accent`, white tick draws in over 180ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`. The row then holds in place for 400ms before drifting into the Completed section — instant disappearance removes the moment of satisfaction, which your PRD names as a retention driver.

**Actions.** A single `⋯` ghost button opening a dropdown: Edit, Set date, Move to list, Delete. Hidden until row hover on desktop; always visible on touch, where hover doesn't exist.

### 5.4 Card

Used for the Today panel, dialogs, and the empty state container.

```css
.card {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-lg);
  padding: var(--sp-4);
}
```

No shadow at rest. Cards are defined by their rule, not their elevation — this is the ledger direction being consistent. Only interactive cards (hoverable rows) gain `--shadow-sm`.

### 5.5 Modal / dialog

Used for exactly two things: deleting a list, and confirming account deletion in v2. Every other action is inline or a dropdown. **A dialog is an interruption; earn it.**

| Property | Value |
|---|---|
| Overlay | `rgba(16, 22, 20, 0.4)`, `backdrop-filter: blur(2px)` |
| Container | `--surface`, `--r-xl`, `--shadow-lg`, `max-width: 440px`, padding `--sp-5` |
| Title | `--t-title`, `--ink` |
| Body | `--t-meta`, `--ink-2`, `max-width: 40ch` |
| Actions | Right-aligned, `--sp-2` gap. Secondary left, primary right |
| Mobile | Bottom sheet: full width, `--r-xl` top corners only, slides up 240ms |
| Entry | Overlay fades 150ms; container fades + `scale(0.96 → 1)` over 180ms |

**Behaviour requirements** — these are correctness, not polish:
- Focus moves to the dialog on open and is **trapped** inside it.
- Escape closes. Overlay click closes. Neither performs the destructive action.
- Focus returns to the triggering element on close.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the title.
- Body scroll locked while open.

> Use Radix UI's `Dialog` primitive rather than building this. Focus trapping and scroll locking are deceptively hard and every hand-rolled version has bugs.

### 5.6 Toast

The undo affordance for deletes. Bottom-centre desktop, bottom-full-width mobile, 16px from the edge.

`--surface`, `--r-md`, `--shadow-md`, `--sp-3` padding, `--t-meta`. Message on the left, a ghost "Undo" button on the right. Auto-dismisses after **5 seconds** with a hairline progress rule in `--accent` draining along the bottom edge. Hovering pauses the timer.

Maximum one toast at a time. Message format: "Task deleted" — past tense, matching the verb used on the action.

### 5.7 Empty states

Not decoration. An empty screen is an invitation to act.

| Context | Headline (`--t-display`) | Body (`--t-meta`, `--ink-2`) |
|---|---|---|
| First run | Start with one thing | Type it above and press Enter. Add a time if it has a deadline. |
| Today, nothing due | Nothing due today | Anything without a date is waiting in Inbox. |
| Empty list | This list is empty | Add your first task above. |
| Search, no results | No tasks match "*query*" | Try a shorter search. |

No illustrations, no icons, no mascot. The ledger direction is quiet; a cartoon here would break it. Centre the block vertically with `--sp-8` above and below.

---

## 6. Motion

| Interaction | Duration | Easing |
|---|---|---|
| Hover / colour change | 120ms | `ease` |
| Button press | 80ms | `ease-out` |
| Checkbox tick | 180ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| Row settle before moving to Completed | 400ms hold | — |
| Dropdown / popover | 140ms | `ease-out` |
| Modal | 180ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Mobile drawer / sheet | 240ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Toast in / out | 200ms / 150ms | `ease-out` / `ease-in` |

**Nothing animates on page load.** Your PRD targets sub-10-second first capture; an entrance animation is time spent watching instead of typing.

**Reduced motion is mandatory:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 7. Accessibility floor

Non-negotiable before launch:

- Every interactive element reachable by Tab, in visual order.
- `:focus-visible` styles on everything. Never `outline: none` without a replacement.
- Checkboxes are real `<input type="checkbox">` with associated labels — not styled `<div>`s.
- Task list is a `<ul>`/`<li>`; the sidebar is `<nav>`.
- Count badges include screen-reader text: `<span class="sr-only">12 open tasks</span>`.
- Live regions (`aria-live="polite"`) announce completion and deletion.
- Minimum 44×44px touch targets on mobile.
- All text meets WCAG AA contrast.
- Test the entire core loop — create, set time, complete, delete, undo — using only the keyboard. If you can't, it isn't done.

---

## 8. Third-party services and integration spec

### 8.1 Honest inventory

Version 1 of Tally makes **zero third-party API calls at runtime**, apart from one optional analytics ping. There is no backend, no auth provider, no external data source. Fonts are self-hosted. This is the direct consequence of the local-first architecture, and it is worth stating plainly rather than padding this section with services you don't use.

| Service | Version | Runtime API calls? | Purpose |
|---|---|---|---|
| Vercel *or* Netlify | v1 | No | Static hosting, CDN, HTTPS, preview deploys |
| Plausible Analytics | v1, optional | Yes — 1 endpoint | Privacy-respecting usage metrics |
| Supabase Auth | v2 | Yes | Passwordless login |
| Supabase PostgREST | v2 | Yes | Database read/write |
| Supabase Realtime | v2, optional | WebSocket | Cross-device live sync |
| Resend *or* Postmark | v2 | No (configured inside Supabase) | Delivering login emails |
| Sentry | v2, optional | Yes | Error monitoring |

---

### 8.2 Hosting — Vercel / Netlify

**What it does.** Builds the app from your git repository and serves the resulting static files from a CDN. No runtime API; everything is build-time configuration.

**Configuration**

```jsonc
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Content-Security-Policy",
        "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://plausible.io https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'" }
    ]
  }]
}
```

The `rewrites` block is required. Without it, refreshing on any route returns a 404 — the classic single-page-app deployment bug.

---

### 8.3 Plausible Analytics

**What it does.** Counts page views and custom events without cookies, without cross-site tracking, and without collecting personal data. Chosen over Google Analytics because it needs no consent banner under most privacy regimes and doesn't undermine the privacy position established in your security document.

**Endpoint**

```
POST https://plausible.io/api/event
Content-Type: application/json
```

**Request**
```json
{
  "name": "task_created",
  "url": "https://tally.app/today",
  "domain": "tally.app",
  "props": {
    "has_due_date": "true",
    "has_time": "true",
    "list_type": "custom"
  }
}
```

**Response**
```
202 Accepted
(empty body)
```

**Events to send — and only these**

| Event | Props | Answers |
|---|---|---|
| `task_created` | `has_due_date`, `has_time`, `list_type` | PRD metric G3 — do people use times? |
| `task_completed` | `was_overdue` | Completion rate |
| `task_deleted` | `was_undone` | Is the delete affordance mis-tuned? |
| `list_created` | — | Is list organisation used at all? |
| `data_exported` | — | Does the safety valve get used? |

**Critical rule: never send task content.** No titles, no notes, no list names. Send `list_type: "custom"`, never `list_name: "Therapy appointments"`. Props are strings only; keep them to a fixed, enumerable set.

> **For the builder:** wrap this in `src/lib/analytics.ts` and make it a no-op when `VITE_ANALYTICS_DOMAIN` is unset, so development never pollutes production data. Never block the UI on the response, and never surface an analytics failure to the user — a dropped metric is not an error worth a person's attention.

---

### 8.4 Supabase Auth (v2)

**What it does.** Handles passwordless email login, issues and refreshes session tokens, and provides the `auth.uid()` value that every Row Level Security policy depends on.

Base URL: `https://{PROJECT_REF}.supabase.co`

#### Request a login link

```
POST /auth/v1/otp
apikey: {ANON_KEY}
Content-Type: application/json
```
```json
{
  "email": "user@example.com",
  "options": {
    "emailRedirectTo": "https://tally.app/auth/callback",
    "shouldCreateUser": true
  }
}
```

**Success — `200 OK`**
```json
{ "data": {}, "error": null }
```

The response is deliberately empty. It is **identical whether or not the email is registered**, which is what prevents your login form from being used to discover who has an account. Do not add anything to your UI that changes based on this.

#### Exchange the code for a session

The user clicks the link and returns to `/auth/callback?code=...`.

```
POST /auth/v1/token?grant_type=pkce
Content-Type: application/json
```
```json
{ "auth_code": "3f9a2b...", "code_verifier": "<stored in sessionStorage>" }
```

**Success — `200 OK`**
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "v1.M2Y5YTJi...",
  "user": {
    "id": "8f1c3d5e-0a2b-4c6d-9e8f-1a2b3c4d5e6f",
    "email": "user@example.com",
    "created_at": "2026-07-31T09:14:22.481Z"
  }
}
```

`user.id` is the value that appears as `auth.uid()` in your RLS policies and as `user_id` on every row.

#### Refresh, and sign out

```
POST /auth/v1/token?grant_type=refresh_token
{ "refresh_token": "v1.M2Y5YTJi..." }
```
```
POST /auth/v1/logout
Authorization: Bearer {ACCESS_TOKEN}
→ 204 No Content
```

#### Error responses

| Status | Body `error_code` | Cause | What the UI shows |
|---|---|---|---|
| 400 | `otp_expired` | Link older than 15 minutes | "That link has expired for security. Here's a fresh one." |
| 400 | `invalid_grant` | Link already used, or wrong verifier | *Identical message to expired* — deliberately indistinguishable |
| 422 | `validation_failed` | Malformed email | "That email doesn't look right." |
| 429 | `over_email_send_rate_limit` | Too many requests | "Too many login requests. Try again in a few minutes." |
| 401 | — | Expired access token | Refresh silently. Only sign the user out if the refresh also fails |

> In practice use `supabase.auth.signInWithOtp()` and `onAuthStateChange()` from the JS client rather than calling these by hand. The raw endpoints are documented here so you can read network traffic when something misbehaves.

---

### 8.5 Supabase PostgREST (v2)

**What it does.** Exposes your Postgres tables as a REST API. Row Level Security is enforced on every request, so the API surface is safe to call directly from the browser.

**Headers on every request**
```
apikey: {ANON_KEY}
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
Prefer: return=representation
```

Both headers are required. `apikey` identifies the project; `Authorization` identifies the user and is what populates `auth.uid()`. Omit the second and RLS sees an anonymous caller and returns nothing.

#### Fetch open tasks in a list

```
GET /rest/v1/tasks
  ?select=id,title,due_at,has_time,priority,is_complete,position
  &list_id=eq.7c2e...&is_complete=eq.false&deleted_at=is.null
  &order=position.asc
```

**`200 OK`**
```json
[
  {
    "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "title": "Submit lab report",
    "due_at": "2026-07-31T12:30:00+00:00",
    "has_time": true,
    "priority": "high",
    "is_complete": false,
    "position": 1000
  }
]
```

#### Fetch the Today view

```
GET /rest/v1/tasks
  ?select=*&is_complete=eq.false&deleted_at=is.null
  &due_at=lt.2026-07-31T18:30:00Z
  &order=due_at.asc
```

The upper bound is **local** end-of-day converted to UTC — computed by `todayRangeUTC()` from your architecture document, never hardcoded to UTC midnight.

#### Create a task

```
POST /rest/v1/tasks
```
```json
{
  "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  "user_id": "8f1c3d5e-0a2b-4c6d-9e8f-1a2b3c4d5e6f",
  "list_id": "7c2e1a9b-4d3f-4e2a-8b1c-5d6e7f8a9b0c",
  "title": "Renew library books",
  "due_at": null,
  "has_time": false,
  "priority": "none",
  "position": 3000
}
```

**`201 Created`** returns the full row (because of `Prefer: return=representation`).

Note the client-generated `id` — this is what allows the task to exist offline before it ever reaches the server.

#### Update, and soft-delete

```
PATCH /rest/v1/tasks?id=eq.a1b2c3d4-...
{ "is_complete": true, "completed_at": "2026-07-31T11:02:44Z" }
→ 200 OK, array containing the updated row
```
```
PATCH /rest/v1/tasks?id=eq.a1b2c3d4-...
{ "deleted_at": "2026-07-31T11:05:12Z" }
→ 200 OK
```

Deletion is a `PATCH`, not a `DELETE` — the tombstone is what lets other devices learn the task is gone.

#### Errors and what they mean

| Status | Postgres code | Meaning | UI response |
|---|---|---|---|
| 200 + `[]` | — | **RLS denied a read.** Forbidden rows are invisible, not rejected | Treat as "not found." Log it — this should be near-impossible |
| 401 | `PGRST301` | Missing or expired token | Refresh, then retry once |
| 403 | `42501` | RLS `with check` rejected a write — attempted write to another user's data | "You don't have access to that." **Log loudly** (see security doc §8) |
| 400 | `23514` | Check constraint failed — e.g. `has_time` true with no `due_at` | This is a client bug. Log it; show a generic message |
| 409 | `23505` | Unique violation — e.g. a second default Inbox | Recover silently if possible |
| 409 | `23503` | Foreign key violation — list doesn't exist or isn't yours | Refetch lists; the local state is stale |
| 5xx | — | Supabase unavailable | Fall back to local storage. "Your changes are saved on this device." |

The first row is the one that catches people out. A read blocked by RLS returns **`200 OK` with an empty array**, not a `403`. Code that only checks `response.ok` will treat a permission failure as "no results," which is correct behaviour for the user and invisible in your logs unless you check explicitly.

---

### 8.6 Supabase Realtime (v2, optional)

WebSocket to `wss://{PROJECT_REF}.supabase.co/realtime/v1/websocket`, subscribing to Postgres changes on `tasks` and `lists` filtered by `user_id`.

```ts
supabase.channel('tasks')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
      payload => store.applyRemoteChange(payload))
  .subscribe();
```

Payload shape: `{ eventType: 'INSERT'|'UPDATE'|'DELETE', new: {...}, old: {...} }`.

**Defer this.** Sync-on-focus plus sync-on-interval covers the realistic case — one person, two devices, rarely both open at once — for a fraction of the complexity. Add Realtime only if users report staleness.

---

### 8.7 Email delivery — Resend or Postmark (v2)

**What it does.** Delivers login emails. Your app never calls it directly; you configure it as Supabase's custom SMTP provider.

**Why you must configure it.** Supabase's built-in email sender is rate-limited to a handful of messages per hour and is intended for development only. On the default sender, your login emails will silently stop arriving the moment you have real users — and because your interface deliberately can't tell the user whether the send succeeded (§8.4), the failure is invisible from both sides. This is the most likely way v2 breaks on launch day.

**Setup:** Supabase Dashboard → Authentication → SMTP Settings. Add your provider's SMTP host, port 587, and API key as the password. Verify your sending domain with SPF, DKIM, and DMARC records — unverified domains land in spam, which produces exactly the same symptom as no email at all.

---

### 8.8 Sentry (v2, optional)

`POST https://o{ORG}.ingest.sentry.io/api/{PROJECT}/envelope/`, handled by the SDK.

**Configure aggressively for privacy**, since error reports otherwise capture form contents:
```ts
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  sendDefaultPii: false,
  beforeSend(event) {
    delete event.request?.data;      // never ship task content
    return event;
  },
  tracesSampleRate: 0.1,
});
```

---

## 9. Token reference

Tokens live in `src/app/globals.css`. Colours sit in a Tailwind `@theme static` block — `static` matters, because Tailwind only emits theme variables it can see a utility using, and several here are referenced from hand-written CSS it cannot see. Without it `--font-ui` and friends silently resolve to nothing and the page falls back to the system font stack.

```css
@theme static {
  /* Mahogany — the default ground */
  --color-paper: #241310;      --color-surface: #331C17;   --color-surface-sunk: #170B09;
  --color-ink: #FBF0F6;        --color-ink-2: #D3C3BF;     --color-ink-3: #A9958F;
  --color-rule: #4A2B23;       --color-rule-strong: #8E655A;
  --color-accent: #E6CBB8;     --color-accent-hover: #F4DFD0;
  --color-accent-soft: #761A02; --color-on-accent: #2A1410; --color-gilt: #E6CBB8;
  --color-overdue: #FF8A6B;    --color-overdue-soft: #4A1C12;

  /* Type */
  --font-display: 'Zodiak', serif;
  --font-ui: 'Switzer', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
  --text-display: 34px/40px;   --text-title: 24px/30px;    --text-input: 16px/24px;
  --text-body: 15px/22px;      --text-meta: 13px/18px;     --text-mono: 13px/18px;
  --text-label: 11px/14px;

  /* Radius */
  --radius-sm: 7px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 20px;

  /* Layout */
  --spacing-sidebar: 272px;  --spacing-content: 720px;
  --spacing-gutter: 64px;    --spacing-gutter-sm: 52px;

  /* Motion */
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-tick: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

The material tokens — `--edge-light`, `--edge-dark`, `--cast`, `--shadow-*`, `--sheen*`, `--gilt-line` — are declared on `:root` rather than in `@theme`, because they are consumed by CSS classes rather than by utilities. Porcelain overrides both sets under `:root[data-theme="porcelain"]` and under a `prefers-color-scheme: light` media query, so the correct theme is right at the first paint with no script involved.

Spacing uses Tailwind's own 4px scale rather than bespoke tokens; it already covers every value the design needs.

---

## 10. Frontend pre-launch checklist

- [x] All three fonts self-hosted, subset, preloaded — no Google Fonts CDN
- [x] Capture input font-size ≥16px, asserted in the end-to-end suite
- [x] Time gutter aligns across every row, including em-dash rows
- [x] Overdue distinguishable without colour — label, edge bar, tint and position
- [x] Gilt audited: hairlines, edges and the gutter time only, never a fill
- [x] Every contrast pair measured against WCAG AA in both themes
- [x] Full core loop completable by keyboard alone
- [x] `prefers-reduced-motion` honoured
- [x] No horizontal scroll at 360px, asserted in the end-to-end suite
- [x] Touch targets ≥44px on mobile
- [x] Focus visible on every interactive element
- [x] Core loop passing on Chromium, WebKit and mobile Safari
- [x] Large lists capped so 5,000 tasks do not freeze the view
- [ ] Verified on Firefox — configured in `playwright.config.ts`, not yet run
- [ ] Screen-reader pass with VoiceOver or NVDA
- [ ] Looked at by a human on real hardware, in both themes
