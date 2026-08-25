# IBS Ticketing System

A customer support / helpdesk platform built with Nuxt 4, built for IBS to receive, triage,
and resolve customer support requests — with SLA tracking, automation, canned responses,
and reporting, in the spirit of Jira Service Management or Zendesk.

- [Live demo](https://nuxt-shadcn-dashboard.vercel.app) _(UI kit this project is built on)_
- [Component Documentation](https://shadcn-vue.com/docs/introduction)

## What this is

Customers submit requests through a public portal. Support staff (agents and admins) work
those requests as tickets: they get auto-assigned and SLA-timed on arrival, staff reply or
leave internal notes, tag and prioritize them, and admins configure the rules that keep the
queue moving on its own. See [`app/pages/help.vue`](app/pages/help.vue) (rendered in-app at
`/help`, linked from the sidebar's **Help & Support**) for the full end-user guide to every
feature below.

### Core features

- **Ticket workflow** — status (`open` → `in-progress` → `resolved` → `closed`), priority
  (`low`/`medium`/`high`/`urgent`), assignee, tags, an activity/audit timeline, and a
  reply thread that distinguishes customer-facing replies from staff-only internal notes.
- **SLA & escalation** — first-response and resolution targets per priority (admin-editable
  under **Admin → SLA Policies**), on-track/at-risk/breached badges throughout the UI, and a
  background sweep that pages on-call staff automatically when a ticket breaches its SLA.
- **Automation & macros** — condition → action rules that run when a ticket is created
  (**Admin → Automations**), least-loaded auto-assignment when no rule sets an assignee, and
  admin-managed canned responses agents can apply from a ticket (**Admin → Macros**).
- **On-call paging** — active on-call staff get a web push notification whenever a ticket is
  created or breaches its SLA.
- **Reporting** — `/reports` (admin-only): ticket volume, status/priority breakdown, SLA
  compliance rate, average first-response/resolution time, and per-agent performance.
- **Staff administration** — invite staff, assign roles (`admin`/`agent`), manage on-call
  rotation, from `/admin`.
- **Customer portal** — an unauthenticated `/portal` page for customers to submit a ticket
  with attachments and get a reference number back.
- **Embeddable submission API** — `POST /api/tickets` is public and CORS-enabled for the
  origins you configure, so an external site (e.g. a marketing site's contact form) can create
  tickets directly, with rate limiting built in. See "Public API & rate limiting" below.
- **Two-way email via Gmail** — outbound (invites, password resets, ticket replies) and
  inbound (a customer's email reply lands back on the ticket, reopening it if needed) both go
  through the Gmail API against one mailbox — no separate transactional-email vendor. See
  "Email (Gmail API)" below.

## Tech stack

- [Nuxt 4](https://nuxt.com/) + [Nitro](https://nitro.build/) (server API routes; Nitro
  plugins for startup seeding and — on a persistent server — the background sweep)
- [Vue 3](https://vuejs.org/) + [shadcn-vue](https://shadcn-vue.com/) + [Tailwind CSS 4](https://tailwindcss.com/)
- Postgres via Nitro's built-in `db0` database layer (`nitro.database` in `nuxt.config.ts`) —
  no ORM, hand-written SQL in `server/utils/db.ts` and per-feature server utils
- Gmail API (via `google-auth-library` for OAuth2, raw REST calls for send/read) for all
  transactional and ticket email, both directions
- Deployed on [Vercel](https://vercel.com/) — `vercel.json` schedules the SLA sweep and Gmail
  inbox check via Vercel Cron, since serverless functions can't run a persistent background
  loop (see "Background jobs on Vercel" below)
- [web-push](https://www.npmjs.com/package/web-push) for on-call/assignment push notifications

## Quick start

```bash
pnpm i          # requires Node >=22 — see `.nvmrc` (run `nvm use` first if you use nvm)
cp .env.example .env   # fill in DATABASE_URL at minimum; see below
pnpm dev
```

On first boot, `server/plugins/db.ts` runs the schema migration and seeds:
- 3 demo staff accounts (see the console output for the shared default password —
  change it immediately)
- 3 demo tickets
- 4 default SLA policies (urgent/high/medium/low)

### Environment variables (`.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string (Neon, RDS, etc.) |
| `NUXT_SESSION_PASSWORD` | Yes | 32+ char secret used to sign the staff session cookie |
| `NUXT_RESEND_API_KEY` / `NUXT_RESEND_FROM_EMAIL` | For email | Staff invites, password resets, ticket-reply notifications |
| `NUXT_PUBLIC_VAPID_PUBLIC_KEY` / `NUXT_VAPID_PRIVATE_KEY` / `NUXT_VAPID_SUBJECT` | For push | On-call/assignment web push notifications — generate with `node -e "console.log(require('web-push').generateVAPIDKeys())"` |
| `NUXT_SITE_URL` | Yes | Base URL used to build links in emails |
| `NUXT_PUBLIC_PORTAL_CORS_ORIGINS` | For embedding | Comma-separated origins allowed to call `POST /api/tickets` cross-origin |
| `NUXT_GMAIL_CLIENT_ID` / `NUXT_GMAIL_CLIENT_SECRET` / `NUXT_GMAIL_REFRESH_TOKEN` / `NUXT_GMAIL_SENDER` | For email | Send + receive all ticket/staff email via Gmail — see "Email (Gmail API)" |
| `NUXT_CRON_SECRET` | For Vercel | Authenticates Vercel Cron's calls to `/api/cron/*` — see "Background jobs on Vercel" |

See `.env.example` for the full template.

## Public API & rate limiting

`POST /api/tickets` (ticket creation) has no auth, by design — it's what `/portal` calls, and
it's also safe to call directly from another site's contact form. To allow that cross-origin:

1. Set `NUXT_PUBLIC_PORTAL_CORS_ORIGINS` to the origin(s) that should be allowed, e.g.
   `https://www.ibsgh.com,https://ibsgh.com`.
2. POST JSON to `https://<your-app-domain>/api/tickets` with `subject`, `description`,
   `requester`, `requesterEmail`, `category`, `priority` (`low`/`medium`/`high`/`urgent`)
   required, and optional `referenceNumber`/`attachments` (array of filenames).

Every submission is rate-limited (Postgres-backed, so it holds across restarts and multiple
instances): 5 tickets per hour per IP address, and 5 per hour per requester email
(`server/api/tickets/index.post.ts`, `server/utils/rateLimit.ts`) — adjust the constants there
if that's too strict or too loose for your traffic. Limits are enforced regardless of origin,
including same-origin submissions from `/portal` itself.

## Email (Gmail API)

All email — staff invites, password resets, and ticket replies, in both directions — goes
through one Gmail mailbox via the Gmail REST API (`server/utils/gmail.ts`), authenticated with
an OAuth2 refresh token (`google-auth-library`). No SMTP, no separate transactional-email
vendor — this also matters because **Vercel's serverless functions block outbound SMTP**,
which is exactly why this uses the REST API instead.

**One-time setup (in Google Cloud Console, https://console.cloud.google.com):**

1. Select the project the OAuth client belongs to, then enable the **Gmail API** under
   APIs & Services → Library.
2. Under APIs & Services → OAuth consent screen: add the mailbox you'll send/receive as
   (e.g. `app.ibsgh@gmail.com`) as a **Test user** (External + Testing publishing status is
   fine — this app only ever needs the one account to grant consent).
3. Under APIs & Services → Credentials, open the OAuth 2.0 Client ID (**Web application**
   type) and add `http://localhost:3939/oauth2callback` to **Authorized redirect URIs**.
4. Set `NUXT_GMAIL_CLIENT_ID`, `NUXT_GMAIL_CLIENT_SECRET` (from that same client) and
   `NUXT_GMAIL_SENDER` (the mailbox address) in `.env`.
5. Run `node scripts/gmail-oauth-setup.mjs` — it opens a browser tab, you sign in as that
   mailbox and approve access, and it prints a `NUXT_GMAIL_REFRESH_TOKEN` value. Add that to
   `.env` locally and to your Vercel project's environment variables for production.

**How threading works:** every outbound email gets a `Message-ID` shaped like
`ticket-<id>.<random>@ibsgh.com`. When a customer replies, their mail client echoes that id
back in the `In-Reply-To`/`References` headers, which is how an inbound message gets matched
to the right ticket (falling back to parsing `[TICKET-1042]` out of the subject line if those
headers are missing) — see `server/utils/emailReply.ts` for the matching and
quoted-text-stripping logic, `server/utils/gmail.ts` for everything else. A matched reply is
appended to the ticket as a customer reply and reopens it if it had been resolved/closed.

## Background jobs on Vercel

Two things need to run on a schedule regardless of whether anyone's using the app: the SLA
breach/auto-close sweep, and checking Gmail for new replies. On a persistent server these just
run in-process (`server/plugins/sla-sweep.ts`, a plain `setInterval`) — but Vercel's serverless
functions don't stay alive between requests, so that `setInterval` isn't reliable there.

Instead, `vercel.json` configures two [Vercel Cron](https://vercel.com/docs/cron-jobs) jobs
that hit `/api/cron/sla-sweep` and `/api/cron/gmail-inbound` every 5 minutes (Vercel may run
them less often depending on your plan — Hobby is limited to roughly once/day; upgrade if you
need closer to real-time reply capture). Both routes call the exact same underlying functions
the `setInterval` plugin does (`server/utils/sweeps.ts`, `server/utils/gmail.ts`), so there's
one implementation either way — set `NUXT_CRON_SECRET` (and the matching `CRON_SECRET` env var
in your Vercel project settings) so only Vercel's own cron requests can trigger them.

## App Settings

You can change sidebar/theme defaults in `app/app.config.ts` and `app/composables/useAppSettings.ts`.
If you change a default that's already been applied in the browser, clear the `app_settings`
cookie to see it take effect (settings are cached there per-visitor).

## Project layout

- `app/pages/` — routed pages (`tickets.vue`, `portal.vue`, `reports.vue`, `help.vue`,
  `admin/*.vue`, `settings/*.vue`)
- `app/composables/` — client data-fetching composables, one per resource
  (`useTickets`, `useStaff`, `useTags`, `useMacros`, `useAutomationRules`, `useSlaPolicies`,
  `useReports`, `useOnCall`)
- `server/api/` — Nitro API routes, mirroring the composables above; `server/api/cron/` is
  what Vercel Cron calls (see "Background jobs on Vercel")
- `server/utils/` — server-side helpers: `db.ts` (schema + migrations), `sla.ts`,
  `automation.ts`, `tickets.ts` (shared ticket-loading), `mailer.ts` + `gmail.ts` +
  `emailReply.ts` (send/receive/thread-matching), `sweeps.ts` (SLA escalation + auto-close),
  `rateLimit.ts`, `cors.ts`, `cron.ts`, `push.ts`, `oncall.ts`
- `server/plugins/` — `db.ts` (migrate + seed on boot), `sla-sweep.ts` (runs `sweeps.ts` +
  `gmail.ts` on an interval — the dev/persistent-server fallback to Vercel Cron)

## Contributing

1. Clone this repository.
2. Install dependencies: `pnpm install`.
3. `nvm use` (or otherwise ensure Node matches `.nvmrc`) before `pnpm dev` — running under
   a mismatched Node version is known to break response headers in this Nitro/Vite version
   combination (breaks cookies and module loading).
4. `pnpm typecheck` and `pnpm lint` before opening a PR.

## Credits

- [Nuxt.js](https://nuxtjs.org/)
- [Shadcn Vue](https://shadcn-vue.com/)
- [TailwindCSS](https://tailwindcss.com/)

## License

MIT
