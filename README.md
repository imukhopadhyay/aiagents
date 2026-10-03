# HR Suite

A human resources management app built with Next.js, TypeScript, Tailwind CSS,
shadcn/ui, Prisma and PostgreSQL. See [`prompts/hr-app-build-prompt.md`](prompts/hr-app-build-prompt.md)
for the full build plan.

**Status:** Phase 1 (Foundation) and Phase 2 (Core HR Modules) are complete.

## Features

| Module                | What it does                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shell & dashboard** | Sidebar built from the user's permissions, mobile drawer, breadcrumbs, notification bell, light/dark theme. The dashboard is role-aware: headcount or team size, new hires, people on leave today, open positions, pending approvals, clock in/out, time-off summary, interviews, pipeline, activity.                                                       |
| **Employees**         | Directory with search, filters, sorting, pagination and CSV export. Create/edit with reporting-cycle checks; new accounts get an email invitation. Profiles have overview, emergency contacts, documents and history tabs, plus photo upload, self-service contact edits, offboarding and archiving. CSV import is validated row by row and all-or-nothing. |
| **Organization**      | Nested departments with heads; archiving moves members, sub-departments and positions elsewhere and prevents cycles. Positions with levels. Interactive org chart with search and collapse.                                                                                                                                                                 |
| **Attendance**        | Clock in/out (late detection in the office's time zone, remote option), a monthly calendar, correction requests approved by managers or HR, a daily team view, and a monthly report with CSV export. Absences are derived from working days with no record or leave.                                                                                        |
| **Leave**             | Requests with half days; weekends and public holidays aren't counted. Overlap, calendar-year and balance checks, with monthly accrual. Two-stage approval (manager, then HR) with notifications; cancellations return days. Team calendar, balances with HR adjustments, leave types, holidays, and new-year set-up with capped carry-over.                 |
| **Recruitment**       | Jobs (draft → open → on hold/closed → filled), candidates with resumes and tags, a drag-and-drop pipeline, interviews scheduled in the job's time zone, interviewer feedback, offers, and hiring an accepted offer into an employee record. Metrics include time to hire.                                                                                   |

## Stack

| Concern    | Choice                                                           |
| ---------- | ---------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack), React 19                     |
| Language   | TypeScript (strict, `noUncheckedIndexedAccess`)                  |
| UI         | Tailwind CSS v4, shadcn/ui (new-york style, Radix), lucide icons |
| Database   | PostgreSQL 16 with Prisma ORM 7 (`@prisma/adapter-pg`)           |
| Auth       | Auth.js v5 (credentials provider, JWT sessions)                  |
| Validation | Zod 4, React Hook Form                                           |
| Drag/drop  | dnd-kit (pointer, touch and keyboard)                            |
| Tests      | Vitest                                                           |

## Getting started

Prerequisites: Node.js 20.19+ and either Docker or a local PostgreSQL 16.

```bash
cp .env.example .env            # then set AUTH_SECRET (npx auth secret)
docker compose up -d db         # or point DATABASE_URL at your own Postgres
npm install                     # also runs `prisma generate`
npm run db:migrate              # apply migrations
npm run db:seed                 # roles, permissions and demo data
npm run dev                     # http://localhost:3000
```

`AUTH_URL` must match the address you open the app on. Auth.js redirects there
after sign-in, and email links are built from it.

### Seeded accounts

Every account's password is `ChangeMe123!` unless you override it with
`SEED_ADMIN_PASSWORD` or `SEED_DEMO_PASSWORD`. Re-running the seed never resets
an existing password.

