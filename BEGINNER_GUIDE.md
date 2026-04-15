# Beginner's Learning Guide — Feedback & Tickets System

A structured learning roadmap for someone new to web development who wants to understand
and contribute to this project. Follow the phases in order — each builds on the previous one.

---

## Phase 1: Absolute Foundations (Week 1–2)

### 1.1 How the Web Works
- What is a **client** and a **server**?
- HTTP protocol basics: request/response cycle
- HTTP methods: `GET`, `POST`, `PATCH`, `DELETE`
- Status codes: `200`, `201`, `400`, `401`, `403`, `404`, `500`
- Headers, request body (JSON), and query parameters
- What is an API? What is REST?

> **Why it matters for this project:** Every feature — tickets, feedback, auth — works through
> HTTP API calls between the React admin panel and the Express backend.

### 1.2 HTML & CSS Basics
- HTML tags, attributes, forms, inputs, buttons
- CSS selectors, box model, flexbox, grid
- Responsive design concepts (mobile vs desktop)

> **Why it matters:** The admin panel renders HTML and uses CSS (via Tailwind) for layout and styling.

### 1.3 JavaScript Fundamentals
- Variables (`let`, `const`), data types, operators
- Functions (regular, arrow functions)
- Arrays and Objects — iteration, destructuring, spread operator
- `if/else`, `switch`, loops (`for`, `for...of`, `.map()`, `.filter()`)
- Template literals (backtick strings)
- **Promises and `async/await`** (critical — used everywhere in this project)
- `try/catch` error handling
- ES Modules (`import`/`export`)
- JSON — `JSON.parse()`, `JSON.stringify()`

> **Why it matters:** Both the server and the admin panel are written in JavaScript/TypeScript.
> Async/await is used in every API route, service, and React component.

---

## Phase 2: Core Technologies (Week 3–5)

### 2.1 TypeScript
- What is TypeScript and why use it over plain JavaScript?
- Type annotations: `string`, `number`, `boolean`, `array`, `object`
- Interfaces and type aliases
- Optional properties (`?`) and union types (`|`)
- Enums (e.g., `UserRole`, `Priority`, `TicketStatus`)
- Generics (basic understanding)

> **Used in this project:**
> - `admin/src/types.ts` — defines all frontend data shapes (Ticket, Feedback, User, App)
> - `server/src/` — all backend code is TypeScript
> - Prisma generates types from the database schema automatically

### 2.2 Node.js
- What is Node.js? (JavaScript runtime outside the browser)
- `npm` — package manager, `package.json`, `node_modules`
- Running scripts: `npm install`, `npm run dev`, `npm run build`
- Environment variables and `.env` files
- The `require`/`import` module system

> **Used in this project:**
> - `server/package.json` — all backend dependencies
> - `npm run dev` starts the backend with hot-reload (`tsx watch`)

### 2.3 Express.js (Backend Framework)
- Creating a server with `express()`
- Routes: `app.get()`, `app.post()`, `app.patch()`, `app.delete()`
- Route parameters (`:id`) and query parameters (`?page=1&limit=10`)
- Request object (`req.body`, `req.params`, `req.query`)
- Response object (`res.json()`, `res.status()`)
- **Middleware** — what it is, how it works, `next()` function
  - Authentication middleware
  - Error handling middleware
  - CORS middleware
- Router — splitting routes into separate files
- Serving static files (`express.static`)

> **Used in this project:**
> - `server/src/index.ts` — main Express app setup
> - `server/src/routes/` — 6 route files (auth, tickets, feedback, admin, notifications, device-tokens)
> - `server/src/middleware/` — auth.ts, adminGuard.ts, appKey.ts

### 2.4 React (Frontend Framework)
- What is React? Component-based UI library
- JSX syntax — HTML inside JavaScript
- **Functional components** (this project uses only functional components)
- **Props** — passing data to child components
- **Hooks** (master these — they are used on every page):
  - `useState` — managing component state
  - `useEffect` — side effects (API calls, subscriptions)
  - `useNavigate`, `useParams`, `useLocation` — React Router hooks
