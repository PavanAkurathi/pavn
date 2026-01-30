# API Deployment Guide

This Hono + Bun API server is deployment-agnostic. Use any platform that supports Bun or Node.js.

## Quick Start

```bash
cd apps/api
bun install
bun run dev      # Development with hot reload
bun run start    # Production
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=https://your-api.com

# Optional
PORT=4005
NODE_ENV=production
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
SENTRY_DSN=...
```

## Platform Configs

### Railway

1. Create new service, link repo
2. Set root directory: `apps/api`
3. Build command: `bun install`
4. Start command: `bun run start`
5. Add env vars

### Vercel

```json
// vercel.json (create in apps/api/)
{
  "buildCommand": "bun install",
  "outputDirectory": ".",
  "framework": null,
  "functions": {
    "src/index.ts": {
      "runtime": "@vercel/node@3"
    }
  }
}
```

Note: Vercel serverless may need adapter. Consider Railway/Render for long-running Hono server.

### Render

1. New Web Service → link repo
2. Root directory: `apps/api`
3. Build: `bun install`
4. Start: `bun run start`
5. Environment: Bun

### Fly.io

```dockerfile
# Dockerfile (create in apps/api/)
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 4005
CMD ["bun", "run", "start"]
```

```bash
fly launch --dockerfile Dockerfile
fly secrets set DATABASE_URL=...
```

### Docker (Generic)

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production --frozen-lockfile
COPY src ./src
ENV NODE_ENV=production
EXPOSE 4005
CMD ["bun", "run", "src/index.ts"]
```

## Health Check

```bash
curl http://localhost:4005/health
# Returns: { "status": "ok", "timestamp": "..." }
```

## Monorepo Note

This API depends on workspace packages. When deploying:
- Railway/Render: Auto-detect monorepo
- Docker: Copy full monorepo or pre-bundle dependencies
- Vercel: May need turborepo setup