| Email                    | Roles                | Try                                                     |
| ------------------------ | -------------------- | ------------------------------------------------------- |
| `admin@example.com`      | SUPER_ADMIN          | Everything; system account with no employee record      |
| `hr.admin@example.com`   | HR_ADMIN, EMPLOYEE   | Hannah Lee, HR Director: settings, audit log, approvals |
| `hr.manager@example.com` | HR_MANAGER, EMPLOYEE | Priya Patel: recruitment, final leave approval          |
| `ceo@example.com`        | MANAGER, EMPLOYEE    | Alex Morgan, top of the hierarchy                       |
| `vp.eng@example.com`     | MANAGER, EMPLOYEE    | Jordan Rivera, reports to Alex                          |
| `manager@example.com`    | MANAGER, EMPLOYEE    | Marcus Chen: approves Liam's pending leave              |
| `employee@example.com`   | EMPLOYEE             | Emma Wilson: clock in, request leave, give feedback     |

The seed also creates:

- Departments, positions and two locations (New York, London).
- Leave types with balances for the current year, and public holidays.
- Two weeks of attendance history.
- One approved and one pending leave request.
- One open job with a candidate in screening.

## Deploying

The app is set up for Vercel with Neon Postgres and private Vercel Blob storage.
See [DEPLOY.md](DEPLOY.md) for step-by-step instructions.

## Scripts

| Script                               | Purpose                                     |
| ------------------------------------ | ------------------------------------------- |
| `dev` / `build` / `start`            | Next.js dev server, production build, serve |
| `lint` / `typecheck`                 | ESLint, `next typegen` + `tsc --noEmit`     |
| `format` / `format:check`            | Prettier                                    |
| `test` / `test:watch`                | Vitest unit tests                           |
| `db:migrate`                         | Create and apply migrations (dev)           |
| `db:deploy`                          | Apply migrations (production)               |
| `db:seed` / `db:reset` / `db:studio` | Seed, reset and reseed, Prisma Studio       |

## Project layout

```
prisma/
  schema.prisma            Data model
  migrations/              SQL migrations
  seed.ts                  Idempotent seed
src/
  auth.ts, auth.config.ts  Auth.js setup; proxy.ts guards signed-out access
  app/
    (auth)/                Sign-in, forgot/reset password
    (app)/                 Authenticated area, one folder per module; each has
                           pages plus an actions.ts of server actions
    api/files/             Access-checked file downloads
    api/*/export/          CSV exports
  components/
    ui/                    shadcn/ui components
    shared/                Page header, tables, filters, form fields, dialogs
    layout/, time/         App shell; calendar helpers
  hooks/use-action-form.ts React Hook Form wired to a server action
  lib/
    domain/                Pure, unit-tested rules: dates, leave days and
                           workflow, accrual, org cycles, CSV, attendance, pipeline
    services/              Business logic per module; every function checks
                           permissions and writes the audit log
    validation/            Zod schemas shared by forms and actions
    rbac/                  Permission catalog and pure authorization logic
    auth/session.ts        getCurrentUser(), requirePermission()
    action.ts              runAction(): auth, validation and error mapping for actions
    storage.ts             Local file storage (swap for S3 etc. in production)
```

### Request flow

A form validates with the same Zod schema the server uses, then calls a server
action. The action goes through `runAction`, which:

- loads the current user;
- parses the input;
- calls a service function, which checks permissions for the specific record
  and records an audit entry;
- maps expected errors to field messages and refreshes the page on success.

Pages call `requirePermission(...)` before loading data, and list queries are
narrowed with `employeeAccessWhere(user, permission)`.

## Authorization model

Permissions are `resource:action` strings, such as `employee:read` or
`leave:approve`. A role grants each permission at one of three **scopes**:

- **OWN**: only records belonging to the user's own employee record.
- **TEAM**: the user's records plus those of their direct and indirect reports.
- **ALL**: every record.

A user with several roles gets the widest scope each role grants.

| Role        | Summary                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| SUPER_ADMIN | Everything                                                                                                            |
| HR_ADMIN    | Everything except `role:manage`                                                                                       |
| HR_MANAGER  | Org-wide people, attendance, leave and recruitment; final leave approval; can't offboard employees                    |
| MANAGER     | Their team's employees, attendance and leave; first-stage leave approval and attendance corrections; read-only hiring |
| EMPLOYEE    | Self-service: own profile and contact details, attendance, leave and interview feedback                               |