- Conditional rendering (`{condition && <Component />}`, ternary)
- Lists and `.map()` — rendering arrays of data
- Event handling (`onClick`, `onChange`, `onSubmit`)
- Forms — controlled inputs with `useState`
- **React Router** — client-side navigation, route params, protected routes

> **Used in this project:**
> - `admin/src/App.tsx` — main router and layout
> - `admin/src/pages/` — 9 page components
> - Every page uses useState + useEffect to fetch and display API data

### 2.5 Tailwind CSS
- Utility-first CSS framework — no writing custom CSS
- Common classes: `flex`, `grid`, `p-4`, `m-2`, `text-lg`, `bg-blue-500`, `rounded`
- Responsive prefixes: `sm:`, `md:`, `lg:`
- State variants: `hover:`, `focus:`
- Color system: `text-red-500`, `bg-emerald-100`

> **Used in this project:** Every React component uses Tailwind for styling.
> Priority badges use color-coded Tailwind classes (red for critical, amber for high, etc.)

---

## Phase 3: Database & ORM (Week 5–6)

### 3.1 Relational Databases (MySQL)
- What is a database? Tables, rows, columns
- Data types: VARCHAR, INT, BOOLEAN, DATETIME, TEXT, ENUM
- Primary keys and auto-increment IDs
- **Foreign keys** — relating tables together (e.g., ticket belongs to a user)
- Relationships: one-to-many, many-to-many (junction tables)
- Basic SQL: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `WHERE`, `JOIN`
- Indexes for performance

> **Used in this project:** MySQL 8.0 stores all data — users, apps, tickets, feedback, notifications.

### 3.2 Prisma ORM
- What is an ORM? Why use one instead of raw SQL?
- **Schema file** — `schema.prisma` defines models, relations, and enums
- **Models** map to database tables
- **Relations**: `@relation`, `fields`, `references`
- **Migrations**: `prisma migrate dev` — version-controlled schema changes
- **Prisma Client** — auto-generated TypeScript client for queries:
  - `prisma.ticket.findMany()` — read records
  - `prisma.ticket.create()` — insert records
  - `prisma.ticket.update()` — modify records
  - `prisma.ticket.delete()` — remove records
  - Nested includes (`include: { user: true, app: true }`)
  - Filtering (`where`), sorting (`orderBy`), pagination (`skip`, `take`)
- Seeding — `prisma db seed` to populate initial data

> **Used in this project:**
> - `server/prisma/schema.prisma` — 13 models defining the entire data structure
> - Every service and route uses Prisma Client for database operations
> - 12 migrations tracking schema evolution

---

## Phase 4: Authentication & Security (Week 6–7)

### 4.1 Authentication Concepts
- Authentication vs Authorization
- Password hashing — **never store plain text passwords**
- bcrypt: `hash()` and `compare()` functions
- Sessions vs Tokens

### 4.2 JWT (JSON Web Tokens)
- What is a JWT? (header.payload.signature)
- `jwt.sign()` — creating tokens (on login)
- `jwt.verify()` — validating tokens (on each request)
- Token expiration
- Storing tokens on the client (localStorage)
- Sending tokens in HTTP headers (`Authorization: Bearer <token>`)

> **Used in this project:**
> - `server/src/middleware/auth.ts` — JWT verification on every protected route
> - `admin/src/api.ts` — Axios interceptor attaches JWT to every request
> - Tokens expire after 7 days

### 4.3 OAuth 2.0 / Google Sign-In
- What is OAuth? Third-party authentication
- Google OAuth flow: user signs in with Google → app gets ID token → server verifies
- `google-auth-library` — verifying Google ID tokens
- Why per-app Client IDs are needed

> **Used in this project:**
> - Mobile apps authenticate users via Google Sign-In
> - `server/src/middleware/auth.ts` — `googleAuth()` handler

### 4.4 Role-Based Access Control (RBAC)
- What are roles? (user, admin, super_admin)
- Middleware guards — checking user role before allowing access
- API key validation for app identification

> **Used in this project:**
> - `adminGuard.ts` — blocks non-admin users from admin routes
> - `appKey.ts` — validates API key for mobile app requests
> - Per-app admin assignment (AppAdmin junction table)

