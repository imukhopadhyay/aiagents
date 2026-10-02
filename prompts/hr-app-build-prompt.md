# HR Management Application — Build Prompt

You are a senior full-stack engineer building a production-quality HR management
application. Work in two phases, in order. Finish and verify each step before
moving to the next, and commit after each completed step with a clear message.

## Tech Stack

- **Framework:** Next.js (App Router, latest stable) with React Server Components
- **Language:** TypeScript in strict mode
- **Styling/UI:** Tailwind CSS and shadcn/ui
- **Database:** PostgreSQL accessed through Prisma ORM
- **Auth:** Auth.js (NextAuth v5) with the Prisma adapter, credentials + optional OAuth
- **Validation:** Zod for all inputs (forms, server actions, route handlers)
- **Forms/Data:** React Hook Form + Zod resolvers; TanStack Table for data grids

## General Rules

- Keep business logic in server actions or a `lib/services` layer, not in components.
- Enforce authorization on the server for every read and write, never only in the UI.
- Validate every input with Zod and return typed, user-friendly errors.
- Use soft deletes (`deletedAt`) for core HR records and keep an audit trail.
- Write clean, typed, modular code; no `any`. Add tests for services and RBAC rules.
- Keep `README.md` and `.env.example` up to date as you go.

---

## Phase 1: Foundation

### 1. Inspect the existing repository
- Review the current structure, files, dependencies and git history.
- Identify what already exists and what is missing; do not overwrite working code.
- Write a short summary of findings and the plan before making changes.

### 2. Initialize the Next.js project (if needed)
- If no Next.js app exists, scaffold one with the App Router, TypeScript, ESLint,
  Tailwind CSS and the `src/` directory, using the `@/*` import alias.
- Set up Prettier, ESLint rules and npm scripts: `dev`, `build`, `lint`,
  `typecheck`, `test`, `db:migrate`, `db:seed`, `db:studio`.

### 3. Configure TypeScript, Tailwind CSS and shadcn/ui
- Enable `strict`, `noUncheckedIndexedAccess` and path aliases in `tsconfig.json`.
- Configure Tailwind with design tokens (CSS variables) and light/dark themes.
- Initialize shadcn/ui and add the base components: button, input, label, form,
  card, table, dialog, dropdown-menu, select, badge, avatar, tabs, toast/sonner,
  sheet, skeleton, calendar, popover.

### 4. Configure Prisma and PostgreSQL
- Install Prisma and initialize it with the PostgreSQL provider.
- Add a `docker-compose.yml` for a local PostgreSQL instance.
- Create a singleton Prisma client in `src/lib/db.ts` that is safe for hot reload.
- Document `DATABASE_URL` and the other required variables in `.env.example`.

### 5. Create the database schema and initial migrations
Design a normalized schema covering at least:
- **Auth:** `User`, `Account`, `Session`, `VerificationToken`
- **RBAC:** `Role`, `Permission`, `RolePermission`, `UserRole`
- **Organization:** `Department` (self-referencing parent), `Position`/`JobTitle`, `Location`
- **People:** `Employee` (linked to `User`, `Department`, `Position`, and a
  self-referencing `manager`), employment status, type and hire/termination dates
- **Attendance:** `AttendanceRecord` (clock in/out, status, notes)
- **Leave:** `LeaveType`, `LeaveBalance`, `LeaveRequest` (status workflow, approver)
- **Recruitment:** `JobOpening`, `Candidate`, `Application` (pipeline stage),
  `Interview`, `InterviewFeedback`, `Offer`
- **Audit:** `AuditLog` (actor, action, entity, entity id, diff, timestamp)

Requirements:
- Use enums for statuses, `createdAt`/`updatedAt` on all models, and indexes on
  foreign keys and common filter columns.
- Generate the initial migration with `prisma migrate dev --name init`.
- Write an idempotent seed script with default roles, permissions, an admin user,
  sample departments, employees, leave types and a job opening.

### 6. Implement authentication and RBAC
- Configure Auth.js with the Prisma adapter, credentials login (bcrypt/argon2
  hashed passwords) and JWT or database sessions that include the user's roles.
- Build sign-in, sign-out and password reset pages using shadcn/ui.
- Define roles: `SUPER_ADMIN`, `HR_ADMIN`, `HR_MANAGER`, `MANAGER`, `EMPLOYEE`.
- Define granular permissions as `resource:action`, for example
  `employee:read`, `employee:write`, `leave:approve`, `recruitment:manage`.
- Implement helpers such as `getCurrentUser()`, `requireAuth()`,
  `requirePermission(permission)` and `can(user, permission, resource?)`, with
  scope rules: employees see their own data, managers see their reports, and HR sees everyone.
- Protect routes with middleware and guard every server action and route handler.
- Add unit tests for the permission checks.

**Phase 1 is done when** the app builds, lints and type-checks cleanly,
migrations and seed run on a fresh database, and a seeded admin can sign in and
reach a protected page while unauthorized users are blocked.

---

## Phase 2: Core HR Modules

### 1. Build the application shell and dashboard
- Create an authenticated layout with a sidebar, top bar, breadcrumbs, user menu,
  theme toggle and a mobile-friendly navigation drawer.
- Generate navigation items from the user's permissions.
- Build a role-aware dashboard with KPI cards (headcount, new hires, on leave
  today, open positions, pending approvals), recent activity and quick actions.
- Add loading skeletons, empty states, error boundaries and a 404 page.

### 2. Implement employee management
- Employee directory with search, filters (department, status, location),
  sorting and pagination.
- Create, edit and view employee profiles with tabs for personal details, job
  details, emergency contacts, documents and history.
- Onboarding (create linked user account and invite) and offboarding
  (termination, deactivation) workflows.
- CSV import/export, profile photos, soft delete and audit logging.

### 3. Implement departments and organizational hierarchy
- CRUD for departments with parent/child nesting and department heads.
- Manage positions/job titles and reporting lines (employee → manager).
- Interactive org chart view, plus department detail pages with member lists.
- Prevent circular hierarchies and handle reassignment when a department is removed.

### 4. Implement attendance and leave management
- **Attendance:** clock in/out, daily and monthly views, manual corrections
  with approval, late/absent status, and exportable reports.
- **Leave types and policies:** accrual rules, annual allowance, carry-over.
- **Leave requests:** apply with date range and half-day support, overlap and
  balance validation, and holiday/weekend exclusion.
- **Approval workflow:** manager → HR, with approve/reject comments and
  notifications.
- Team leave calendar, balance overview per employee and a pending-approvals queue.

### 5. Implement recruitment
- **Job openings:** create, publish, close, with department, position,
  headcount, description and requirements.
- **Candidates:** profiles with resume upload, source, tags and notes.
- **Application pipeline:** Kanban board with stages (Applied → Screening →
  Interview → Offer → Hired/Rejected) and drag-and-drop stage changes.
- **Interviews:** scheduling, assigned interviewers, structured feedback and
  ratings.
- **Offers:** create, track status, and convert a hired candidate into an
  employee record (pre-filling onboarding).
- Recruitment metrics on the dashboard: open roles, pipeline counts and time to hire.

**Phase 2 is done when** every module enforces RBAC on the server, all forms
validate input, key flows have tests, and the app builds, lints and type-checks
cleanly.

---

## Deliverables After Each Phase

1. A summary of what was built and any decisions or trade-offs made.
2. Updated `README.md` with setup steps (env, Docker, migrate, seed, run).
3. Seed credentials for each role for manual testing.
4. A list of known limitations and suggested next steps.
