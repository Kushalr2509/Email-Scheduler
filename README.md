# ReachInbox Email Scheduler

A robust, high-performance email scheduling system built with Express, PostgreSQL, Redis, and BullMQ. Features multi-sender support, rate limiting, Elasticsearch-powered search, and Slack notifications.

## Architecture
- **Next.js**: Frontend application shell
- **Express**: API server
- **PostgreSQL**: Source of Truth (Database)
- **Redis / BullMQ**: Execution, Rate-Limiting, and Queue Layer
- **Worker**: Background processor for sending emails
- **Ethereal SMTP**: Email delivery testing service
- **Elasticsearch**: Search projection for Sent/Failed emails

## Prerequisites
- Node.js (v18+)
- Docker (for PostgreSQL, Redis, Elasticsearch)

## Environment Variables
Copy `.env.example` to `.env` and fill in the required values.
\`\`\`bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
\`\`\`
**Note:** `JWT_SECRET` is strictly required when running in a `production` environment.

## Installation & Setup

1. **Install Dependencies**
   \`\`\`bash
   cd backend && npm install
   cd ../frontend && npm install
   \`\`\`

2. **Start Infrastructure (Docker)**
   \`\`\`bash
   docker compose up -d
   \`\`\`
   This spins up PostgreSQL, Redis, and Elasticsearch.

3. **Database Setup**
   \`\`\`bash
   cd backend
   npx prisma migrate dev
   \`\`\`

## Running the Application

**Backend API & Worker**
\`\`\`bash
cd backend
npm run dev
\`\`\`

**Frontend App**
\`\`\`bash
cd frontend
npm run dev
\`\`\`

## Features

- **Google OAuth**: Complete OAuth integration.
- **Slack Notifications**: Receive alerts when sender-specific hourly limits are reached.
- **Bull Board**: Monitor jobs visually at `http://localhost:3001/admin/queues`.
- **Ethereal SMTP**: Reliable local testing.
- **Advanced Rate Limiting**: Atomic Redis Lua scripts enforce both absolute hourly limits and minimum delay-between-emails per sender. 
- **Crash Reconciliation**: Disconnected `SCHEDULED` emails gracefully reconnect to BullMQ upon worker reboot.

## Testing
\`\`\`bash
cd backend
npm run test
\`\`\`
