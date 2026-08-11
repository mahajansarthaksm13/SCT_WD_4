# Security and Access Document
## Tally — To-Do Web App

| Field | Value |
|---|---|
| Document type | Security & Access |
| Status | v1.0 — pre-launch |
| Companion docs | `TODO_APP_PRD.md`, `TODO_APP_ARCHITECTURE.md` |
| Audience | Founder (non-technical) and builder |
| Last updated | July 31, 2026 |

---

## 0. How to read this document

Everything here is written in plain English first. Where a technical detail is needed for whoever writes the code, it sits in a clearly marked box like this:

> **For the builder:** technical specifics go here. Skip these if you're reading for the decisions.

You do not need to understand the boxes to make good calls about the rest.

---

## 1. Your security position in one paragraph

Version 1 of Tally has no accounts and no server. All data lives inside the user's own browser, on their own device. This eliminates the most common ways apps get breached — there is no password database to steal, no login to break into, no server to hack, and no central store of user data that could leak. What it does *not* eliminate is risk: the data sits unencrypted on a device that other people might use, it can be wiped by the browser without warning, and any malicious code that gets into your app can read all of it. Your entire v1 security job is therefore about **the code you ship** and **not losing people's data**. Accounts arrive in v2, and that's when the traditional security work begins.

---

## 2. Threat model — who would actually attack this, and why

Security work goes wrong when people defend against imaginary attackers. Here is a realistic assessment.

| Who | What they want | How likely | How bad if it works |
|---|---|---|---|
| **Nobody in particular** — automated bots scanning the internet | Anything exploitable; they don't know or care what your app is | **Very likely.** This is constant background noise | Low in v1 (nothing to reach). Serious in v2 if the database is left unprotected |
| **A person with physical access** to the user's unlocked device | Curiosity — reading someone's tasks | Moderate. Shared laptops, family computers, office machines | Low-to-moderate. Tasks are personal but rarely catastrophic |
| **A malicious or compromised code library** you installed from npm | Anything the app can reach; often crypto wallets or stored credentials | **Moderate, and rising.** This is the most realistic way a solo-built app gets compromised | High. Malicious code in your app can read everything and send it anywhere |
| **A targeted attacker** going after one specific user | That person's private information | Very low for a to-do app | Moderate |
| **You, by accident** — a bug that deletes data, or a misconfiguration | Nothing; it's a mistake | **The single most likely bad event** | High. Data loss destroys trust permanently and can't be undone |

**Read the pattern.** The two realistic threats are a bad dependency and your own mistakes. Neither is exciting. Both are what this document spends most of its effort on.

What Tally is **not** worth defending against: nation-state attackers, sophisticated targeted intrusion, or insider threats at your (nonexistent) company. Spending time there instead of on the two rows above would be a mistake.

---

## 3. Version 1 security — no accounts

### 3.1 What "no accounts" protects you from

Real, meaningful protection, and you should understand why it counts:

- **No password breach is possible.** You store no passwords. The most common catastrophic security event simply cannot happen to you.
- **No account takeover.** There's no account to take over.
- **No central data breach.** There's no server holding everyone's data. An attacker who wants a thousand users' tasks must compromise a thousand separate devices.
- **Minimal personal data.** You don't collect an email address, a name, or anything else. Data you never collect cannot leak — this is the strongest privacy control that exists.

### 3.2 What it exposes you to

**Anyone using that device can read the tasks.** There's no lock screen inside your app. If someone opens the browser on a shared computer, the tasks are right there. This is a genuine limitation and you should be upfront about it rather than pretending otherwise.

*What to do:* say so, once, in plain language. A short line in the empty state or an "About your data" link: *"Your tasks are saved in this browser on this device. Anyone who uses this browser can see them, and they aren't backed up anywhere."* Honesty here builds more trust than silence.

*What not to do:* do not add a PIN or password to "lock" the app. Data stored in the browser can be read directly by anyone technical enough to open developer tools, regardless of what your interface shows. A lock screen over unencrypted data is a lie about safety, which is worse than no lock at all.

**The browser can delete everything without warning.** This is the risk most people underestimate. Clearing browsing data wipes it. Private/incognito mode may discard it on close. Browsers can evict storage automatically when the device runs low on space. Some privacy tools clear it on a schedule.

*What to do:* three things, all covered in the architecture document. Ask the browser for persistent storage on first run. Make JSON export a must-have feature rather than a nice-to-have. And tell the user where their data lives.

