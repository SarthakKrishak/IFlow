# IFlow — Internal Project & Ticket Tracker

IFlow is Imaginum's internal Kanban/ticket tracker. Built with Next.js 15, Supabase, and Prisma.

## Overview

IFlow is designed to streamline our internal workflows, track project tickets, and enhance team collaboration across all departments (Dev, Design, Marketing, and General). It features real-time presence tracking, drag-and-drop Kanban boards, ticket assignment, and detailed activity logging.

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

## Local Setup

To get this project running on your local machine, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd IFlow
   ```

2. **Install dependencies:**
   This project uses `pnpm`.
   ```bash
   pnpm install
   ```

3. **Set up Environment Variables:**
   Copy `.env.example` to `.env` and fill in your Supabase database credentials and NextAuth secret.
   ```bash
   cp .env.example .env
   ```

4. **Initialize Database:**
   Generate the Prisma client and push the schema to your database.
   ```bash
   pnpm prisma generate
   pnpm prisma db push
   ```

5. **Start the Development Server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---
*Developed By Imaginum*
