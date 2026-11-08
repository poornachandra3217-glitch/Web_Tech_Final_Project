# Individual demonstration and viva guide

## Demonstration sequence

1. Open the home page. Explain that listings and statistics come from the Express API and MongoDB.
2. Search for an item, filter by building/category/type and switch date sorting.
3. Register a student and publish a report, optionally with an image.
4. Open the listing and explain the possible-match score. Suggestions do not verify ownership.
5. Sign in as another student and submit private identifying evidence.
6. Sign back in as the reporter, review the incoming request and approve it.
7. Show recovered item status and the request decision in the claimant dashboard.
8. Open the admin account to demonstrate statistics and management controls.
9. Show an unauthorized API attempt returning 403, then explain ownership checks.
10. Show the actual Postman run, integration results and persistent cloud deployment if configured.

## Questions to practise

**Why a full-stack application?** HTML/CSS define structure and presentation. Browser modules fetch dynamic JSON. Express handles business rules and MongoDB persists users, items, claims, image bytes and sessions.

**What does middleware do?** Helmet sets security headers; JSON/multipart parsers process bodies; session middleware loads the session; CSRF middleware rejects untrusted changes; user middleware loads the account; auth/role middleware restricts routes; error middleware returns controlled errors.

**Authentication versus authorization?** Authentication identifies the signed-in account. Authorization checks whether that person owns the listing or has the administrator role before edits/reviews.

**Why hash passwords?** A salted bcrypt hash lets the server verify a password without storing its plaintext. Passwords are limited by bcrypt's 72-byte maximum and require at least 10 characters.

**Why cookies instead of localStorage tokens?** Session data stays in MongoDB. The browser gets an opaque HTTP-only cookie, reducing direct JavaScript access to the credential. CSRF protection is still required for cookie-authenticated mutations.

**Why regenerate the session?** Login/registration replaces the anonymous session identifier, preventing session fixation. The client also receives the new CSRF token.

**Why require a replica set?** Claim approval changes several documents atomically. A transaction makes the item and all related claim decisions succeed or fail together.

**How are duplicate claims prevented?** The compound unique index on item and claimant prevents races that a simple pre-insert check cannot reliably stop.

**How does matching work?** Only open opposite-type reports in the same category qualify. Same location adds 3 points; each item-name word longer than two characters appearing in the candidate name/description adds 2; dates less than seven days apart add 1. Results sort descending and return the top four. Explain the limits of this heuristic.

**How is private evidence protected?** The claims query includes only the claimant's requests and requests for listings owned by that user, unless the user is admin. Public listing APIs never join evidence into a response.

**How is XSS reduced?** Text is escaped before HTML insertion. Photos use restricted image signatures/content types. A same-origin Content Security Policy blocks inline scripts. No protection should be described as perfect or a replacement for review.

**How do uploaded photos persist?** A maximum 3 MB buffer is stored in MongoDB. Rendering requests the image endpoint, which sets the validated MIME type. This avoids reliance on an ephemeral host filesystem.

**How are Promises used?** Async/await handles database and Fetch calls. Promise.all performs independent retrievals together, for example list data and count. Errors propagate to a central handler.

**What could be improved?** Email verification, password recovery, managed campus SSO, image re-encoding/moderation, claim pagination, indexed search, a larger test dataset and a campus-approved retention policy.

## Small modifications to practise yourself

- Add an approved campus building to LOCATIONS and explain the frontend metadata request.
- Change page size and locate the API pagination calculation.
- Add an input validation constraint and a meaningful failing test.
- Adjust date-proximity scoring and show how matches change.
- Add a read-only dashboard metric using a MongoDB count query.

## Code reading path

Read models.js, then server.js, then app.js (middleware before routes), api.js, icons.js and app.js in public/. Trace one report submission from form event through Fetch, CSRF/auth checks, validation and Item.create, then back to the success UI. Run the tests before and after your modification.