**Malicious code in your app can read all of it.** If a script you didn't intend ends up running on your page, it has full access to every task. This is the one that matters most, and §4 is entirely about it.

### 3.3 The rule that protects you most in v1

> **For the builder:** React escapes text content automatically. A task titled `<script>alert(1)</script>` renders as harmless literal text. This protection is on by default and there is exactly one way to switch it off:
>
> **Never use `dangerouslySetInnerHTML`. Not once. Not for the notes field, not for "just formatting."** The same applies to `innerHTML`, `document.write`, and passing user text into `eval` or `new Function`.
>
> Add a lint rule so this can't happen by accident:
> ```js
> // eslint.config.js
> 'react/no-danger': 'error'
> ```
>
> Add a Content Security Policy header at your host (Vercel/Netlify both support this in config). Even a basic one is a strong second layer:
> ```
> Content-Security-Policy:
>   default-src 'self';
>   script-src 'self';
>   style-src 'self' 'unsafe-inline';
>   img-src 'self' data:;
>   connect-src 'self' https://*.supabase.co;
>   frame-ancestors 'none';
>   base-uri 'self'
> ```
> Also set: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

In plain English: your app should only ever run code that came from your own app, and it should treat everything the user types as text to display, never as instructions to follow.

---

## 4. Your dependencies are your biggest real risk

When you install a package from npm, you are running someone else's code inside your app with the same permissions your own code has. A typical React project pulls in several hundred packages, most of which you never chose directly. If any one of them is compromised — which happens regularly, usually by an attacker taking over a maintainer's account — the malicious version can read everything your app can.

This is the most likely way a solo-built app actually gets compromised. It requires no one to target you specifically.

**What to do about it, in order of value:**

1. **Install fewer things.** Every dependency you don't add is a risk you don't take. This is why the architecture document rejects component libraries — the security benefit is a real part of that reasoning, not just bundle size.
2. **Check a package before installing it.** Weekly download count in the millions, recent commits, a maintainer you can identify. A package with 200 weekly downloads and one commit two years ago is a bad bet no matter how well it solves your problem.
3. **Commit your lockfile** (`package-lock.json`). It pins the exact versions of everything, including packages you didn't pick.
4. **Run `npm audit` weekly** and before every deploy. Turn on Dependabot or Renovate on your repository — free, and it tells you when something you depend on is found to be vulnerable.
5. **Be suspicious of updates that arrive urgently.** Compromised packages are usually published as a fast patch release. There is no harm in waiting 48 hours on a non-security update.

---

## 5. Authentication for version 2

When accounts arrive, here is the recommendation and the reasoning.

### 5.1 Recommendation: email magic link (passwordless)

The user types their email address. They receive an email with a link. Clicking it logs them in. No password is ever created or stored.

**Why this fits your product specifically:**

- **It preserves your best security property.** You never store passwords, so you can never leak them. The single worst breach category remains impossible.
- **It matches your product philosophy.** Your PRD's core promise is minimal friction. Magic links have no password to invent, no strength rules to satisfy, no "forgot password" flow to build, and no reset emails to secure. That last point matters more than it sounds: password reset flows are where a large share of real account takeovers happen, and you simply don't have one.
- **It removes an entire category of attack.** Credential stuffing — attackers trying passwords leaked from other sites — is the most common way accounts get taken over, because most people reuse passwords. With no passwords, it doesn't apply.
- **It's roughly a day of work** with Supabase, versus a week for a properly-built password system with reset flows, rate limits, and strength requirements.

**The honest trade-offs:**

- **The user's email account becomes the key to their tasks.** If someone can read their email, they can log in. This is true of password-based systems too — that's what "forgot password" does — but here it's the *only* path, so it's more visible.
- **Logging in requires switching to email.** Slower than typing a remembered password. Mitigate with long-lived sessions so it happens rarely.
- **Email can be slow or land in spam.** Handle this in your interface (see §8), and use a proper transactional email provider rather than the default sandbox sender.

### 5.2 What I'd recommend against, and why

| Option | Why not |
|---|---|
| **Email + password** | Requires you to build and secure a reset flow, enforce password rules, and defend against credential stuffing. All of that work, and the result is *less* secure than having no passwords |
| **Social login only** (Google/GitHub) | Convenient, but it hands your users' access to a third party, blocks anyone without that account, and means Google learns they use your app. Reasonable as an *additional* option later; poor as the only one |
| **SMS one-time codes** | Costs money per message, and phone numbers can be stolen through SIM-swap attacks. Weaker than email for this use case |
| **No accounts at all, forever** | Genuinely defensible, and worth considering. But it permanently blocks sync, which your PRD names as the top v2 request |

