# Feedback & Tickets API Documentation

**Base URL:** `http://your-server:3000`

**Health Check:** `GET /health` → `{ "status": "ok", "timestamp": "..." }`

---

## Table of Contents

- [Authentication](#authentication)
- [Headers & Authorization](#headers--authorization)
- [Tickets](#tickets)
- [Feedbacks](#feedbacks)
- [Admin — Tickets](#admin--tickets)
- [Admin — Feedbacks](#admin--feedbacks)
- [Admin — Apps & Categories](#admin--apps--categories)
- [Admin — Users](#admin--users)
- [Admin — Analytics](#admin--analytics)
- [Notifications](#notifications)
- [WebSocket (Real-time)](#websocket-real-time)
- [SLA & Priority](#sla--priority)
- [File Uploads](#file-uploads)
- [Error Responses](#error-responses)
- [Integration Examples](#integration-examples)

---

## Authentication

### Google OAuth (Mobile Apps)

```http
POST /auth/google
Content-Type: application/json

{
  "idToken": "<Google ID Token>"
}
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

Creates a new user on first login, or returns existing user. Token is a JWT valid for **7 days**.

---

### Admin Login (Email + Password)

```http
POST /auth/admin/login
Content-Type: application/json

{
  "email": "admin@feedback.app",
  "password": "admin123"
}
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "uuid",
    "email": "admin@feedback.app",
    "name": "Admin",
    "role": "admin"
  }
}
```

**Errors:**
- `401` — Invalid credentials
- `403` — User is not an admin

---

### Register New Admin (Super Admin only)

```http
POST /auth/admin/register
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "email": "newadmin@feedback.app",
  "password": "securepass",
  "name": "New Admin"
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "email": "newadmin@feedback.app",
  "name": "New Admin",
  "role": "admin"
}
```

---

## Headers & Authorization

### User Endpoints (Tickets & Feedbacks)

| Header          | Required | Description                           |
| --------------- | -------- | ------------------------------------- |
| `Authorization` | Yes      | `Bearer <JWT token>`                  |
| `x-api-key`     | Yes      | Your app's API key (provided by admin) |

### Admin Endpoints

| Header          | Required | Description                      |
| --------------- | -------- | -------------------------------- |
| `Authorization` | Yes      | `Bearer <JWT token>` (admin role) |

> Admin endpoints do **not** require `x-api-key`.

---

## Tickets

All ticket endpoints require both `Authorization` and `x-api-key` headers.

### Create Ticket

```http
POST /tickets
Content-Type: application/json
```

**Request Body:**
| Field         | Type   | Required | Description                                |
| ------------- | ------ | -------- | ------------------------------------------ |
| `title`       | string | Yes      | Short summary of the issue                 |
| `description` | string | Yes      | Detailed description                       |
| `category`    | string | No       | Category label (e.g., "bug", "payment")    |
| `priority`    | enum   | No       | `low` \| `medium` \| `high` \| `critical` (default: `medium`) |

**Response `201`:**
```json
{
  "id": "uuid",
  "appId": "uuid",
  "userId": "uuid",
  "title": "Bug in payment screen",
  "description": "Payment fails when using Visa cards...",
  "category": "bug",
  "priority": "high",
  "status": "open",
  "assignedTo": null,
  "slaDeadline": "2026-02-18T12:00:00.000Z",
  "createdAt": "2026-02-17T12:00:00.000Z",
  "updatedAt": "2026-02-17T12:00:00.000Z",
  "user": { "id": "uuid", "name": "John Doe", "email": "john@gmail.com", "avatarUrl": null },
  "assignee": null,
  "app": { "id": "uuid", "name": "ShopEase" },
  "_count": { "comments": 0, "attachments": 0 }
}
```

**Side effects:**
- SLA deadline auto-calculated based on priority
- Email notification sent to user
- Real-time notification sent to all admins via WebSocket

---

### List My Tickets

```http
GET /tickets?page=1&limit=20
```

**Query Parameters:**
| Param   | Type   | Default | Description         |
| ------- | ------ | ------- | ------------------- |
| `page`  | number | 1       | Page number         |
| `limit` | number | 20      | Items per page      |

**Response `200`:**
```json
{
  "tickets": [ /* ticket objects */ ],
  "total": 42,
  "page": 1,
  "totalPages": 3
}
```

---

### Get Ticket Detail

```http
GET /tickets/:id
```

Returns ticket with comments (excluding internal admin notes), attachments, and change history. User can only access their own tickets.

**Response `200`:**
```json
{
  "id": "uuid",
  "title": "Bug in payment screen",
  "description": "...",
  "priority": "high",
  "status": "in_progress",
  "slaDeadline": "2026-02-18T12:00:00.000Z",
  "createdAt": "2026-02-17T12:00:00.000Z",
  "updatedAt": "2026-02-17T14:00:00.000Z",
  "user": { "id": "uuid", "name": "John Doe", "email": "john@gmail.com", "avatarUrl": null },
  "assignee": { "id": "uuid", "name": "Sarah Wilson", "email": "sarah@feedback.app" },
  "app": { "id": "uuid", "name": "ShopEase" },
  "comments": [
    {
      "id": "uuid",
      "body": "We're looking into this issue.",
      "isInternalNote": false,
      "createdAt": "2026-02-17T13:00:00.000Z",
      "user": { "id": "uuid", "name": "Sarah Wilson", "avatarUrl": null }
    }
  ],
  "attachments": [
    {
      "id": "uuid",
      "fileUrl": "/uploads/1708100000-123456789.png",
      "fileName": "screenshot.png",
      "fileSize": 245000,
      "createdAt": "2026-02-17T12:00:00.000Z"
    }
  ],
  "history": [
    {
      "id": "uuid",
      "field": "status",
      "oldValue": "open",
      "newValue": "in_progress",
      "createdAt": "2026-02-17T14:00:00.000Z",
      "user": { "id": "uuid", "name": "Sarah Wilson" }
    }
  ],
  "_count": { "comments": 1, "attachments": 1 }
}
```

**Errors:**
- `404` — Ticket not found
- `403` — Not your ticket

---

### Add Comment

```http
POST /tickets/:id/comments
Content-Type: application/json

{
  "body": "I've attached a screenshot of the error."
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "ticketId": "uuid",
  "userId": "uuid",
  "body": "I've attached a screenshot of the error.",
  "isInternalNote": false,
  "createdAt": "2026-02-17T13:00:00.000Z",
  "user": { "id": "uuid", "name": "John Doe", "avatarUrl": null }
}
```

**Side effects:** Email notification sent to ticket owner (if commenter is not the owner).

---

### Upload Attachment

```http
POST /tickets/:id/attachments
Content-Type: multipart/form-data

file: <binary file>
```

**Limits:** Max file size 10 MB.

**Response `201`:**
```json
{
  "id": "uuid",
  "ticketId": "uuid",
  "fileUrl": "/uploads/1708100000-123456789.png",
  "fileName": "screenshot.png",
  "fileSize": 245000,
  "createdAt": "2026-02-17T13:00:00.000Z"
}
```

---

## Feedbacks

All feedback endpoints require both `Authorization` and `x-api-key` headers.

### Submit Feedback

```http
POST /feedbacks
Content-Type: application/json

{
  "rating": 4,
  "category": "suggestion",
  "comment": "It would be great to have dark mode!"
}
```

**Request Body:**
| Field      | Type   | Required | Description                                                                  |
| ---------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `rating`   | number | Yes      | Star rating: `1` to `5`                                                     |
| `category` | enum   | No       | `bug_report` \| `feature_request` \| `suggestion` \| `complaint` \| `general` |
| `comment`  | string | No       | Optional text comment                                                        |

**Response `201`:**
```json
{
  "id": "uuid",
  "appId": "uuid",
  "userId": "uuid",
  "rating": 4,
  "category": "suggestion",
  "comment": "It would be great to have dark mode!",
  "createdAt": "2026-02-17T12:00:00.000Z",
  "user": { "id": "uuid", "name": "John Doe", "email": "john@gmail.com", "avatarUrl": null },
  "app": { "id": "uuid", "name": "ShopEase" },
  "_count": { "replies": 0 }
}
```

---

### List My Feedbacks

```http
GET /feedbacks?page=1&limit=20
```

**Response `200`:**
```json
{
  "feedbacks": [ /* feedback objects */ ],
  "total": 15,
  "page": 1,
  "totalPages": 1
}
```

---

### Get Feedback Detail

```http
GET /feedbacks/:id
```

**Response `200`:**
```json
{
  "id": "uuid",
  "rating": 4,
  "category": "suggestion",
  "comment": "It would be great to have dark mode!",
  "createdAt": "2026-02-17T12:00:00.000Z",
  "user": { "id": "uuid", "name": "John Doe", "email": "john@gmail.com", "avatarUrl": null },
  "app": { "id": "uuid", "name": "ShopEase" },
  "replies": [
    {
      "id": "uuid",
      "body": "Thanks! Dark mode is on our roadmap.",
      "createdAt": "2026-02-17T14:00:00.000Z",
      "user": { "id": "uuid", "name": "Admin", "avatarUrl": null }
    }
  ],
  "attachments": [
    {
      "id": "uuid",
      "fileUrl": "/uploads/1708100000-123456789.png",
      "fileName": "mockup.png",
      "fileSize": 180000,
      "createdAt": "2026-02-17T12:05:00.000Z"
    }
  ],
  "_count": { "replies": 1 }
}
```

---

### Upload Feedback Attachment

```http
POST /feedbacks/:id/attachments
Content-Type: multipart/form-data

file: <binary file>
```

**Limits:** Max file size 10 MB.

**Response `201`:**
```json
{
  "id": "uuid",
  "feedbackId": "uuid",
  "fileUrl": "/uploads/1708100000-123456789.png",
  "fileName": "mockup.png",
  "fileSize": 180000,
  "createdAt": "2026-02-17T12:05:00.000Z"
}
```

---

## Admin — Tickets

All admin endpoints require `Authorization: Bearer <token>` with `admin` or `super_admin` role.

### List All Tickets

```http
GET /admin/tickets?appId=uuid&status=open&priority=high&assignedTo=uuid&page=1&limit=20
```

**Query Parameters:**
| Param        | Type   | Required | Description                                      |
| ------------ | ------ | -------- | ------------------------------------------------ |
| `appId`      | string | No       | Filter by app                                    |
| `status`     | enum   | No       | `open` \| `in_progress` \| `resolved` \| `closed` |
| `priority`   | enum   | No       | `low` \| `medium` \| `high` \| `critical`        |
| `assignedTo` | string | No       | Filter by assignee user ID                       |
| `page`       | number | No       | Page number (default: 1)                         |
| `limit`      | number | No       | Items per page (default: 20)                     |

**Response `200`:**
```json
{
  "tickets": [
    {
      "id": "uuid",
      "title": "Bug in payment screen",
      "priority": "high",
      "status": "open",
      "category": "bug",
      "assignedTo": null,
      "slaDeadline": "2026-02-18T12:00:00.000Z",
      "createdAt": "2026-02-17T12:00:00.000Z",
      "updatedAt": "2026-02-17T12:00:00.000Z",
      "user": { "id": "uuid", "name": "John Doe", "email": "john@gmail.com" },
      "assignee": null,
      "app": { "id": "uuid", "name": "ShopEase" },
      "_count": { "comments": 3, "attachments": 1 }
    }
  ],
  "total": 42,
  "page": 1,
  "totalPages": 3
}
```

---

### Get Ticket Detail (Admin View)

```http
GET /admin/tickets/:id
```

Returns full ticket with **all comments (including internal notes)**, attachments, and change history. `assignedTo` UUIDs in history entries are automatically resolved to user names.

Response is the same as user ticket detail, but includes internal notes in comments.

---

### Update Ticket

```http
PATCH /admin/tickets/:id
Content-Type: application/json

{
  "status": "in_progress",
  "priority": "critical",
  "assignedTo": "user-uuid"
}
```

**Request Body** (all fields optional):
| Field        | Type        | Description                                      |
| ------------ | ----------- | ------------------------------------------------ |
| `status`     | enum        | `open` \| `in_progress` \| `resolved` \| `closed` |
| `priority`   | enum        | `low` \| `medium` \| `high` \| `critical`        |
| `assignedTo` | string/null | User ID of assignee, or `null` to unassign       |

**Response `200`:** Updated ticket object.

**Side effects:**
- All changes are recorded in ticket history
- If priority changes, SLA deadline is recalculated
- If status changes, email notification sent to ticket creator

---

### Add Comment / Internal Note

```http
POST /admin/tickets/:id/notes
Content-Type: application/json

{
  "body": "Escalating to engineering team.",
  "isInternalNote": true
}
```

| Field            | Type    | Required | Description                                           |
| ---------------- | ------- | -------- | ----------------------------------------------------- |
| `body`           | string  | Yes      | Comment text                                          |
| `isInternalNote` | boolean | No       | `true` = only visible to admins (default: `true`)     |

**Response `201`:** Comment object.

---

### Upload Attachment (Admin)

```http
POST /admin/tickets/:id/attachments
Content-Type: multipart/form-data

file: <binary file>
```

**Response `201`:** Attachment object.

---

## Admin — Feedbacks

### List All Feedbacks

```http
GET /admin/feedbacks?appId=uuid&category=bug_report&rating=5&page=1&limit=20
```

**Query Parameters:**
| Param      | Type   | Required | Description                                                                  |
| ---------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `appId`    | string | No       | Filter by app                                                                |
| `category` | enum   | No       | `bug_report` \| `feature_request` \| `suggestion` \| `complaint` \| `general` |
| `rating`   | number | No       | Filter by star rating (1-5)                                                  |
| `page`     | number | No       | Page number (default: 1)                                                     |
| `limit`    | number | No       | Items per page (default: 20)                                                 |

**Response `200`:**
```json
{
  "feedbacks": [ /* feedback objects */ ],
  "total": 40,
  "page": 1,
  "totalPages": 2
}
```

---

### Get Feedback Detail

```http
GET /admin/feedbacks/:id
```

**Response `200`:** Feedback object with replies and attachments (same as user view).

---

### Reply to Feedback

```http
POST /admin/feedbacks/:id/reply
Content-Type: application/json

{
  "body": "Thank you for your feedback! We'll consider adding this feature."
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "feedbackId": "uuid",
  "userId": "uuid",
  "body": "Thank you for your feedback!...",
  "createdAt": "2026-02-17T14:00:00.000Z",
  "user": { "id": "uuid", "name": "Admin", "avatarUrl": null }
}
```

**Side effects:** Email notification sent to feedback submitter.

---

### Upload Feedback Attachment (Admin)

```http
POST /admin/feedbacks/:id/attachments
Content-Type: multipart/form-data

file: <binary file>
```

**Response `201`:** Attachment object.

---

### Feedback Statistics

```http
GET /admin/feedback-stats?appId=uuid
```

**Response `200`:**
```json
{
  "totalFeedbacks": 40,
  "averageRating": 3.8,
  "byCategory": [
    { "category": "feature_request", "count": 15, "avgRating": 4.2 },
    { "category": "bug_report", "count": 10, "avgRating": 2.1 }
  ],
  "byRating": [
    { "rating": 5, "count": 12 },
    { "rating": 4, "count": 10 },
    { "rating": 3, "count": 8 },
    { "rating": 2, "count": 6 },
    { "rating": 1, "count": 4 }
  ],
  "byApp": [
    { "appId": "uuid", "appName": "ShopEase", "count": 15, "avgRating": 4.0 }
  ]
}
```

---

## Admin — Apps & Categories

### List Apps

```http
GET /admin/apps
```

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "ShopEase",
    "description": "E-commerce app",
    "iconUrl": "/uploads/icon.png",
    "platform": "flutter",
    "bundleId": "com.example.shopease",
    "emailFrom": "support@shopease.com",
    "emailName": "ShopEase Support",
    "apiKey": "fb_a1b2c3d4e5f6...",
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-02-17T12:00:00.000Z",
    "_count": { "tickets": 12, "feedbacks": 5 }
  }
]
```

---

### Get App Detail

```http
GET /admin/apps/:id
```

**Response `200`:** Single app object (same shape as list item).

**Response `404`:** `{ "error": "App not found" }`

---

### Register New App

```http
POST /admin/apps
Content-Type: application/json

{
  "name": "My New App",
  "description": "Optional description",
  "platform": "flutter",
  "bundleId": "com.example.myapp",
  "emailFrom": "support@myapp.com",
  "emailName": "MyApp Support"
}
```

Only `name` is required. Optional fields: `description`, `platform`, `bundleId`, `emailFrom`, `emailName`.

**Response `201`:**
```json
{
  "id": "uuid",
  "name": "My New App",
  "description": "Optional description",
  "platform": "flutter",
  "bundleId": "com.example.myapp",
  "apiKey": "fb_a1b2c3d4e5f6...",
  "isActive": true,
  "createdAt": "2026-02-17T12:00:00.000Z",
  "updatedAt": "2026-02-17T12:00:00.000Z"
}
```

The generated `apiKey` is what mobile apps use in the `x-api-key` header.

---

### Update App

```http
PATCH /admin/apps/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "New description",
  "platform": "android",
  "bundleId": "com.example.updated",
  "isActive": false,
  "emailFrom": "help@updated.com",
  "emailName": "Updated App Support"
}
```

All fields are optional — only provided fields are updated.

**Response `200`:** Updated app object with `_count`.

---

### Upload App Icon

```http
POST /admin/apps/:id/icon
Content-Type: multipart/form-data

file: <image file>
```

Max file size: 10 MB.

**Response `200`:** Updated app object with new `iconUrl`.

---

### Regenerate API Key

```http
POST /admin/apps/:id/regenerate-key
```

Generates a new `fb_...` API key. The old key is immediately invalidated.

**Response `200`:** Updated app object with new `apiKey`.

---

### Delete App

```http
DELETE /admin/apps/:id
```

**Response `200`:** `{ "success": true }`

---

### List Categories

```http
GET /admin/categories?appId=uuid
```

**Response `200`:**
```json
[
  { "id": "uuid", "appId": "uuid", "name": "Payment Issues", "description": "..." }
]
```

---

### Create Category

```http
POST /admin/categories
Content-Type: application/json

{
  "appId": "uuid",
  "name": "Payment Issues",
  "description": "Issues related to payment processing"
}
```

**Response `201`:** Category object.

---

## Admin — Users

### List Users

```http
GET /admin/users?role=admin&search=john&page=1&limit=20
```

**Query Parameters:**
| Param    | Type   | Required | Description                                   |
| -------- | ------ | -------- | --------------------------------------------- |
| `role`   | enum   | No       | `user` \| `admin` \| `super_admin`            |
| `search` | string | No       | Search by name or email (case-insensitive)     |
| `page`   | number | No       | Page number (default: 1)                       |
| `limit`  | number | No       | Items per page (default: 20)                   |

**Response `200`:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "john@gmail.com",
      "name": "John Doe",
      "avatarUrl": "https://...",
      "role": "user",
      "isBanned": false,
      "lastActiveAt": "2026-02-17T12:00:00.000Z",
      "createdAt": "2026-01-15T00:00:00.000Z",
      "_count": { "tickets": 5, "feedbacks": 3 }
    }
  ],
  "total": 15,
  "page": 1,
  "totalPages": 1
}
```

---

### Get User Detail

```http
GET /admin/users/:id
```

**Response `200`:**
```json
{
  "id": "uuid",
  "email": "john@gmail.com",
  "name": "John Doe",
  "avatarUrl": "https://...",
  "role": "user",
  "googleId": "google-id-string",
  "isBanned": false,
  "lastActiveAt": "2026-02-17T12:00:00.000Z",
  "createdAt": "2026-01-15T00:00:00.000Z",
  "_count": { "tickets": 5, "feedbacks": 3, "comments": 12 },
  "recentTickets": [
    {
      "id": "uuid",
      "title": "Payment issue",
      "status": "open",
      "priority": "high",
      "createdAt": "2026-02-16T10:00:00.000Z"
    }
  ],
  "recentFeedbacks": [
    {
      "id": "uuid",
      "rating": 4,
      "category": "suggestion",
      "comment": "Great app!",
      "createdAt": "2026-02-15T08:00:00.000Z"
    }
  ]
}
```

---

### Update User Role

```http
PATCH /admin/users/:id/role
Content-Type: application/json

{
  "role": "admin"
}
```

Valid roles: `user`, `admin`, `super_admin`

**Response `200`:**
```json
{ "id": "uuid", "email": "john@gmail.com", "name": "John Doe", "role": "admin" }
```

---

### Ban / Unban User

```http
PATCH /admin/users/:id/ban
Content-Type: application/json

{
  "isBanned": true
}
```

**Response `200`:**
```json
{ "id": "uuid", "email": "john@gmail.com", "name": "John Doe", "isBanned": true }
```

Banned users receive `403 Forbidden` on all authenticated requests.

---

## Admin — Analytics

### Dashboard Statistics

```http
GET /admin/analytics?appId=uuid
```

**Response `200`:**
```json
{
  "overview": {
    "totalTickets": 42,
    "openTickets": 15,
    "inProgressTickets": 8,
    "resolvedTickets": 12,
    "closedTickets": 7,
    "criticalOpen": 2,
    "slaBreached": 3
  },
  "byApp": [
    { "appId": "uuid", "appName": "ShopEase", "count": 18 },
    { "appId": "uuid", "appName": "FitTracker Pro", "count": 12 }
  ],
  "byPriority": [
    { "priority": "critical", "count": 3 },
    { "priority": "high", "count": 10 },
    { "priority": "medium", "count": 20 },
    { "priority": "low", "count": 9 }
  ],
  "recentTickets": [
    {
      "id": "uuid",
      "title": "App crashes on login",
      "createdAt": "2026-02-17T12:00:00.000Z",
      "user": { "name": "John Doe" },
      "app": { "name": "ShopEase" }
    }
  ]
}
```

---

## Notifications

Admin-only endpoints for managing in-app notifications.

### List Notifications

```http
GET /notifications?page=1&limit=20
```

**Response `200`:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "new_ticket",
      "title": "New Ticket",
      "message": "John Doe created: Bug in payment screen",
      "link": "/tickets/uuid",
      "isRead": false,
      "createdAt": "2026-02-17T12:00:00.000Z"
    }
  ],
  "total": 25,
  "unreadCount": 5,
  "page": 1,
  "totalPages": 2
}
```

**Notification Types:**
| Type             | Triggered When                  |
| ---------------- | ------------------------------- |
| `new_ticket`     | User creates a new ticket       |
| `ticket_update`  | Ticket status/priority changes  |
| `new_feedback`   | User submits feedback           |
| `new_comment`    | New comment on a ticket         |
| `feedback_reply` | Reply added to feedback         |

---

### Get Unread Count

```http
GET /notifications/unread-count
```

**Response `200`:**
```json
{ "count": 5 }
```

---

### Mark as Read

```http
PATCH /notifications/:id/read
```

**Response `200`:**
```json
{ "success": true }
```

---

### Mark All as Read

```http
PATCH /notifications/read-all
```

**Response `200`:**
```json
{ "success": true }
```

---

## WebSocket (Real-time)

Connect to receive real-time notifications:

```
ws://your-server:3000/ws?token=<JWT>
```

### Connection

On successful connection:
```json
{ "type": "connected", "userId": "uuid" }
```

**Error codes:**
- `4001` — Missing token
- `4002` — Invalid/expired token

### Notification Message

When a notification is created:
```json
{
  "type": "notification",
  "data": {
    "id": "uuid",
    "type": "new_ticket",
    "title": "New Ticket",
    "message": "John Doe created: Bug in payment screen",
    "link": "/tickets/uuid",
    "isRead": false,
    "createdAt": "2026-02-17T12:00:00.000Z"
  }
}
```

Supports multiple connections per user. Notifications are broadcast to all active connections.

---

## SLA & Priority

SLA deadlines are automatically calculated when a ticket is created or when priority is changed.

| Priority   | SLA Deadline   |
| ---------- | -------------- |
| `critical` | 4 hours        |
| `high`     | 24 hours       |
| `medium`   | 72 hours       |
| `low`      | 168 hours (7d) |

A ticket is considered **SLA breached** when its deadline has passed and the status is still `open` or `in_progress`.

---

## File Uploads

- **Max file size:** 10 MB per file
- **Storage:** Local disk, served at `/uploads/<filename>`
- **Access URL:** `http://your-server:3000/uploads/<filename>`
- **Supported on:** Tickets (user + admin), Feedbacks (user + admin)
- **Content-Type:** `multipart/form-data` with field name `file`

---

## Error Responses

All errors follow this format:

```json
{ "error": "Error description" }
```

| Status | Description                                    |
| ------ | ---------------------------------------------- |
| `400`  | Bad request — missing or invalid parameters    |
| `401`  | Unauthorized — missing or invalid token/API key |
| `403`  | Forbidden — insufficient permissions or banned |
| `404`  | Resource not found                             |
| `500`  | Internal server error                          |

---

## Integration Examples

### Flutter (using `http` package)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

const baseUrl = 'http://your-server:3000';
String? jwtToken;
const apiKey = 'fb_your_app_api_key';

// 1. Authenticate with Google
Future<void> login(String googleIdToken) async {
  final res = await http.post(
    Uri.parse('$baseUrl/auth/google'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'idToken': googleIdToken}),
  );
  final data = jsonDecode(res.body);
  jwtToken = data['token'];
}

// 2. Create a ticket
Future<Map<String, dynamic>> createTicket(String title, String description) async {
  final res = await http.post(
    Uri.parse('$baseUrl/tickets'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $jwtToken',
      'x-api-key': apiKey,
    },
    body: jsonEncode({
      'title': title,
      'description': description,
      'priority': 'medium',
    }),
  );
  return jsonDecode(res.body);
}

// 3. List my tickets
Future<List> getTickets({int page = 1}) async {
  final res = await http.get(
    Uri.parse('$baseUrl/tickets?page=$page'),
    headers: {
      'Authorization': 'Bearer $jwtToken',
      'x-api-key': apiKey,
    },
  );
  return jsonDecode(res.body)['tickets'];
}

// 4. Submit feedback
Future<Map<String, dynamic>> submitFeedback(int rating, {String? comment, String? category}) async {
  final res = await http.post(
    Uri.parse('$baseUrl/feedbacks'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $jwtToken',
      'x-api-key': apiKey,
    },
    body: jsonEncode({
      'rating': rating,
      if (comment != null) 'comment': comment,
      if (category != null) 'category': category,
    }),
  );
  return jsonDecode(res.body);
}

// 5. Upload attachment to ticket
Future<void> uploadAttachment(String ticketId, String filePath) async {
  final request = http.MultipartRequest(
    'POST',
    Uri.parse('$baseUrl/tickets/$ticketId/attachments'),
  );
  request.headers['Authorization'] = 'Bearer $jwtToken';
  request.headers['x-api-key'] = apiKey;
  request.files.add(await http.MultipartFile.fromPath('file', filePath));
  await request.send();
}
```

### Android Native (Kotlin + OkHttp)

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

const val BASE_URL = "http://your-server:3000"
const val API_KEY = "fb_your_app_api_key"
var jwtToken: String? = null

val client = OkHttpClient.Builder()
    .addInterceptor { chain ->
        val builder = chain.request().newBuilder()
        jwtToken?.let { builder.addHeader("Authorization", "Bearer $it") }
        builder.addHeader("x-api-key", API_KEY)
        chain.proceed(builder.build())
    }.build()

// 1. Authenticate
fun login(googleIdToken: String) {
    val body = JSONObject().put("idToken", googleIdToken)
        .toString().toRequestBody("application/json".toMediaType())
    val request = Request.Builder()
        .url("$BASE_URL/auth/google")
        .post(body)
        .build()
    val response = client.newCall(request).execute()
    val json = JSONObject(response.body!!.string())
    jwtToken = json.getString("token")
}

// 2. Create ticket
fun createTicket(title: String, description: String): JSONObject {
    val body = JSONObject()
        .put("title", title)
        .put("description", description)
        .put("priority", "medium")
        .toString().toRequestBody("application/json".toMediaType())
    val request = Request.Builder()
        .url("$BASE_URL/tickets")
        .post(body)
        .build()
    val response = client.newCall(request).execute()
    return JSONObject(response.body!!.string())
}

// 3. Submit feedback
fun submitFeedback(rating: Int, comment: String? = null): JSONObject {
    val json = JSONObject().put("rating", rating)
    comment?.let { json.put("comment", it) }
    val body = json.toString().toRequestBody("application/json".toMediaType())
    val request = Request.Builder()
        .url("$BASE_URL/feedbacks")
        .post(body)
        .build()
    val response = client.newCall(request).execute()
    return JSONObject(response.body!!.string())
}

// 4. Upload attachment
fun uploadAttachment(ticketId: String, file: File) {
    val body = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart("file", file.name,
            file.asRequestBody("application/octet-stream".toMediaType()))
        .build()
    val request = Request.Builder()
        .url("$BASE_URL/tickets/$ticketId/attachments")
        .post(body)
        .build()
    client.newCall(request).execute()
}
```

---

## All Endpoints Summary

| Method  | Endpoint                              | Auth     | Role  | Description                  |
| ------- | ------------------------------------- | -------- | ----- | ---------------------------- |
| `GET`   | `/health`                             | —        | —     | Health check                 |
| `POST`  | `/auth/google`                        | —        | —     | Google OAuth login           |
| `POST`  | `/auth/admin/login`                   | —        | —     | Admin email+password login   |
| `POST`  | `/auth/admin/register`                | Bearer   | super | Register new admin           |
| `POST`  | `/tickets`                            | Bearer+Key | any | Create ticket                |
| `GET`   | `/tickets`                            | Bearer+Key | any | List my tickets              |
| `GET`   | `/tickets/:id`                        | Bearer+Key | any | Get ticket detail            |
| `POST`  | `/tickets/:id/comments`               | Bearer+Key | any | Add comment                  |
| `POST`  | `/tickets/:id/attachments`            | Bearer+Key | any | Upload attachment            |
| `POST`  | `/feedbacks`                          | Bearer+Key | any | Submit feedback              |
| `GET`   | `/feedbacks`                          | Bearer+Key | any | List my feedbacks            |
| `GET`   | `/feedbacks/:id`                      | Bearer+Key | any | Get feedback detail          |
| `POST`  | `/feedbacks/:id/attachments`          | Bearer+Key | any | Upload feedback attachment   |
| `GET`   | `/admin/tickets`                      | Bearer   | admin | List all tickets             |
| `GET`   | `/admin/tickets/:id`                  | Bearer   | admin | Get ticket (admin view)      |
| `PATCH` | `/admin/tickets/:id`                  | Bearer   | admin | Update ticket                |
| `POST`  | `/admin/tickets/:id/notes`            | Bearer   | admin | Add note/comment             |
| `POST`  | `/admin/tickets/:id/attachments`      | Bearer   | admin | Upload attachment            |
| `GET`   | `/admin/feedbacks`                    | Bearer   | admin | List all feedbacks           |
| `GET`   | `/admin/feedbacks/:id`                | Bearer   | admin | Get feedback detail          |
| `POST`  | `/admin/feedbacks/:id/reply`          | Bearer   | admin | Reply to feedback            |
| `POST`  | `/admin/feedbacks/:id/attachments`    | Bearer   | admin | Upload feedback attachment   |
| `GET`   | `/admin/feedback-stats`               | Bearer   | admin | Feedback analytics           |
| `GET`   | `/admin/analytics`                    | Bearer   | admin | Dashboard statistics         |
| `GET`   | `/admin/apps`                         | Bearer   | admin | List apps                    |
| `POST`  | `/admin/apps`                         | Bearer   | admin | Register new app             |
| `GET`   | `/admin/categories`                   | Bearer   | admin | List categories              |
| `POST`  | `/admin/categories`                   | Bearer   | admin | Create category              |
| `GET`   | `/admin/users`                        | Bearer   | admin | List users                   |
| `GET`   | `/admin/users/:id`                    | Bearer   | admin | Get user detail              |
| `PATCH` | `/admin/users/:id/role`               | Bearer   | admin | Update user role             |
| `PATCH` | `/admin/users/:id/ban`                | Bearer   | admin | Ban/unban user               |
| `GET`   | `/notifications`                      | Bearer   | admin | List notifications           |
| `GET`   | `/notifications/unread-count`         | Bearer   | admin | Get unread count             |
| `PATCH` | `/notifications/:id/read`             | Bearer   | admin | Mark notification read       |
| `PATCH` | `/notifications/read-all`             | Bearer   | admin | Mark all read                |
| `WS`    | `/ws?token=<JWT>`                     | Token    | admin | Real-time notifications      |
