# GLW Page Generation Setup

## PostgreSQL Connection

Set `DATABASE_URL` to a PostgreSQL connection string that Prisma can use for the GLW job tables.

Example:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/platform_glw
```

## Prisma Migration

Run the Prisma migration after the database is available:

```bash
npx prisma migrate dev
```

Generate the Prisma client after schema changes:

```bash
npx prisma generate
```

## Required Environment Variables

- `GLW_ADMIN_EMAIL`
- `GLW_ADMIN_PASSWORD`
- `GLW_AUTH_SECRET`
- `DATABASE_URL`
- `GLW_APP_URL`
- `GLW_N8N_PAGE_WEBHOOK_URL`
- `GLW_N8N_WEBHOOK_SECRET`

## Production Webhook Contract

`GLW_N8N_PAGE_WEBHOOK_URL` must point to the production n8n intake endpoint used for page generation. The GLW server is the only caller of that URL and sends a bearer token using `GLW_N8N_WEBHOOK_SECRET`.

The callback endpoint is always derived from `GLW_APP_URL`:

- `https://<your-glw-domain>/api/glw/jobs/callback`

Both outbound webhook calls and inbound callbacks use the same secret value and the header format:

```text
Authorization: Bearer <GLW_N8N_WEBHOOK_SECRET>
```

## Expected n8n Webhook Request

The GLW server sends a normalized JSON payload to the configured webhook:

```json
{
  "jobId": "<GLW job id>",
  "type": "page_generation",
  "site": {
    "id": "led-display-warehouse",
    "name": "LED Display Warehouse"
  },
  "page": {
    "title": "...",
    "targetSlug": "...",
    "primaryKeyword": "...",
    "secondaryKeywords": ["...", "..."],
    "wordCount": 1500,
    "tone": "...",
    "audience": "...",
    "callToAction": "...",
    "category": "...",
    "status": "draft"
  },
  "promptData": {
    "tone": "...",
    "audience": "...",
    "callToAction": "..."
  },
  "seoSettings": {
    "targetSlug": "...",
    "primaryKeyword": "...",
    "secondaryKeywords": ["...", "..."],
    "category": "..."
  },
  "publishingSettings": {
    "status": "draft",
    "wordCount": 1500
  },
  "imageSettings": {
    "generateFeaturedImage": true,
    "style": "editorial"
  },
  "authToken": "<GLW_N8N_WEBHOOK_SECRET>",
  "callbackUrl": "http://localhost:3000/api/glw/jobs/callback"
}
```

The request uses `Authorization: Bearer <GLW_N8N_WEBHOOK_SECRET>`.

The server stores jobs with lifecycle states: `QUEUED -> STARTING -> RUNNING -> ... -> COMPLETE | FAILED`. Regressive callback transitions are rejected.

## Expected Synchronous Response

When the workflow completes immediately, the webhook can return:

```json
{
  "executionId": "exec_123",
  "status": "complete",
  "title": "LED Wall Rental Package - Rentals in Los Angeles, CA",
  "wordpressUrl": "https://example.com/led-wall-rental-package",
  "wordpressPostId": 123
}
```

Accepted async handoff responses are also valid:

```json
{
  "executionId": "exec_123",
  "status": "accepted"
}
```

## Expected Asynchronous Callback

If the workflow accepts the job and finishes later, the server can receive a callback at `/api/glw/jobs/callback` with this shape:

```json
{
  "jobId": "glw_xxx",
  "executionId": "exec_123",
  "status": "COMPLETE",
  "title": "LED Wall Rental Package - Rentals in Los Angeles, CA",
  "wordpressPageId": 123,
  "wordpressUrl": "https://example.com/led-wall-rental-package",
  "wordpressPostId": 123,
  "featuredImageUrl": "https://example.com/wp-content/uploads/2026/cover.png",
  "executionTimeMs": 42890,
  "error": {
    "message": "...",
    "step": "..."
  }
}
```

Authenticate the callback with the same `GLW_N8N_WEBHOOK_SECRET` value in the `Authorization` header.

Callback constraints:

- `jobId`, `executionId`, and a valid `status` are required.
- `status=COMPLETE` requires `wordpressUrl` and `wordpressPostId`.
- `status=FAILED` requires an `error.message`.
- Execution id must match any previously tracked execution id for the job.
- Callback retries can be replayed through `/api/glw/jobs/callback/retry` using the same payload and bearer auth.

## Retry Lineage

Retries create a brand-new job row with `retryOfJobId` pointing to the failed source job.

- Only `FAILED` jobs can be retried.
- A new retry is blocked while the latest retry remains active.
- Queue and dashboard surfaces show both original and retry job records.

## Manual Verification Runbook

1. Create a page job in `/glw/pages` and confirm the response is `201` (complete) or `202` (accepted).
2. Verify a row is present in `GlwJob` with `status=STARTING` or terminal status and `retryOfJobId=null`.
3. If async, post a callback payload with bearer auth and confirm status advances to `RUNNING` or `COMPLETE`.
4. For failure handling, send a `FAILED` callback with `error.message` and confirm the UI shows retry.
5. Trigger retry from the UI and verify a new row is created where `retryOfJobId=<failed_job_id>`.
6. Open `/glw/queue` and validate search/filter behavior against live data.
7. Open `/glw` dashboard and confirm metrics reflect database-backed counts and recent jobs.

## Troubleshooting

- `401` on callback: verify `Authorization` header and `GLW_N8N_WEBHOOK_SECRET` value in both systems.
- `400` callback validation error: ensure status is a valid GLW status and required fields are present for `COMPLETE`/`FAILED`.
- `409` retry conflict: latest retry is still active; wait for terminal state before retrying again.
- `502` create/retry response: n8n endpoint failed or timed out; inspect n8n execution logs and webhook URL.
- Missing queue/dashboard rows: confirm `DATABASE_URL`, migration status, and that `/api/glw/jobs` returns records.

## Local Development Commands

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run lint
npm run test
npm run build
```