### 5.3 Session handling

> **For the builder:** Supabase's JavaScript client stores the session token in `localStorage` by default. This is convenient and it is a real trade-off: it means any successful cross-site scripting attack can steal the session token, not just read the current page. Storing tokens in `httpOnly` cookies would prevent that, but requires a server component to set them.
>
> For a v2 personal task app, `localStorage` is an acceptable choice **provided §3.3 is followed strictly** — no `dangerouslySetInnerHTML`, a Content Security Policy in place. Write this decision down somewhere so it gets revisited if the app ever handles more sensitive data.
>
> Configure: access tokens expiring in ~1 hour with automatic refresh, refresh tokens with rotation enabled, and magic links that expire in 15 minutes and can be used exactly once.

**Rate limiting:** cap magic-link requests at roughly 5 per email address per hour and 20 per IP address per hour. Without this, someone can use your login form to spam an inbox, and your email provider will suspend your account for it. Supabase provides configurable limits — set them explicitly rather than trusting defaults.

---

## 6. Roles and permissions — who can do what

### 6.1 First, an honest framing

Tally is a single-user personal app. Nobody shares lists, nobody is assigned tasks, nobody supervises anyone. That means the traditional role hierarchy — Admin, Editor, Viewer — has no meaning here. Building one would add permission-checking code to every operation while protecting against nothing, and every line of unnecessary permission code is a place a bug can hide.

**One role, exhaustively enforced, is stronger than five roles loosely enforced.**

What *is* worth mapping is every actor who can touch the data, including you.

### 6.2 The actors

| Actor | Who this is | Can do | Cannot do |
|---|---|---|---|
| **Anonymous visitor** | Someone who has opened the site but not logged in | View the marketing/landing content. Sign up or request a login link | Read, create, or modify any task or list belonging to anyone. Discover whether a given email address is registered |
| **Owner** (the only real user role) | A logged-in person, acting on their own data | Create, read, edit, complete, reorder, and delete their own tasks and lists. Export all their own data. Change their own email. Delete their entire account and all its data | Read or modify *anything* belonging to any other user — including by guessing an ID or editing a request. Change another user's data through any path whatsoever |
| **Operator** (you) | You, with access to the Supabase dashboard | View aggregate counts and system health. Read error logs. Perform schema migrations. Restore from backup on request | Read the content of users' task titles or notes as routine practice. Log into a user's account. Modify user data outside a documented, user-requested support action |
| **Service role** (automated) | Scheduled jobs, e.g. purging old deleted rows | Only the specific narrow operations it exists for | Everything else. This credential bypasses all database protections and must never touch your frontend code |
| **Attacker with a stolen session** | Someone who obtained a user's login token | Whatever that one user can do, until the session expires | Reach any *other* user's data. Escalate to operator access. Persist after the session is revoked |

### 6.3 The operator row deserves attention

You will technically be able to read every user's tasks by opening the database. Technically able is not the same as should.

This matters for three reasons: people write genuinely private things in to-do apps; the ability to browse user content invites casual curiosity that feels harmless and isn't; and if your account is ever compromised, whatever you can reach is what the attacker reaches.

**Set a policy now, while it costs nothing:**
- Access production user content only in response to a specific support request, from that specific user.
- Protect your Supabase account with a strong unique password and two-factor authentication. Your account is the master key to everything.
- Use anonymised or synthetic data for development and testing. Never copy production data to your laptop.
- Prefer aggregate queries (`count(*)`) over row-level browsing when investigating anything.

### 6.4 The dangerous credential

> **For the builder:** Supabase issues two keys.
>
> The **anon key** is designed to be public. It ships in your JavaScript bundle and anyone can read it. It is safe *only* because Row Level Security restricts what it can reach.
>
> The **service_role key** bypasses Row Level Security entirely. Anyone holding it can read and modify every user's data. It must never appear in frontend code, in any file with a `VITE_` prefix, in your git repository, in a screenshot, or in a support chat. If it is ever exposed, rotate it immediately and assume it was captured — automated scanners find leaked keys in public repositories within minutes.

---

## 7. Row Level Security — the rules that actually protect the data

### 7.1 What this is, in plain English

