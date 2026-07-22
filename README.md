# Sodamasystem

Sodma — Student Registration System built with Next.js, PostgreSQL, and Prisma.

## Features

- Admin dashboard, students, teachers, classes, courses, shifts
- Attendance management
- Payments and reports
- WhatsApp, SMS (Hormuud) & email messaging
- Visit scheduled student registration with automated reminders
- Registration user role (admission staff)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. PostgreSQL database

Choose one option:

**Option A — Local PostgreSQL (Windows)**

1. Install [PostgreSQL](https://www.postgresql.org/download/windows/) or use Docker:
   ```bash
   docker run --name sodma-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sodmasystem -p 5432:5432 -d postgres:16
   ```
2. Create database `sodmasystem` if not using Docker.

**Option B — Cloud (recommended for production)**

- [Neon](https://neon.tech) — free PostgreSQL, copy connection string
- [Supabase](https://supabase.com) — free PostgreSQL
- [Railway](https://railway.app) — add PostgreSQL plugin

### 3. Environment variables

Copy and edit `.env`:

```bash
# Windows
copy .env .env.backup
```

Set in `.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/sodmasystem"
JWT_SECRET="your-long-random-secret-min-32-characters"
```

### 4. Database migrate + seed

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

For local development (creates migration history):

```bash
npx prisma migrate dev
npx prisma db seed
```

### 5. Run app

```bash
npm run dev
```

Open http://localhost:3000/login

## Scalability (100K+ students)

After pulling updates, run:

```bash
npx prisma migrate deploy
npx prisma generate
```

Features for large datasets:

- **Pagination** (50/page): students, teachers, payments, audit log
- **Server-side search** on students, teachers, audit
- **Database indexes** for counts, filters, and attendance
- **Report cache** (5 min) on `/reports` overview
- **Session cache** (60 sec) to reduce auth DB load
- **Attendance archive**: move records older than 365 days to `AttendanceArchive`

Archive old attendance manually or via cron:

```bash
npm run cron:archive-attendance
# or POST /api/cron/archive-attendance with CRON_SECRET
```

Set `ATTENDANCE_ARCHIVE_AFTER_DAYS=365` in `.env` to change retention.

## Docker (recommended for deployment)

Copy environment template and set strong secrets:

```bash
cp .env.example .env
```

Build and start PostgreSQL + app:

```bash
docker compose up -d --build
```

Seed default users (first time only):

```bash
docker compose exec app npx prisma db seed
```

Open http://localhost:3000/login

- App: `http://localhost:3000`
- PostgreSQL: `localhost:5432` (user `postgres`, password `postgres`, db `sodma`)
- Migrations run automatically on container start

**Production:** Change `JWT_SECRET`, `CRON_SECRET`, and all default seed passwords before going live.

## Default login (after seed — development only)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@sodma` | `pasowrdsodam123` |
| Teacher | `teacher@school.com` | `teacher123` |
| Admission | `admission@sodma` | `register123` |
| Finance | `finance@sodma` | `finance123` |

> **Security:** Do not use these passwords in production. Override with `SEED_*_PASSWORD` env vars or change passwords after seed.

## Migrating from MongoDB

This project now uses **PostgreSQL only**. Old MongoDB data is not migrated automatically.

1. Set up PostgreSQL and update `DATABASE_URL`
2. Run `npx prisma migrate deploy && npx prisma db seed`
3. Re-create users/students in the new system (or write a custom import script)

## Visit reminder cron (auto WhatsApp)

Students with **Visit Scheduled** get a WhatsApp confirmation when registered, and a **day-of reminder** on their visit date.

### Option A — Automatic (local / VPS / Docker)

When you run `npm run dev` or `npm start`, the server starts a daily cron job automatically.

In `.env`:

```env
CRON_SECRET="your-long-random-secret"
VISIT_REMINDER_CRON_TIME="07:00"
```

- Runs every day at **07:00 server local time** (change `VISIT_REMINDER_CRON_TIME`, e.g. `06:30`)
- Set `VISIT_REMINDER_CRON_ENABLED=false` to disable in-process cron
- Set `VISIT_REMINDER_CRON_RUN_ON_START=true` to test immediately on server boot

### Option B — Vercel (production)

`vercel.json` already schedules `GET /api/cron/visit-reminders` at **07:00 UTC** daily.

1. Add `CRON_SECRET` to your Vercel project environment variables (same value as in `.env`)
2. For **Somalia (UTC+3) 07:00**, change `vercel.json` schedule to `"0 4 * * *"` (04:00 UTC)

### Option C — Windows Task Scheduler / Linux cron

Run once per day without keeping the Next.js cron in-process:

```bash
npm run cron:visit-reminders
```

**Windows Task Scheduler example:**

1. Create Basic Task → Daily → 07:00
2. Action: Start a program
3. Program: `cmd.exe`
4. Arguments: `/c cd /d D:\sodmaproject\studentregtsartion && npm run cron:visit-reminders`

### Manual trigger (admin)

While logged in as admin, call:

```bash
curl -X POST http://localhost:3000/api/cron/visit-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Environment

Configure `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, SMTP, and WhatsApp settings in `.env`.
