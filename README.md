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

## Tech stack

- [Nuxt 4](https://nuxt.com/) + [Nitro](https://nitro.build/) (server API routes, Nitro
  plugins for startup seeding and the SLA sweep)
- [Vue 3](https://vuejs.org/) + [shadcn-vue](https://shadcn-vue.com/) + [Tailwind CSS 4](https://tailwindcss.com/)
- Postgres via Nitro's built-in `db0` database layer (`nitro.database` in `nuxt.config.ts`) —
  no ORM, hand-written SQL in `server/utils/db.ts` and per-feature server utils
- [Resend](https://resend.com/) for transactional email (staff invites, password resets,
  ticket-reply notifications)
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

See `.env.example` for the full template.

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
- `server/api/` — Nitro API routes, mirroring the composables above
- `server/utils/` — server-side helpers: `db.ts` (schema + migrations), `sla.ts`,
  `automation.ts`, `tickets.ts` (shared ticket-loading), `mailer.ts`, `push.ts`, `oncall.ts`
- `server/plugins/` — `db.ts` (migrate + seed on boot), `sla-sweep.ts` (SLA breach escalation
  + auto-close inactive tickets, every 5 minutes)

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
