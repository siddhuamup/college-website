# Shri Shiv Chhatrapati College (SSCC) Junnar — ERP System

This repository contains the complete ERP portal (Student, Teacher, and Admin Portals) for Shri Shiv Chhatrapati College, Junnar.

## Tech Stack
* **Frontend**: HTML5, Vanilla JavaScript, CSS3
* **Backend**: Node.js (Express)
* **Database**: SQLite via Prisma ORM

---

## Local Development Setup

1. **Navigate to the server directory**:
   ```bash
   cd sscc-junnar-website/server
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill out the details:
   ```bash
   cp .env.example .env
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Initialize Database and Seed Demo Data**:
   ```bash
   npx prisma db push
   npm run seed
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

---

## Running with Docker

You can build and deploy the application within containerized environments using Docker and Docker Compose.

1. **Build and start the container**:
   ```bash
   docker compose up -d --build
   ```

2. **Verify container status**:
   ```bash
   docker compose ps
   ```

3. **Check application logs**:
   ```bash
   docker compose logs -f
   ```

---

## Enterprise Audit Remediation Summary

This codebase has undergone a complete enterprise hardening process:
* **Input Validation**: Schema-enforced input validation using Zod.
* **Security Standards**: Content Security Policy (CSP), secure JWT, rate limiting, and CSRF origin/referer matching.
* **Data Integrity Checks**: Server-side conflict detection for timetables and classrooms, soft-delete safety, and automated database sanity checks.
* **Verification Reports**: Code regression audits under `server/tests/` can be run using `node tests/security_audit.js` and `node tests/db_audit.js`.
