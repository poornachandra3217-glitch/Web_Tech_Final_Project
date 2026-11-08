# CampusFind API reference

All endpoints are same-origin. Responses are JSON except item images. Errors use `{ "error": "message" }`. Authenticate with the session cookie; include `x-csrf-token` on every mutation, including registration/login/logout. Fetch `/api/auth/me` first to create a session and obtain the token. Authentication rotates both the session ID and CSRF token, so store the new token returned by registration/login. After logout, fetch `/api/auth/me` again.

| Method | Endpoint               | Access and purpose                                  |
| ------ | ---------------------- | --------------------------------------------------- |
| GET    | /api/health            | Database readiness, 200 or 503                      |
| GET    | /api/meta              | Category and building options                       |
| GET    | /api/auth/me           | Current user or null and CSRF token                 |
| POST   | /api/auth/register     | name, email, password; creates student              |
| POST   | /api/auth/login        | email, password; starts session                     |
| POST   | /api/auth/logout       | Authenticated; destroys session                     |
| GET    | /api/stats             | Public listing counts                               |
| GET    | /api/items             | Search and paginated listing retrieval              |
| POST   | /api/items             | Signed-in user; JSON or multipart report            |
| GET    | /api/items/:id         | Public detail; reporter name only                   |
| GET    | /api/items/:id/image   | Public uploaded photo                               |
| GET    | /api/items/:id/matches | Opposite-type, same-category suggestions            |
| PATCH  | /api/items/:id         | Reporter/admin edits or status update               |
| DELETE | /api/items/:id         | Reporter/admin; rejected if claims exist            |
| POST   | /api/items/:id/claims  | Other signed-in user; private evidence              |
| GET    | /api/claims            | Claimant/reporter scope; admin sees all; latest 200 |
| PATCH  | /api/claims/:id        | Reporter/admin reviews pending claim                |
| GET    | /api/admin/stats       | Admin only; members, pending and categories         |

## Listing fields

`name` (1–100 characters), `description` (10–1500), `category` and `location` from metadata, `date` as YYYY-MM-DD and not in the future, `type` lost/found. For multipart use optional `image`, a PNG/JPEG/WebP file no larger than 3 MB. Image bytes are persisted in MongoDB, excluded from list/detail JSON and served by the dedicated endpoint. Optional edit field `removeImage=true` removes a photo.

GET query fields: `q` up to 100 characters, `category`, `location`, `type`, `status` open/closed/recovered, `sort` newest/oldest, `page`, and `mine=true` for the authenticated reporter. Page size is 12. Response: items, total, page, pages. Individual item JSON has `hasImage` and a reporter ID for ownership checks; public detail populates the reporter name.

An edit with `name` must include all listing fields. Once claims exist, full rewrites are blocked. A status-only PATCH accepts open/closed/recovered; recovered cannot be reopened. Deletion with claim history returns 409.

## Claims

Submit `{ "evidence": "At least 15 characters of identifying evidence" }`. One request per item per claimant. Self-claims, closed/recovered listings and duplicate requests are rejected. A person who finds an item can also respond to a lost listing using the same recovery-request flow.

Review with `{ "status": "approved" | "rejected", "reviewNote": "Optional up to 500 characters" }`. Only a listing's reporter or admin can review it. Reviewed claims are final. Approval is transactional: an open item becomes recovered, selected claim approved, other pending claims rejected. Write conflicts are retried by the MongoDB driver; an already recovered item cannot be approved twice.

## Status codes

200 successful retrieval/update; 201 creation; 400 invalid input; 401 unauthenticated; 403 missing CSRF/unauthorized role or ownership; 404 not found; 409 duplicate or invalid state transition; 429 rate limit; 500 unexpected error with generic client message.