The leave approval stage depends on scope. `leave:approve` at TEAM scope is the
manager stage; at ALL scope it is the final HR approval. Interviewers only see
the interviews they're assigned to, their own feedback, and that candidate's
resume.

The catalog lives in `src/lib/rbac/permissions.ts`, and `npm run db:seed` syncs
it into the `roles`, `permissions` and `role_permissions` tables. At runtime
`getCurrentUser()` reads grants from the database on each request, so role
changes and deactivations take effect right away.

```ts
// Page, layout, server action or route handler: 403 if not allowed
const user = await requirePermission("leave:approve", { employeeId: request.employeeId });

// Just a check, e.g. for showing or hiding UI
if (can(user, "audit:read")) { ... }

// Narrow list queries to what the user may see
const where = employeeAccessWhere(user, "employee:read");
```

The proxy only checks that a session exists. Hiding a link is not access
control, so every page, action and route handler checks permissions on the
server.

## Security notes

- Passwords are hashed with bcrypt (cost 12). Unknown emails are compared
  against a dummy hash so response timing doesn't reveal which accounts exist.
- Reset and invitation tokens are 32 random bytes; only their SHA-256 hash is
  stored. They are single-use. Reset tokens expire after 1 hour, invitations
  after 7 days.
- Callback URLs are restricted to same-origin paths. Email links are built
  from `AUTH_URL`, never from the `Host` header.
- Uploads are checked by type and size and saved under random keys outside the
  web root. They are served only through `/api/files` after an access check;
  unauthorized requests get a 404. Responses send `nosniff` and a sandboxing
  CSP.
- CSV exports neutralize spreadsheet formula injection.
- Concurrent approvals are guarded, so a request can't be decided twice.
- Changes are recorded in `audit_logs`, viewable at `/admin/audit`. Each
  employee's history tab draws from the same log.

## Testing

- `npm test` covers the authorization rules and the domain logic: leave-day
  counting, accrual, the approval workflow, org cycles, CSV parsing,
  time-zone handling and pipeline moves.
- Each module was also tested end to end in a browser for every seeded role:
  - create, invite, import and offboard employees;
  - clock in and out, and the correction workflow;
  - the two-stage leave workflow, including balance checks;
  - the full hiring lifecycle, from job to employee.

## Known limitations and next steps

- **Email isn't sent yet.** `src/lib/mail.ts` logs messages to the server
  console, including reset and invitation links. Connect a real provider before
  going live. In-app notifications work.
- **Uploads are limited to 4 MB** to fit Vercel's request size cap. They go
  to private Vercel Blob storage when `BLOB_READ_WRITE_TOKEN` is set, and to
  local disk under `STORAGE_DIR` otherwise.
- **Sign-in has no rate limiting.** Add a limiter or a WAF.
- **Denied pages return HTTP 200, not 403.** Inside the app, the loading
  skeleton starts streaming before a permission check runs, so the status code
  can't change afterwards. The 403 page content still renders and no data
  leaks.
- **Employee pickers are plain selects.** They're fine for hundreds of
  employees; switch to a searchable combobox for larger organizations.
- **Lists are server-paginated tables, not TanStack Table.**
- **Credentials sign-in only.** The tables already follow the Auth.js adapter
  shape, so OAuth or SSO can be added without a migration.
- **shadcn/ui components were written by hand** from the new-york v4 sources,
  because the registry was unreachable from the build environment.
  `components.json` is configured, so `npx shadcn add` works normally.
- **Ideas for next steps:** payroll exports, performance reviews, a
  role-management UI (the `role:manage` permission already exists), recurring
  holidays, and email/calendar invites for interviews.
