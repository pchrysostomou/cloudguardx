# Redis

Redis is used by CloudGuardX for rate limiting, async job coordination, and short-lived security state such as token family revocation checks.

The Phase 1 Compose stack starts Redis with append-only persistence enabled for local development.