Your app runs in the user's browser, which means the user controls it completely. They can open developer tools, change what the code does, and send whatever request they want to your database. So any rule enforced only in the browser — "only show tasks belonging to this user" — is a display preference, not a security control. It can be bypassed by anyone willing to spend ten minutes.

Row Level Security moves the rule into the database itself. The database checks *every single row* against "does this belong to the person asking?" and silently refuses to return anything that doesn't. It doesn't matter what request the browser sends; the database won't hand over another person's data.

The useful mental image: rather than a bouncer at the door checking who comes in, every individual file in the cabinet is checking your ID before it lets you open it.

### 7.2 The rules

Stated plainly, there are only two, and they're the same rule twice:

1. **A person can see, create, change, and delete a task only if that task belongs to them.**
2. **A person can see, create, change, and delete a list only if that list belongs to them.**

That's the entire authorization model. Its simplicity is the point.

> **For the builder:** the policies from the architecture document, with the checks explained.
>
> ```sql
> alter table public.lists enable row level security;
> alter table public.tasks enable row level security;
>
> create policy "own lists" on public.lists
>   for all
>   using      (auth.uid() = user_id)     -- which rows you may READ
>   with check (auth.uid() = user_id);    -- which rows you may WRITE
>
> create policy "own tasks" on public.tasks
>   for all
>   using      (auth.uid() = user_id)
>   with check (auth.uid() = user_id);
> ```
>
> `using` and `with check` are both required, and the distinction is the one people miss. `using` filters what you can read. `with check` validates what you're allowed to write. **With `using` alone, a user could create a task with someone else's `user_id` on it** — writing into another person's account. Both clauses, on both tables, always.
>
> One more rule worth adding, because RLS alone won't catch it:
> ```sql
> -- Prevent moving a task into a list you don't own
> create policy "task list must be owned" on public.tasks
>   for all
>   using (
>     auth.uid() = user_id
>     and exists (
>       select 1 from public.lists l
>       where l.id = tasks.list_id and l.user_id = auth.uid()
>     )
>   );
> ```

### 7.3 The mistake that would cause your worst day

**Creating a table and forgetting to turn Row Level Security on.**

A Supabase table without RLS enabled, combined with your publicly-readable anon key, means anyone on the internet can read and modify every row in it. This is not a theoretical concern — it is the most common serious Supabase misconfiguration, and automated scanners actively look for it.

**The rule: enable RLS in the same migration that creates the table. Never in a follow-up.**

Supabase's dashboard shows a warning for unprotected tables. Do not dismiss it. Check the Advisors panel before every deploy.

### 7.4 How to actually verify it works

Do not assume. Test it, before launch:

1. Create two test accounts, A and B.
2. Log in as A. Create a list and a few tasks. Copy one task's ID from the database.
3. Log in as B. In the browser console, attempt to fetch A's task directly by that ID.
4. **Expected result: empty. Not an error — empty.** RLS makes forbidden rows invisible rather than forbidden, which correctly avoids confirming they exist.
5. As B, attempt to create a task with A's `user_id`. It must be rejected.
6. As B, attempt to update A's task. It must affect zero rows.

Write these as automated tests if you can. At minimum, do them by hand and record the results.

---

## 8. Error handling guide

### 8.1 Five principles

1. **Never blame the user.** "That email doesn't look right" — not "Invalid input."
2. **Never show raw technical errors.** A stack trace tells an attacker about your internals and tells the user nothing useful.
3. **Every error says what happened and what to do next.** An error with no next step is just bad news.
4. **When something goes wrong, protect the data.** If a save fails, keep what the user typed on screen. Never clear a form because a request failed.
5. **Log the technical detail, show the human message.** These are two different audiences.

### 8.2 The failure points

**Data and storage**

| What goes wrong | What the user sees | What the system does |
|---|---|---|
| Browser storage unavailable (private mode, blocked) | Persistent banner: *"Heads up — this browser isn't letting Tally save your tasks, so they'll disappear when you close the tab. You can export them any time."* App stays usable | Fall back to in-memory storage. Keep the app working. Make export prominent |
| Storage quota full | *"Your browser's storage is full. Export your tasks to keep them safe, then remove some completed items."* | Block new writes. Never partially write. Offer export and bulk-delete-completed |
| Browser evicted the data | Empty app with normal empty state — **not** an error message | Nothing recoverable. This is why export exists. Consider a low-key note if a previous session was recorded |
| A save fails mid-edit | The edit stays visible with a retry option. Nothing is lost from the screen | Keep the value in memory. Retry automatically once. Don't roll back the display until the user chooses |
| Corrupted local database | *"Something went wrong loading your tasks. We've kept a copy of the raw data — you can download it here."* | Don't auto-wipe and start fresh. Offer the raw dump. Let the user decide |

