# CampusFind

Project repository: https://github.com/poornachandra3217-glitch/Web_Tech_Final_Project

A full-stack Campus Lost and Found Portal for the Sai University Web Technology and Internet Programming individual project, academic year 2026–2027. Built with semantic HTML, CSS, JavaScript ES modules, Express and MongoDB.

## Start here

Requirements: Node.js 22 or 24, npm, and MongoDB Atlas or a MongoDB replica set. Transactions require a replica set; a standalone MongoDB process is not sufficient. Atlas provides the required topology.

```bash
npm ci
cp .env.example .env
# Edit .env with your database URI and unique passwords.
npm run seed
npm start
```

Open http://localhost:3000. On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Set a random SESSION_SECRET of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and place it in `.env`; do not commit it.

For a local database, run `docker compose up -d` first. The supplied Compose configuration starts a local replica set with a persistent named volume, bound to loopback. This database has no authentication and is for local development only. Allow its health check to initialize the replica set before seeding.

`npm run dev` watches the production application source. `npm run qa:preview` starts an explicitly temporary QA database with fictional sample data; it is not a persistent deployment and needs development dependencies.

## Accounts and seed data

`npm run seed` creates an administrator using ADMIN_EMAIL and ADMIN_PASSWORD, a demo student at student@example.com using DEMO_PASSWORD, and 12 labelled demonstration listings. The seed is repeatable and does not delete existing records. Existing passwords are not reset by a repeat seed. Use unique passwords and a real admin email in a deployed environment. Registration always creates a student; roles cannot be self-assigned through the API. Remove demo data before using the portal for real campus operations.

## Features

- Home noticeboard, keyword search, category and campus-building filters, newest/oldest date sorting and pagination.
- Registration, sign-in, sign-out, MongoDB-backed sessions and CSRF-protected changes.
- Lost/found reports, optional PNG/JPEG/WebP photos up to 3 MB, edit, close and deletion where history permits.
- Private recovery evidence, owner/admin review, approve/reject decisions and review notes.
- Atomic approval: one approved claim, item becomes recovered, competing pending claims rejected together.
- Student dashboard with personal listings, outgoing requests and incoming requests.
- Admin dashboard with listing management, all requests, statistics and category counts.
- Additional feature: explainable possible-match suggestions using category, opposite report type, location, name keywords and date proximity. Instructor approval is still required for this proposed additional feature. Date sorting and building filters are also available.
- Responsive layouts, keyboard-accessible forms, reduced-motion support and local illustrations without third-party image requests.

## Verification

```bash
npm run check
npm test
npm run test:acceptance
# With an already running local test server:
npm run test:postman
```

`npm run test:acceptance` runs the Postman collection automatically against its own isolated MongoDB-backed Express application and saves Newman evidence. The verified run passed 26 requests and 29 assertions.

The verified `npm test` run passed 28 API integration checks and five DOM behaviour checks (33 total). DOM tests exercise real frontend modules against Express/MongoDB, but do not verify visual layout.

The integration suite starts an isolated real MongoDB replica set and checks API behaviour, role/ownership boundaries, private data, validation, recovery transactions and seed idempotency. Its first run may download a MongoDB binary from the official distribution. The Postman/Newman command expects an already running local test application at localhost:3000; start `npm run qa:preview` in a separate terminal for this. Do not run the acceptance collection on a live campus database because it creates test records.

Import both JSON files in `postman/` into Postman, select the local environment, and run the complete collection in order. The cookie jar must remain enabled. Save the Runner summary and representative request/response screenshots as Classroom evidence. Sanitized Newman JSON summaries and text results are included under `docs/` after execution; CLI execution is not a substitute for instructor-required Postman screenshots.

## Project structure

| Path               | Responsibility                                                             |
| ------------------ | -------------------------------------------------------------------------- |
| `src/app.js`       | Express API, validation, authorization, upload checks and session security |
| `src/models.js`    | User, Item and Claim schemas and indexes                                   |
| `src/server.js`    | Persistent database connection and process startup                         |
| `src/seed.js`      | Non-destructive sample data and administrator creation                     |
| `public/`          | Responsive HTML/CSS and JavaScript modules                                 |
| `test/api.test.js` | Integration tests against MongoDB                                          |
| `postman/`         | Ordered API acceptance collection and local environment                    |
| `docs/`            | Report, API reference, setup, viva guide and test evidence                 |
| `render.yaml`      | Render web-service configuration                                           |
| `compose.yaml`     | Local persistent MongoDB replica set                                       |

## Security and limits

Passwords are hashed with bcrypt. Sessions and uploaded image bytes live in MongoDB, so image files and sessions survive web-service restarts. Cookies are HTTP-only, same-site and secure in production. Mutation requests require a session-specific CSRF header. Session identifiers rotate after authentication. API and authentication routes are rate-limited. Public responses omit passwords, email and private claim evidence. User-provided text is escaped before being inserted into HTML. Uploaded files are checked by byte signature and served with a strict image content type and nosniff headers. Images are not malware-scanned or re-encoded; content moderation and stronger media processing are future work.

Reports with claims cannot be deleted or rewritten; close them instead. Recovered items cannot be reopened. Closing an item leaves existing requests visible for history; they can be rejected, but approval requires the item to remain open. Manual item status changes do not review requests. Matching is a heuristic, not identity verification. Admin chart counts are exact; visual progress lengths are relative to the largest category. Claims are capped at the most recent 200 records per authorized scope; larger deployments need pagination. Search uses escaped case-insensitive expressions and is suitable for a small campus dataset; scale requires a dedicated text index/search service. There is no email verification, password reset or messaging in this assignment version. Use the campus help desk for handovers.

## Deployment and submission

See `docs/DEPLOYMENT.md`, `docs/API.md`, `docs/VIVA.md` and `docs/SUBMISSION.md`. A Render configuration is supplied, but no cloud deployment or GitHub publication is claimed without the corresponding account setup and verified URLs. The report content is complete for the implemented scope; final formatting must be transferred into the prescribed Sai University template once supplied. Replace student/instructor details and deployment/repository placeholders before submission.

## AI assistance

AI assistance was used to develop the initial design, code, tests and documentation. The student must review, understand, adapt and verify the work, disclose assistance according to institutional rules, and demonstrate the application individually. No claim is made that this project has already been approved by the instructor.

## References

- Express security guidance: https://expressjs.com/en/advanced/best-practice-security/
- Express session middleware: https://expressjs.com/en/resources/middleware/session/
- Mongoose validation: https://mongoosejs.com/docs/validation.html
- MongoDB transactions: https://www.mongodb.com/docs/manual/core/transactions/
- Postman testing: https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/