---

## Phase 5: Advanced Backend Concepts (Week 7–9)

### 5.1 File Uploads
- Multipart form data — how file uploads differ from JSON
- **Multer** middleware — handling file uploads in Express
- File storage strategies (disk vs cloud)
- File size limits and validation
- Serving uploaded files as static assets
- Cleanup: deleting files when records are deleted

> **Used in this project:**
> - `server/src/index.ts` — Multer config (10MB limit, stored in /uploads)
> - Ticket and feedback attachments
> - Files deleted from disk when parent record is deleted

### 5.2 Email Sending (SMTP / Nodemailer)
- What is SMTP? How email delivery works
- Nodemailer: creating transporters, sending emails
- SMTP configuration (host, port, user, password)
- HTML email templates
- Per-app vs global SMTP configuration

> **Used in this project:**
> - `server/src/services/email.service.ts` — sends emails for ticket updates, feedback replies
> - Each app can have its own SMTP configuration

### 5.3 WebSockets (Real-time Communication)
- HTTP vs WebSocket — request/response vs persistent connection
- When to use WebSockets (live notifications, chat)
- The `ws` library in Node.js
- Connection lifecycle: open, message, close
- Broadcasting messages to connected clients
- Authentication over WebSocket (token in query params)

> **Used in this project:**
> - `server/src/websocket.ts` — WebSocket server for live admin notifications
> - `admin/src/App.tsx` — connects to WebSocket and shows real-time notifications

### 5.4 Push Notifications (Firebase Cloud Messaging)
- What are push notifications?
- Firebase Cloud Messaging (FCM) setup
- Device token registration and management
- Sending notifications from server to mobile devices
- Per-app Firebase configuration

> **Used in this project:**
> - `server/src/services/fcm.service.ts` — sends push notifications to mobile users
> - Device tokens registered per user per app

### 5.5 Service Layer Pattern
- Separating business logic from route handlers
- Why: cleaner code, reusable logic, easier testing
- Services handle: database queries, email sending, notification creation, SLA calculation

> **Used in this project:**
> - `server/src/services/` — 7 service files
> - Routes call services instead of doing everything inline

---

## Phase 6: Frontend Advanced (Week 9–10)

### 6.1 HTTP Client (Axios)
- What is Axios? Making HTTP requests from the browser
- GET, POST, PATCH, DELETE requests
- Request/response interceptors (attaching auth tokens automatically)
- Error handling with Axios

> **Used in this project:**
> - `admin/src/api.ts` — Axios instance with JWT interceptor and base URL config

### 6.2 Data Fetching Patterns in React
- Fetching data in `useEffect` on component mount
- Loading states (show spinner while data loads)
- Error states (show error message on failure)
- Pagination (page number + limit)
- Filtering and searching

> **Used in this project:** Every page follows this pattern:
> ```
> useState for data, loading, error
> useEffect to fetch data on mount
> Render loading spinner → data → or error
> ```

### 6.3 Forms and User Input
- Controlled components (input value tied to state)
- Form submission handling (`onSubmit`, `preventDefault`)
- File input handling
- Validation and error display
- Modal dialogs for create/edit operations

### 6.4 Data Visualization (Recharts)
- Chart types: PieChart, BarChart, AreaChart
- Data format for charts
- Customizing colors, labels, tooltips

> **Used in this project:**
> - `admin/src/pages/Dashboard.tsx` — analytics charts for tickets and feedback stats

### 6.5 Build Tools (Vite)
- What is a build tool and why do we need one?
- Development server with hot module replacement (HMR)
- **Proxy configuration** — forwarding `/api` requests to the backend
- Production builds (`npm run build`)
- Environment variable handling

> **Used in this project:**
> - `admin/vite.config.ts` — Vite config with API proxy to Express backend

---

## Phase 7: DevOps & Deployment Basics (Week 11)

### 7.1 Git & Version Control
- `git init`, `add`, `commit`, `push`, `pull`
- Branches and merging
- `.gitignore` — what to exclude (node_modules, .env, uploads)

