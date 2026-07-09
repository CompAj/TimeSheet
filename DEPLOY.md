# Deploy Timesheet

This app runs on **Vercel** (Next.js) with a hosted **PostgreSQL** database and **Clerk** for authentication.

## 1. Create a production database

Use any managed Postgres provider:

- [Neon](https://neon.tech) (recommended, free tier)
- [Supabase](https://supabase.com)
- [Vercel Postgres](https://vercel.com/storage/postgres)

Copy the connection string. It should look like:

```txt
postgresql://user:password@host/dbname?sslmode=require
```

## 2. Set up Clerk (production)

1. In [Clerk Dashboard](https://dashboard.clerk.com), create or switch to a **production** instance.
2. Copy these keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
3. Under **Webhooks**, add an endpoint:
   - URL: `https://YOUR_DOMAIN/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy `CLERK_WEBHOOK_SIGNING_SECRET`

## 3. Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Set **Root Directory** to `timesheet` if the repo root is the parent folder.
4. Add environment variables:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Your Postgres connection string |
| `ADMIN_EMAIL` | `anjanasinghe@gmail.com` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk |
| `CLERK_SECRET_KEY` | From Clerk |
| `CLERK_WEBHOOK_SIGNING_SECRET` | From Clerk webhook |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL` | `/dashboard` |

5. Deploy. The build runs `prisma migrate deploy` automatically, so all database tables are created.

## 4. Bootstrap your admin account

After the first successful deploy, run this **once** against the production database:

```bash
# Install Vercel CLI if needed: npm i -g vercel
vercel env pull .env.production.local
source .env.production.local  # or export vars manually on Windows

pnpm db:bootstrap
```

Or run locally with the production `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://..." ADMIN_EMAIL="anjanasinghe@gmail.com" pnpm db:bootstrap
```

This creates:

- A user record with role **ADMIN** for `anjanasinghe@gmail.com`
- A pending invitation so Clerk sign-in can link the account

## 5. Sign in

1. Open your deployed site (e.g. `https://your-app.vercel.app`).
2. Sign up or sign in with **anjanasinghe@gmail.com** (must match `ADMIN_EMAIL` exactly).
3. Clerk links your account; you land on the dashboard as **ADMIN**.

You can then manage users at **Users** in the nav.

## Local development (optional)

```bash
docker compose up -d          # start Postgres
cp .env.example .env          # fill in Clerk keys
pnpm prisma migrate dev
pnpm db:bootstrap             # creates your admin locally
pnpm dev
```

Demo sample data (fake employees/timesheets) is optional:

```bash
pnpm prisma:seed
```

Do **not** run `prisma:seed` on production unless you want demo data.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Access denied after sign-in | Run `pnpm db:bootstrap` and ensure the Clerk email matches `ADMIN_EMAIL`. |
| Build fails on migrate | Check `DATABASE_URL` is set in Vercel and allows connections from Vercel IPs. |
| Webhook not syncing | Confirm webhook URL and `CLERK_WEBHOOK_SIGNING_SECRET` in Vercel env vars. |
