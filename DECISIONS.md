# IFlow — Agent-Resolved Decisions

This file documents every implementation choice the agent made that was not explicitly specified in the product spec.

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | UI font | Geist (sans) + JetBrains Mono (mono) | Geist is the de-facto Next.js house font; JetBrains Mono is best-in-class for IDs/timestamps |
| 2 | shadcn/ui style | `new-york` | More polished card and input styles than the default `default` style |
| 3 | Login rate limiting | In-memory counter (10 attempts, 1 min lockout) | Zero infrastructure cost; suitable for 5–7 users on a single Vercel serverless function instance |
| 4 | Board CSS layout | CSS scroll-snap horizontal flex with `board-canvas` class | Custom CSS preserves full viewport height; simpler than a JS scroll library |
| 5 | Drag-and-drop library | `@dnd-kit/core` + `@dnd-kit/sortable` | Actively maintained, accessible, tree-shakeable; better than `react-beautiful-dnd` (unmaintained) |
| 6 | Animations | Framer Motion for ticket card spring hover and panel slide-in | Zero-config spring physics, works with dnd-kit overlay |
| 7 | Charts | Recharts | Lightweight, React-native, no extra config needed |
| 8 | State management | Zustand | Minimal boilerplate; only UI-ephemeral state lives here (open panel, filters) |
| 9 | Ticket detail fetch | `fetch('/api/tickets/[id]')` from client on panel open | Avoids over-fetching all ticket details on initial board load |
| 10 | Password change flow | Sign out → redirect to `/login?changed=1` | Cleanest way to refresh JWT `mustChangePassword` flag without re-implementing token refresh |
| 11 | Seed users | 7 pre-defined users across all 4 departments | Matches "5–7 members across Dev, Design, Marketing" from spec |
| 12 | Auth config split | `auth.config.ts` (edge) + `auth.ts` (Node.js) | NextAuth v5 requires edge-compatible config for middleware; `bcryptjs` cannot run in Edge Runtime |
| 13 | Prisma seed exclusion | `prisma/seed.ts` excluded from `tsconfig.json` | Seed runs via `tsx` directly, not part of Next.js compilation |
| 14 | Avatar colors | 7 hardcoded hex values per user | Avoids runtime computation; consistent across sessions |
