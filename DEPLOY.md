# Deploying to Vercel

The app runs on Vercel with a Neon Postgres database and a private Vercel Blob
store for uploads. Every push to the connected branch redeploys automatically,
and each deploy applies pending database migrations before building.

## 1. Create the project

1. In Vercel, choose **Add New → Project** and import this GitHub repository.
   The framework is detected as Next.js. Leave the build command as the
   default; Vercel runs the `vercel-build` script, which is
   `prisma migrate deploy && next build`.
2. Don't deploy yet. Add storage and environment variables first.

## 2. Add Postgres (Neon)

1. In the project, open **Storage → Create Database → Neon** (Postgres) and
   connect it to all environments.
2. The integration adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`.
   Add one more variable so migrations use the direct connection:
   - `DIRECT_URL` = the value of `DATABASE_URL_UNPOOLED`

If you use a Neon project you created yourself, set `DATABASE_URL` to the
pooled connection string and `DIRECT_URL` to the direct one.

## 3. Add file storage (Vercel Blob)

Open **Storage → Create → Blob** and connect it to the project. This adds
`BLOB_READ_WRITE_TOKEN`.

Files are stored as private blobs and served only through the app's
access-checked `/api/files` route. Uploads are limited to 4 MB because Vercel
caps function request bodies at 4.5 MB.

## 4. Set environment variables

| Variable              | Value                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`         | Output of `npx auth secret` or `openssl rand -base64 32`. Use a different value per environment.                        |
| `AUTH_URL`            | Optional. Set it to your custom domain (e.g. `https://hr.example.com`). If unset, the Vercel production domain is used. |
| `SEED_ADMIN_EMAIL`    | The first administrator's email.                                                                                        |
| `SEED_ADMIN_PASSWORD` | A unique password of 12+ characters for that admin. The seed refuses weak or default passwords in production.           |

Then deploy. The first build creates every table.

## 5. Seed the database (once)

Seeding creates roles, permissions, leave types and the admin account. Run it
from your machine against the production database:

```bash
npx vercel env pull .env.production.local   # or copy the variables by hand
set -a; . ./.env.production.local; set +a
NODE_ENV=production npm run db:seed
```

Sign in as `SEED_ADMIN_EMAIL`, then set up departments, positions,
locations and holidays, and add employees one by one or by CSV import.

**Want a demo instead?** Add `SEED_DEMO_DATA=true` to the seed command to load
the sample organization. Its accounts share `SEED_DEMO_PASSWORD`, so only do
this on a preview or demo deployment, never one with real data.

## Before real employee data goes in

- **Email:** `src/lib/mail.ts` only logs messages, and Vercel function logs
  aren't a safe place for invitation and reset links. Connect a provider (e.g.
  Resend or Amazon SES) before inviting people.
- **Sign-in rate limiting:** add Vercel WAF rate-limit rules for `/sign-in` and
  `/forgot-password`, or an app-level limiter.
- **Region:** put the Vercel functions in the same region as the Neon database
  (Project Settings → Functions).

## Deploying from the CLI instead

```bash
npm i -g vercel
vercel link
vercel env add AUTH_SECRET production   # repeat for each variable above
vercel deploy --prod
```