**Login and accounts (v2)**

| What goes wrong | What the user sees | What the system does |
|---|---|---|
| Login email doesn't arrive | After 30 seconds: *"Still waiting? Check your spam folder, or resend."* Resend enabled after 60s | Log the send attempt and provider response. Never say whether the address is registered |
| Magic link expired | *"That link has expired for security. Here's a fresh one."* with the email pre-filled | Reject cleanly. Never extend an expired token |
| Magic link already used | Same message as expired — deliberately identical | Links are strictly single-use |
| Too many login attempts | *"Too many login requests. Try again in a few minutes."* | Rate-limit by email and by IP. Return the same message either way |
| Email address not registered | **Exactly the same message as a successful send** | This matters: revealing which emails have accounts lets an attacker build a user list. Always respond as though it succeeded |
| Session expired mid-use | *"You've been signed out. Sign in again to keep going."* Unsaved work preserved on screen | Redirect to login, return to the same place afterwards. Never dump the user on a blank homepage |
| Login on a new device | Normal login, no scary warnings | Optionally email a notification. Don't block |

**Network and server (v2)**

| What goes wrong | What the user sees | What the system does |
|---|---|---|
| No internet connection | Small persistent indicator: *"Offline — changes saved on this device and will sync when you're back."* | Queue writes locally. Do not block the interface. This is the payoff for local-first architecture |
| Request times out | Silent retry first. Only surface after two failures | Exponential backoff: 1s, 2s, 4s. Cap retries |
| Database unreachable | *"We're having trouble reaching our servers. Your changes are saved on this device."* | Fall back to local. Never lose the write |
| Permission denied by RLS | *"You don't have access to that."* — nothing more specific | **Log this loudly.** In a correctly built app this should be approximately impossible. Every occurrence is either a bug or an intrusion attempt |
| Unexpected server error | *"Something went wrong on our end. We've been notified."* Plus a short reference code | Log full detail server-side. Show the user only the reference code |

**User input**

| What goes wrong | What the user sees | What the system does |
|---|---|---|
| Empty task submitted | Nothing at all. No error | Silently ignore. An error message here is noise |
| Title over the length limit | Character counter appears near the limit; input stops accepting at the max | Enforce in the interface *and* in the database constraint |
| Invalid date entered | Field highlights, previous value retained | Use native date inputs; they prevent most of this |
| Duplicate list name | Allow it, with a gentle note | Not an error. People have reasons |
| Imported file is malformed | *"That file doesn't look like a Tally export. Nothing was changed."* | **Validate the entire file before writing anything.** Never partially import |

> **For the builder:** file import is a genuine attack surface — it's untrusted data entering your data layer. Validate the parsed JSON against a strict schema (Zod is the standard choice), reject unknown fields rather than ignoring them, enforce a file size cap of a few megabytes, and import inside a single transaction so a failure changes nothing. Never trust IDs, timestamps, or `user_id` values from an imported file — regenerate or reassign them.

---

## 9. Edge cases to handle before launch

### Data and storage
- [ ] Private/incognito browsing — detect that storage failed and degrade gracefully instead of crashing
- [ ] Storage quota exhausted mid-write — never leave a half-written record
- [ ] Browser eviction between sessions — the app must open cleanly with zero data, not error
- [ ] **Two tabs open at once** — this one bites people. Edits in one tab silently overwrite the other. Use the `storage` event or a `BroadcastChannel` to keep tabs in sync
- [ ] Very large dataset (5,000+ tasks) — the list must not freeze. Virtualise if needed
- [ ] Import file that's valid JSON but the wrong shape
- [ ] Import file large enough to hang the browser
- [ ] User clears storage while the app is open

### Dates and time
- [ ] Task due during a daylight-saving transition (test March and November explicitly)
- [ ] User travels across timezones — does "today" update correctly?
- [ ] Task due at exactly midnight
- [ ] Device clock set wrong — everything overdue, or nothing ever due
- [ ] Task dated years in the past or future
- [ ] App left open overnight — does the Today view roll over at midnight without a refresh?
- [ ] February 29th and month-end handling

