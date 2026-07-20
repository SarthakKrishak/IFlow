# IFlow — Internal Project & Ticket Tracker

IFlow is Imaginum's internal Kanban/ticket tracker. Built with Next.js 15, Supabase, Prisma, and deployed to Vercel. Free forever.

## Quick Start (Local Dev)

1. **Copy env file** and fill in your values:
   ```bash
   cp .env.example .env
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Run migrations + seed:**
   ```bash
   pnpm prisma migrate dev --name init
   pnpm db:seed
   ```

4. **Start dev server:**
   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment to Vercel + Supabase

### Step 1 — Supabase setup
1. Go to [supabase.com](https://supabase.com) → **New Project** (free, no card required).
2. Note these values from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. From **Project Settings → Database → Connection string → URI**, copy the `DATABASE_URL`.
4. **Enable Realtime** for `Ticket`, `Comment`, and `ActivityLog` tables:  
   Supabase Dashboard → Database → Replication → toggle these tables on.

### Step 2 — Push repo to GitHub
```bash
git remote add origin https://github.com/your-org/iflow.git
git push -u origin main
```

### Step 3 — Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project** → select your repo.
2. Vercel auto-detects Next.js. No build config needed.
3. In **Project Settings → Environment Variables**, add all 6 variables from `.env.example`.
4. Click **Deploy**.

### Step 4 — Run migrations (once)
From your local machine pointing at the prod DB:
```bash
DATABASE_URL=your_prod_url pnpm prisma migrate deploy
DATABASE_URL=your_prod_url pnpm db:seed
```

### Step 5 — Share with team
Share the `*.vercel.app` URL and each person's username + temp password (`iflow123`).  
Everyone must change their password on first login.

---

## Default Accounts

All use temp password `iflow123` — must change on first login.

| Username | Role | Dept |
|---|---|---|
| admin | ADMIN | General |
| dev1 | MEMBER | Dev |
| dev2 | MEMBER | Dev |
| designer1 | MEMBER | Design |
| marketer1 | MEMBER | Marketing |
| member1 | MEMBER | General |
| member2 | MEMBER | General |

---

## Tech Stack

- **Next.js 15** (App Router, TypeScript strict)
- **Tailwind CSS v3** + custom design tokens
- **Supabase** (Postgres + Realtime)
- **Prisma** (ORM + migrations)
- **NextAuth.js v5** (Credentials, JWT sessions)
- **dnd-kit** (drag & drop)
- **Framer Motion** (spring animations)
- **TanStack Query v5** (client cache)
- **Zustand** (UI state)
- **Recharts** (reports charts)
- **date-fns** (relative timestamps)

See `DECISIONS.md` for agent-resolved implementation choices.
