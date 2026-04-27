# Local Development

Run the local stack from the repository root:

```bash
npm install
cp .env.example .env
npm run db:generate
npm run compose:up
```

Services:

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Web: `http://localhost:5173`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- LocalStack: `http://localhost:4566`

Docker Compose reads `.env`. The checked-in `.env.example` is safe for local bootstrap only. Shared environments must use unique JWT secrets and a unique 32-byte field encryption key.
