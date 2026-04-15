# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack support ticket and feedback management system. Two separate npm projects: `server/` (Express API) and `admin/` (React dashboard). No monorepo tooling — each has its own package.json.

## Commands

### Server (`cd server/`)
- `npm run dev` — Start dev server with hot-reload (tsx watch)
- `npm run build` — Compile TypeScript (`tsc`)
- `npm start` — Run production build (`node dist/index.js`)
- `npm run db:migrate` — Run Prisma migrations (`prisma migrate dev`)
- `npm run db:generate` — Regenerate Prisma client
- `npm run db:seed` — Seed dev data
- `npm run db:seed:prod` — Seed production data

### Admin (`cd admin/`)
- `npm run dev` — Vite dev server on port 5173
- `npm run build` — Type-check + Vite build (`tsc -b && vite build`)
- `npm run lint` — ESLint
- `npm run preview` — Preview production build

### Production deploy
```
git pull && npm run build
pm2 restart server
```

## Architecture

### Server (`server/src/`)
- **Entry**: `index.ts` — Express app, HTTP server, WebSocket on `/ws`, mounts 6 route modules
- **Routes**: `auth`, `tickets`, `feedback`, `admin`, `notifications`, `device-tokens`
- **Middleware**: JWT auth (`auth.ts`), admin role guard (`adminGuard.ts`), API key validation (`appKey.ts`)
- **Services**: Business logic layer — `ticket`, `feedback`, `user`, `email`, `notification`, `fcm`, `analytics`
- **Database**: Prisma with MySQL, 13 models. Schema at `prisma/schema.prisma`
- **Config**: `config.ts` reads env vars (port, JWT secret, SMTP, SLA hours)

### Admin (`admin/src/`)
- **Stack**: React 19 + React Router 7 + Vite + Tailwind CSS v4
- **API client**: `api.ts` — Axios with JWT interceptor, 401 auto-logout
- **Types**: `types.ts` — TypeScript interfaces mirroring Prisma models
- **Pages**: Login, Dashboard, TicketList, TicketDetail, FeedbackList, FeedbackDetail, Users, Apps, Settings
- **Vite proxy**: `/api` requests proxied to `http://localhost:3000` (path rewritten to strip `/api`)

### Auth
- **Mobile users**: Google OAuth (`POST /auth/google` with idToken + x-api-key header) → JWT (7-day)
- **Admin panel**: Email/password (`POST /auth/admin/login`) → JWT. Super admins register new admins via `/auth/admin/register`

### Real-time
- WebSocket at `/ws?token=<jwt>` — broadcasts new tickets, updates, comments, feedback to connected admins
- `broadcastToUser()` and `broadcastToAll()` in `websocket.ts`

### Email System
- Per-app SMTP config (falls back to global env SMTP)
- Transporter cached per host:port:user combo
- HTML templates in `email.service.ts` with `emailLayout()` wrapper supporting app icons
- Sends on: ticket create, status change, comments, feedback, admin notifications

### Key Business Logic
- **SLA**: Auto-calculated deadlines (critical: 4h, high: 24h, medium: 72h, low: 168h) in `utils/sla.ts`
- **Auto-assignment**: Tickets assigned to admin with fewest open tickets
- **Ticket history**: Full audit trail of field changes with user attribution
- **Notification preferences**: Per-user, per-type (in_app, email) opt-in

## Database Enums
- `UserRole`: user, admin, super_admin
- `Priority`: low, medium, high, critical
- `TicketStatus`: open, in_progress, resolved, closed
- `FeedbackStatus`: new, acknowledged, in_progress, resolved
- `FeedbackCategory`: bug_report, feature_request, suggestion, complaint, general

## Notes
- No test framework is configured
- Tailwind v4 uses `@tailwindcss/vite` plugin (config lives in CSS, no tailwind.config)
- File uploads via Multer (10MB limit), stored in `server/uploads/`
- Dashboard uses Recharts for charts and a custom `useCountUp` hook for animated counters — all hooks must be called before the `if (loading) return` early return to avoid React rules-of-hooks violations
