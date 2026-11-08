# Deploy with GitHub Render and MongoDB Atlas

## 1 Prepare GitHub

Create a private or public empty repository named campusfind in your own GitHub account. From the project root run:

```bash
git init
git add .
git commit -m "Build CampusFind full-stack portal"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Check that `.env` and `node_modules` are ignored before pushing. The GitHub Actions workflow runs the source checks and integration tests on pushes and pull requests. Keep an honest commit history of your own review and changes.

## 2 Prepare MongoDB Atlas

Create an Atlas cluster and a database user with only the permissions needed for the campusfind database (read/write). Add the deployment service's documented outbound IP addresses to Atlas Network Access. Use its official connection workflow to obtain the driver URI. Set the database path to campusfind. Percent-encode reserved characters in the database password. Do not commit or send the connection URI in chat.

Atlas supports replica-set transactions required for claim approval. For local installations use the supplied replica-set Compose configuration. A standalone local mongod will fail during transactional claim review.

## 3 Create the Render service

Connect your GitHub repository to Render and create a Node web service using the included Blueprint or configure it manually:

- Build: `npm ci --omit=dev`
- Start: `npm start`
- Health check: `/api/health`
- Runtime: Node 24
- Environment: NODE_ENV=production; MONGODB_URI=your Atlas URI; SESSION_SECRET=a random value of at least 32 characters.

The application listens on Render's PORT. TLS is terminated by the host; Express trusts one reverse proxy and marks production cookies secure. Keep same-origin frontend/API hosting. Do not open the app over plain HTTP in production.

## 4 Seed once

Set ADMIN_EMAIL, ADMIN_PASSWORD and DEMO_PASSWORD temporarily for the seed operation and run `npm run seed` in the deployed service's authorized shell if available. Alternatively run it locally with the same Atlas URI in a private `.env`. The seed is repeatable and preserves existing data. Remove seed-only passwords from the service after provisioning. Use your chosen credentials to log in; there are no hard-coded production passwords.

## 5 Verify the real deployment

Record the exact deployed HTTPS URL. Check health, registration, login, image upload, filtering, user dashboard, two-account claim approval, admin access and logout. Restart/redeploy the service, then verify that listings, images and account/session records remain in Atlas. Run the collection against an isolated staging database or use intentional manual test records. Do not claim deployment is complete until these checks pass.

Take screenshots for the report and Postman Runner. Update report, README, and Classroom submission with actual URLs. The account connection, cloud provisioning and final deployed smoke test remain external setup steps until account access is available.

## Troubleshooting

- 503 health: inspect the database URI, network allowlist and database permissions.
- Login does not persist in production: use HTTPS and confirm reverse-proxy settings.
- Claim approval transaction error: use Atlas or a correctly initialized replica set.
- Image fails: allowed signatures are PNG, JPEG and WebP, with a 3 MB limit.
- Token expired: refresh the page; Postman must fetch auth/me and use the current CSRF value after login/logout.
- Rate limit: wait for the 15-minute window rather than disabling protection on production.
