# Feedback & Tickets

A centralized feedback and ticket management system for managing support tickets and user feedback across multiple apps from a single admin panel.

## Features

- **Multi-App Support** — Manage tickets and feedback for multiple apps from one dashboard
- **Ticket Management** — Create, assign, prioritize, and track support tickets with SLA deadlines
- **Feedback Collection** — Collect star ratings and categorized feedback from users
- **Real-time Notifications** — WebSocket-powered live notifications for admins
- **Email Notifications** — Automated emails for ticket updates, comments, and feedback replies
- **Per-App Email/SMTP** — Each app can have its own sender email and SMTP server
- **File Uploads** — Attach files to tickets and feedback
- **User Management** — Role-based access (user, admin, super_admin), ban/unban users
- **Google OAuth** — Mobile app users authenticate via Google
- **Analytics Dashboard** — Ticket stats, feedback ratings, SLA breach tracking

## Tech Stack

| Component   | Technology                          |
|-------------|-------------------------------------|
| Backend     | Node.js, Express, TypeScript        |
| Database    | MySQL with Prisma ORM               |
| Admin Panel | React, Vite, Tailwind CSS           |
| Auth        | JWT, Google OAuth                   |
| Real-time   | WebSocket (ws)                      |
| Email       | Nodemailer (per-app SMTP support)   |

## Project Structure

```
feedback/
├── server/             # Express API server
│   ├── src/
│   │   ├── routes/     # API route handlers
│   │   ├── services/   # Business logic
│   │   ├── middleware/  # Auth, API key, admin guards
│   │   └── config.ts   # App configuration
│   └── prisma/         # Schema & migrations
├── admin/              # React admin panel
│   └── src/
│       ├── pages/      # Dashboard, Tickets, Feedback, Apps, Users, Settings
│       └── components/ # Shared UI components
└── docs/               # Documentation
    ├── api.md          # API reference
    └── deployment.md   # Deployment guide
```

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+

### Setup

```bash
# Server
cd server
cp .env.example .env    # Edit with your database & SMTP credentials
npm install
npx prisma generate
npx prisma migrate deploy
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="yourpassword" npm run db:seed:prod
npm run dev

# Admin Panel (separate terminal)
cd admin
npm install
npm run dev
```

The admin panel runs at `http://localhost:5173` and the API at `http://localhost:3000`.

## API Integration

Mobile apps authenticate via Google OAuth and use an API key per app:

```
Authorization: Bearer <JWT token>
x-api-key: <app API key>
```

Key endpoints:

| Method | Endpoint                  | Description          |
|--------|---------------------------|----------------------|
| POST   | `/auth/google`            | Google OAuth login   |
| POST   | `/tickets`                | Create ticket        |
| GET    | `/tickets`                | List my tickets      |
| POST   | `/tickets/:id/comments`   | Add comment          |
| POST   | `/feedbacks`              | Submit feedback      |
| GET    | `/feedbacks`              | List my feedbacks    |

See [docs/api.md](docs/api.md) for the full API reference.

## App Integration

- [Flutter Integration Guide](docs/app-integration.md) — Complete Flutter setup with service class, UI examples, and auth flow
- [Android Native Guide](docs/android-integration.md) — Kotlin + OkHttp setup with Google Sign-In, API client, and UI examples

## Deployment

See [docs/deployment.md](docs/deployment.md) for the full deployment guide covering:

- Ubuntu server setup (Node.js, MySQL, Nginx, PM2)
- SSL with Certbot
- Per-app email/SMTP configuration
- Database backups
- DNS configuration

## License

MIT
