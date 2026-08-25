# IntegrarTEC Project 4 API

A NestJS REST API for a time-banking marketplace: users offer services, exchange minutes, manage balances, and review completed transactions.

- **Author:** AlejoElPaisano
- **Idea:** make community skills exchangeable through service listings and time credits.
- **Repository:** https://github.com/AlejoElPaisano/proyecto-4-integrarTec

## Stack

NestJS 11, TypeScript, PostgreSQL, Prisma 7, JWT, bcrypt, Passport, class-validator, Helmet, CORS, and throttling.

## Quick start

Prerequisites: Node.js, pnpm 11, and a reachable PostgreSQL database.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env` with the exact variable names below. Use environment-specific values; do not commit credentials.

   | Variable | Required for | Notes |
   |---|---|---|
   | `DATABASE_URL` | API, Prisma, migrations, seed | PostgreSQL connection string |
   | `JWT_SECRET` | API | At least 32 characters |
   | `JWT_EXPIRES_IN` | API | Access-token lifetime |
   | `JWT_REFRESH_SECRET` | API | At least 32 characters and different from `JWT_SECRET` |
   | `JWT_REFRESH_EXPIRES_IN` | API | Refresh-token lifetime |
   | `CORS_ORIGIN` | API | Allowed browser origin |
   | `PORT` | API | Listening port |
   | `ADMIN_EMAIL` | First-ADMIN seed | Seed-only bootstrap credential |
   | `ADMIN_NAME` | First-ADMIN seed | Seed-only display name |
   | `ADMIN_PASSWORD` | First-ADMIN seed | Seed-only credential; bcrypt supports up to 72 bytes |

3. Generate the Prisma client and apply the tracked development migrations:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

   For a schema change during development, use `pnpm db:migrate --name <migration-name>`.

4. Optionally create the first administrator:

   ```bash
   pnpm db:seed
   ```

   The seed creates an `ADMIN` only when none exists, hashes `ADMIN_PASSWORD` with bcrypt, never returns or logs the password, and makes no changes when rerun after an administrator exists. It also refuses to overwrite an existing user with `ADMIN_EMAIL`.

5. Start the API:

   ```bash
   pnpm start:dev
   ```

The API is served under `/api/v1`. The public health check is `GET /api/v1/health`.

## Database commands

| Purpose | Command |
|---|---|
| Generate Prisma client | `pnpm db:generate` |
| Create/apply development migration | `pnpm db:migrate` |
| Apply migrations in production or CI | `pnpm db:deploy` |
| Check migration status | `pnpm db:status` |
| Run the idempotent first-ADMIN seed | `pnpm db:seed` |
| Open Prisma Studio | `pnpm db:studio` |

Never use `db:migrate` (`prisma migrate dev`) or `db push` as the production deployment migration step.

## Verification

Live database verification requires PostgreSQL, all API environment variables, and a valid `DATABASE_URL`. After generating the client and applying migrations, run:

```bash
pnpm test
pnpm test:e2e
```

The e2e suite exercises registration, login, refresh-token rotation, and logout against the configured database. This README does not claim live PostgreSQL or e2e proof; run these commands in an environment with those prerequisites.

## Deploy handoff

Deployment is performed by **AlejoElPaisano**, the user who owns deployment. The deployment environment must provide the API variables above and a reachable PostgreSQL database. A production handoff should run:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
pnpm build
pnpm start:prod
```

Run `pnpm db:seed` separately only when the deployment needs the first-ADMIN bootstrap and its three seed-only variables are available.

## API endpoints

All protected endpoints require `Authorization: Bearer <access_token>`. Unless a role is listed, the endpoint accepts any authenticated role (`MEMBER`, `COORDINATOR`, or `ADMIN`), subject to service-level ownership and business rules.

| Method | Path | Description | Auth | Role notes |
|---|---|---|---|---|
| GET | `/api/v1/health` | Report API health | Public | None |
| POST | `/api/v1/auth/register` | Register a user and issue tokens | Public | New users start as `MEMBER` |
| POST | `/api/v1/auth/login` | Authenticate and issue tokens | Public | Any active role |
| POST | `/api/v1/auth/refresh` | Rotate access and refresh tokens | Public route + valid refresh Bearer token | Any active role |
| POST | `/api/v1/auth/logout` | Revoke the current refresh token | Bearer token | Any active role |
| GET | `/api/v1/auth/me` | Get the authenticated user | Bearer token | Any active role |
| GET | `/api/v1/categories` | List categories | Public | None |
| POST | `/api/v1/categories` | Create a category | Bearer token | `ADMIN` |
| PATCH | `/api/v1/categories/:id` | Update a category | Bearer token | `ADMIN` |
| DELETE | `/api/v1/categories/:id` | Delete a category | Bearer token | `ADMIN` |
| GET | `/api/v1/services` | List active services with filters | Public | None |
| GET | `/api/v1/services/mine` | List the authenticated provider's services | Bearer token | Any active role |
| GET | `/api/v1/services/:id` | Get one service | Public | None |
| POST | `/api/v1/services` | Create a service for the authenticated provider | Bearer token | Any active role; provider rules apply |
| PATCH | `/api/v1/services/:id/deactivate` | Deactivate a service | Bearer token | Any active role; ownership/admin rules apply |
| PATCH | `/api/v1/services/:id` | Update a service | Bearer token | Any active role; ownership/admin rules apply |
| DELETE | `/api/v1/services/:id` | Delete a service | Bearer token | Any active role; ownership/admin rules apply |
| GET | `/api/v1/users` | List users | Bearer token | `COORDINATOR` or `ADMIN` |
| GET | `/api/v1/users/me` | Get the authenticated user's profile | Bearer token | Any active role |
| PATCH | `/api/v1/users/me` | Update the authenticated user's profile | Bearer token | Any active role |
| PATCH | `/api/v1/users/:id/role` | Change a user's role | Bearer token | `ADMIN` |
| PATCH | `/api/v1/users/:id/status` | Activate or deactivate a user | Bearer token | `ADMIN` |
| PATCH | `/api/v1/users/:id/balance` | Grant minutes to a user | Bearer token | `ADMIN` |
| GET | `/api/v1/users/:id` | Get a public user profile | Bearer token | Any active role |
| GET | `/api/v1/transactions/mine` | List the authenticated user's transactions | Bearer token | Any active role |
| GET | `/api/v1/transactions/:id` | Get an authorized transaction | Bearer token | Participant/ownership rules apply |
| POST | `/api/v1/transactions` | Create a transaction for a service | Bearer token | Any active role; balance and participant rules apply |
| PATCH | `/api/v1/transactions/:id/confirm` | Confirm a transaction | Bearer token | Participant/ownership rules apply |
| PATCH | `/api/v1/transactions/:id/cancel` | Cancel a transaction | Bearer token | Participant/ownership rules apply |
| GET | `/api/v1/reviews/mine` | List reviews written by the user | Bearer token | Any active role |
| GET | `/api/v1/reviews/by-user/:userId` | List visible reviews for a user | Public | None |
| POST | `/api/v1/reviews` | Create a review for a completed transaction | Bearer token | Reviewer and transaction rules apply |
| PATCH | `/api/v1/reviews/:id/hide` | Hide a review | Bearer token | `ADMIN` |

## License

This project is private and currently has no published license.
