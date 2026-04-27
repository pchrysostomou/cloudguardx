# Local Development

This project is runnable without external API keys. Use Docker for PostgreSQL, Redis, and LocalStack, then run the API, worker, and web app through npm workspaces.

## First Run

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis localstack
npm run db:generate
npm run db:validate
npm run db:migrate:dev
npm run db:seed
```

## Start Services

Use three terminals:

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
```

Services:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- Web: `http://localhost:5173`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- LocalStack: `http://localhost:4566`

If Vite chooses `5174`, `.env.example` already includes that origin in `CORS_ORIGINS`.

## Demo Data

`npm run db:seed` creates a demo owner, tenant, AWS account, S3 asset, high-severity finding, risk score, and manual remediation.

Demo login:

- `demo@cloudguardx.local`
- `CloudGuardX-Demo-123!`

Login through Swagger or curl:

```bash
curl -s http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@cloudguardx.local","password":"CloudGuardX-Demo-123!"}'
```

Set the returned access token in the browser console:

```js
localStorage.setItem("cloudguardx.accessToken", "<access-token>");
location.reload();
```

## Full Docker

```bash
docker compose up -d postgres redis localstack
docker compose run --rm api npm run db:migrate:dev
docker compose run --rm api npm run db:seed
docker compose up --build api worker web
```

## Production-Style Local Starts

After `npm run build`:

```bash
npm run start:api
npm run start:worker
npm run start:web
```

The API and worker read environment from either the workspace directory or the repository root `.env`.
