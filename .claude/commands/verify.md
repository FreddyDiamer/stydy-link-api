---
description: Smoke-check the API — dev server, dev auth, key endpoints respond
---

Smoke-check the running application end-to-end. Follow these steps in order and report a pass/fail table at the end.

1. **Check the dev server.** `curl -s http://localhost:3000/api` — expect the health-check envelope (`"success": true`). If the connection is refused, start the server with `pnpm run start:dev` in the background, wait for "Application is running", then retry. Remember whether you started it (step 6).

2. **Get a token without Telegram.** `curl -s -X POST http://localhost:3000/api/auth/dev/login -H 'Content-Type: application/json' -d '{}'` — dev web-login creates/returns a test user. Extract `data.accessToken` from the response. If this returns 403, `NODE_ENV` is not `development` — report and stop.

3. **Verify auth works.** `GET /api/auth/profile` with `Authorization: Bearer <token>` — expect the current user.

4. **Probe one read endpoint per domain** (all with the Bearer token):

   - `GET /api/users/me` — users
   - `GET /api/education/subjects/active` — education
   - `GET /api/marketplace/services/active` — marketplace
   - `GET /api/reviews/my` — reviews

   Each must return HTTP 200 with the `{ data, success: true }` envelope.

5. **Report.** Print a table: endpoint → status → OK/FAIL. Any FAIL: show the response body and suggest where to look (use `docs/development/reference/api-endpoints.md` and the domain docs).

6. **Clean up.** If you started the dev server in step 1, stop it.

Do NOT call `POST /api/parser/sync` or `/async` during a smoke check — they mass-upsert reference data.