### Text and input
- [ ] Task title that is only whitespace — reject, same as empty
- [ ] Emoji, and text in scripts like Devanagari, Arabic, or Chinese — must store and render correctly (use UTF-8 everywhere)
- [ ] Right-to-left text mixed with left-to-right — check it doesn't break the layout
- [ ] Extremely long single word with no spaces — must wrap, not overflow the container
- [ ] Text pasted from Word or Google Docs carrying hidden formatting — strip to plain text on paste
- [ ] A title that looks like code or HTML — must display as literal text (verify §3.3 is working)

### Interaction
- [ ] Double-clicking the create button — do not create two tasks
- [ ] Rapid-fire task creation — no dropped entries or duplicate IDs
- [ ] Deleting a task while its edit field is open
- [ ] Deleting a list while viewing it — where does the user land?
- [ ] Completing a task while it's being edited
- [ ] Browser back button — behaves sensibly, doesn't lose state
- [ ] Undo clicked after the toast has already gone
- [ ] Drag-reorder interrupted by a page refresh

### Accounts (v2)
- [ ] User requests a magic link, then requests another before using the first
- [ ] User clicks an old link from an earlier email
- [ ] User signs up with an email that has a typo — no recovery path exists, so consider a confirmation step
- [ ] Same person logs in on two devices with conflicting offline edits
- [ ] User deletes their account — **verify every row is actually gone**, then verify again
- [ ] User changes email address — old address must lose access immediately
- [ ] Local data exists when the user logs in for the first time — merge it, don't silently discard it

### Deployment and operations
- [ ] Row Level Security confirmed enabled on every table (§7.4)
- [ ] A deploy that lands while users have the app open — stale code talking to a new schema
- [ ] Database migration that adds a field — old clients must not break
- [ ] Environment variables set correctly in production, not just locally
- [ ] `service_role` key confirmed absent from the entire repository *and* its git history

---

## 10. Privacy and user data

**Collect as little as possible.** Every piece of personal data you hold is a liability. In v1 you collect nothing, which is ideal. In v2 you'll collect an email address, and that should remain the only personal field. Don't add name, phone, date of birth, or profile photo unless a feature genuinely requires it. None will.

**Analytics should not see task content.** Track that a task was created — never what it said. Use a privacy-respecting provider (Plausible or similar) that doesn't set cookies or build cross-site profiles. If you can't explain what an analytics event collects in one sentence, don't send it.

**Give users a real exit.** Export (which you're building anyway) and genuine account deletion. Deletion must actually delete — not deactivate, not soft-flag. The `on delete cascade` rules in your schema handle this correctly. Verify it once by hand against the live database.

**A note on Indian data protection law.** You're building from India, so the Digital Personal Data Protection Act, 2023 is the relevant framework. The obligations it sets out map closely to what this document already recommends: collect only what you need for a stated purpose, tell people clearly what you collect, let them access and delete their data, and report breaches. Your architecture is already well aligned with that direction. **I'm not a lawyer and this isn't legal advice** — if Tally moves beyond a personal or portfolio project and gains real users, get a qualified opinion on the specific compliance requirements that apply to you.

---

## 11. Pre-launch checklist

**Ship-blocking — do not launch without these**
- [ ] No `dangerouslySetInnerHTML` anywhere; lint rule active
- [ ] Content Security Policy header set at the host
- [ ] `npm audit` clean of high and critical findings
- [ ] Lockfile committed
- [ ] No secrets in the repository or git history
- [ ] HTTPS enforced (automatic on Vercel/Netlify)
- [ ] JSON export working and tested with a real dataset
- [ ] Storage-unavailable path handled without a crash
- [ ] Plain-language note telling users where their data lives

**Additionally ship-blocking for v2**
- [ ] Row Level Security enabled on every table, with both `using` and `with check`
- [ ] Cross-user access tests from §7.4 run and passing
- [ ] `service_role` key confirmed absent from all frontend code
- [ ] Rate limits configured on login requests
- [ ] Login errors reveal nothing about which emails are registered
- [ ] Account deletion verified to remove every row
- [ ] Two-factor authentication enabled on your own Supabase account

**Worth doing, not ship-blocking**
- [ ] Dependabot or Renovate enabled
- [ ] Error monitoring configured (Sentry's free tier is fine)
- [ ] Multi-tab synchronisation handled
- [ ] Database backups confirmed running and a restore tested once