### 7.2 Environment Management
- Development vs Production environments
- `.env` files — keeping secrets out of code
- `.env.example` — documenting required variables

### 7.3 Deployment Concepts
- Building for production (`tsc` for server, `vite build` for admin)
- Process managers (PM2, systemd)
- Reverse proxy (Nginx)
- SSL/HTTPS certificates
- Database backups

> **Reference:** `docs/deployment.md` covers the full deployment process for this project.

---

## Project-Specific Concepts to Understand

| Concept | Where It's Used | Why It Matters |
|---------|----------------|----------------|
| Multi-tenancy | Apps table, API keys | One system serves multiple client apps |
| SLA (Service Level Agreement) | `server/src/utils/sla.ts` | Auto-calculates response deadlines by priority |
| Auto-assignment | `ticket.service.ts` | Tickets auto-assigned to least-busy admin |
| Audit trail | TicketHistory model | Tracks every change to a ticket |
| Per-app configuration | App model (SMTP, OAuth, Firebase) | Each app can have independent settings |
| Junction tables | AppAdmin | Many-to-many: admins ↔ apps |

---

## Suggested Learning Path (mapped to this project)

```
Week 1-2:  HTML, CSS, JavaScript basics
           → Try reading admin/src/pages/Login.tsx (simplest page)

Week 3:    TypeScript + Node.js
           → Read server/src/config.ts and server/src/index.ts

Week 4:    Express.js
           → Read server/src/routes/auth.ts (simplest route file)
           → Read server/src/middleware/auth.ts

Week 5:    React fundamentals
           → Read admin/src/pages/Dashboard.tsx
           → Read admin/src/components/Avatar.tsx (simplest component)

Week 6:    Prisma + MySQL
           → Read server/prisma/schema.prisma (the entire data model)
           → Read server/src/services/ticket.service.ts

Week 7:    Authentication (JWT + OAuth + RBAC)
           → Read server/src/middleware/auth.ts
           → Read admin/src/api.ts

Week 8:    File uploads + Email
           → Read server/src/services/email.service.ts

Week 9:    WebSockets + FCM
           → Read server/src/websocket.ts
           → Read server/src/services/fcm.service.ts

Week 10:   Full-stack integration
           → Read admin/src/pages/TicketDetail.tsx (most complex page)
           → Read server/src/routes/admin.ts (most complex route)

Week 11:   Deployment
           → Read docs/deployment.md
```

---

## Recommended Free Resources

| Topic | Resource |
|-------|----------|
| JavaScript | [javascript.info](https://javascript.info) |
| TypeScript | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) |
| React | [react.dev](https://react.dev/learn) |
| Express | [expressjs.com](https://expressjs.com/en/starter/hello-world.html) |
| Prisma | [prisma.io/docs](https://www.prisma.io/docs/getting-started) |
| Tailwind CSS | [tailwindcss.com/docs](https://tailwindcss.com/docs) |
| SQL Basics | [sqlbolt.com](https://sqlbolt.com) |
| Git | [learngitbranching.js.org](https://learngitbranching.js.org) |
| JWT | [jwt.io/introduction](https://jwt.io/introduction) |

---

## Quick Glossary

| Term | Meaning |
|------|---------|
| **API** | Application Programming Interface — how frontend talks to backend |
| **REST** | A style of designing APIs using HTTP methods and URLs |
| **JWT** | JSON Web Token — a signed token for authentication |
| **ORM** | Object-Relational Mapping — talk to database using code instead of SQL |
| **Middleware** | Function that runs between request and response in Express |
| **CRUD** | Create, Read, Update, Delete — the 4 basic database operations |
| **SMTP** | Protocol for sending emails |
| **WebSocket** | Persistent two-way connection between client and server |
| **FCM** | Firebase Cloud Messaging — push notifications for mobile |
| **SLA** | Service Level Agreement — guaranteed response time |
| **RBAC** | Role-Based Access Control — permissions based on user roles |
| **Migration** | Version-controlled database schema changes |
| **Seed** | Populating a database with initial/test data |
| **Proxy** | Forwarding requests from one server to another (Vite → Express) |
| **HMR** | Hot Module Replacement — code updates without full page reload |
