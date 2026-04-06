# ClearAller Vision

ClearAller Vision is a full-stack intelligent allergen transparency platform that analyzes food and cosmetic ingredient labels from uploaded or captured images, checks them against profile-specific allergy risk, explains detected ingredients, and recommends safer alternatives using dynamically gathered external knowledge.

## Stack

- Frontend: React, Vite, Tailwind CSS, React Query, React Router, Tesseract.js
- Backend: Node.js, Fastify, Prisma, PostgreSQL, Cheerio, Fuse.js
- Shared package: TypeScript types and normalization helpers

## Core capabilities

- Multi-profile allergy management per account
- OCR-based ingredient extraction from uploaded images or camera capture
- Profile-aware ingredient risk scoring for one or all profiles
- Dynamic ingredient knowledge gathering from public food, cosmetic, and scientific sources
- Educational explanations for detected ingredients
- Live product search with safety scoring and safer alternative recommendations
- Persistent analysis history and ingredient knowledge enrichment

## Monorepo layout

- `frontend/` React application
- `backend/` API server, ingestion services, persistence, and analysis engine
- `shared/` shared schemas, types, and utilities

## Environment

Copy:

- `backend/.env.example` to `backend/.env`
- `frontend/.env.example` to `frontend/.env`

## Install

```bash
npm.cmd install
```

## Run

```bash
npm.cmd run dev
```

Frontend defaults to `http://localhost:5173`.
Backend defaults to `http://localhost:4000`.

## Database

This project is designed for PostgreSQL through Prisma.

1. Create a PostgreSQL database.
2. Set `DATABASE_URL` in `backend/.env`.
3. Run:

```bash
npm.cmd run prisma:generate --workspace backend
npm.cmd run prisma:migrate --workspace backend -- --name init
```

## Notes

- OCR runs in the browser with Tesseract.js for image privacy and faster iteration.
- The backend still normalizes and re-analyzes extracted ingredients before producing safety decisions.
- Dynamic connectors use public APIs first and fall back to structured scraping adapters where applicable.
- Background enrichment is modeled in the codebase and can be promoted to a queue worker later without changing API contracts.
