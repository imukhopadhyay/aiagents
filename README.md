# HR Suite

A human resources management app built with Next.js, TypeScript, Tailwind CSS,
shadcn/ui, Prisma and PostgreSQL. See [`prompts/hr-app-build-prompt.md`](prompts/hr-app-build-prompt.md)
for the full build plan.

**Status:** Phase 1 (Foundation) is complete. The core HR modules (Phase 2) aren't built yet.

## Stack

| Concern    | Choice                                                           |
| ---------- | ---------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack), React 19                     |
| Language   | TypeScript (strict, `noUncheckedIndexedAccess`)                  |
| UI         | Tailwind CSS v4, shadcn/ui (new-york style, Radix), lucide icons |
| Database   | PostgreSQL 16 with Prisma ORM 7 (`@prisma/adapter-pg`)           |
| Auth       | Auth.js v5 (credentials provider, JWT sessions)                  |
| Validation | Zod 4, React Hook Form                                           |
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

### Seeded accounts

Every account's password is `ChangeMe123!` unless you override it with
`SEED_ADMIN_PASSWORD` or `SEED_DEMO_PASSWORD`. Re-running the seed never resets
an existing password.

| Email                    | Roles                | Notes                                  |
| ------------------------ | -------------------- | -------------------------------------- |
| `admin@example.com`      | SUPER_ADMIN          | System account with no employee record |
| `hr.admin@example.com`   | HR_ADMIN, EMPLOYEE   | Hannah Lee, HR Director                |
| `hr.manager@example.com` | HR_MANAGER, EMPLOYEE | Priya Patel, reports to Hannah         |
| `ceo@example.com`        | MANAGER, EMPLOYEE    | Alex Morgan, top of the hierarchy      |
| `vp.eng@example.com`     | MANAGER, EMPLOYEE    | Jordan Rivera, reports to Alex         |
| `manager@example.com`    | MANAGER, EMPLOYEE    | Marcus Chen, manages Emma and Liam     |
| `employee@example.com`   | EMPLOYEE             | Emma Wilson, Software Engineer         |

The seed also creates departments, positions, two locations, leave types with
current-year balances, and one open job with a candidate in screening.

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
  schema.prisma          Data model (auth, RBAC, org, people, attendance, leave, recruitment, audit)
  migrations/            SQL migrations
  seed.ts                Idempotent seed
src/
  auth.config.ts         Database-free Auth.js config shared with the proxy
  auth.ts                Auth.js instance and credentials provider
  proxy.ts               Redirects signed-out users to /sign-in (Next 16's renamed middleware)
  app/
    (auth)/              sign-in, forgot-password, reset-password
    (app)/               Authenticated area: dashboard, admin/audit
    forbidden.tsx        403 page rendered by forbidden()
  components/ui/         shadcn/ui components
  lib/
    rbac/permissions.ts  Permission and role catalog (source of truth)
    rbac/authorize.ts    Pure authorization logic: can(), employeeScopeFilter()
    auth/session.ts      getCurrentUser(), requireAuth(), requirePermission()
    auth/actions.ts      Sign-in/out and password reset server actions
    audit.ts             recordAudit()
    db.ts                Prisma client singleton
  generated/prisma/      Generated Prisma client (git-ignored)
```

## Authorization model

Permissions are `resource:action` strings, such as `employee:read` or
`leave:approve`. A role grants each permission at one of three **scopes**:

- **OWN**: only records belonging to the user's own employee record.
- **TEAM**: the user's records plus those of their direct and indirect reports.
- **ALL**: every record.

A user with several roles gets the widest scope each role grants.

| Role        | Summary                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------- |
| SUPER_ADMIN | Everything                                                                                |
| HR_ADMIN    | Everything except `role:manage`                                                           |
| HR_MANAGER  | Org-wide people, attendance, leave and recruitment; can't delete employees                |
| MANAGER     | Their team's employees, attendance and leave (including approvals); read-only recruitment |
| EMPLOYEE    | Self-service for their own records                                                        |

The catalog lives in `src/lib/rbac/permissions.ts`, and `npm run db:seed` syncs
it into the `roles`, `permissions` and `role_permissions` tables. At runtime
`getCurrentUser()` reads grants from the database on each request, so role
changes and deactivations take effect right away without waiting for the JWT
to expire.

### Using it

```ts
// Page, layout, server action or route handler: 403 if not allowed
const user = await requirePermission("leave:approve", { employeeId: request.employeeId });

// Just a check, e.g. for showing or hiding UI
if (can(user, "audit:read")) { ... }

// Narrow list queries to what the user may see
const filter = employeeScopeFilter(user, "employee:read");
// { kind: "all" } | { kind: "employees", ids } | { kind: "none" }
```

The proxy only checks that a session exists. Every page, action and route
handler must call `requirePermission`, because hiding a link is not access control.

## Security notes

- Passwords are hashed with bcrypt (cost 12). Unknown emails are compared
  against a dummy hash so response timing doesn't reveal which accounts exist.
- Successful and failed sign-ins, sign-outs and password resets are written to
  `audit_logs` and can be viewed at `/admin/audit` (requires `audit:read`).
- Reset tokens are 32 random bytes. Only their SHA-256 hash is stored, and each
  token is single-use and expires after one hour. Issuing a new token
  invalidates older ones.
- The forgot-password response is the same whether or not the account exists.
- Callback URLs are restricted to same-origin paths to prevent open redirects.
- Reset links are built from `AUTH_URL`, never from the `Host` header, in
  production.

## Known limitations and next steps

- **Email isn't sent yet.** `src/lib/mail.ts` logs messages, including reset
  links, to the server console. Connect a real provider before going live.
- **Sign-in has no rate limiting.** Add a limiter such as Upstash or a
  database-backed one, or put the app behind a WAF.
- **Credentials only.** The `Account`, `Session` and `VerificationToken` tables
  follow the Auth.js adapter shape, so OAuth or SSO can be added later without a
  migration. `@auth/prisma-adapter` doesn't yet declare support for Prisma 7.
- **shadcn/ui components were written by hand** from the new-york v4 sources
  because the shadcn registry was unreachable from the build environment.
  `components.json` is configured, so `npx shadcn add <component>` works normally.
- **The app shell is a placeholder.** Phase 2 adds the full shell, the
  dashboard and the HR modules.
