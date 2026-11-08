# Campus Lost and Found Portal

Sai University · School of Computing and Data Science
Academic Year 2026–2027

## 1 Abstract and objectives

CampusFind is a database-driven web application for reporting and recovering personal belongings on campus. Students can publish lost or found reports, search listings, provide private identifying evidence and track recovery decisions. Reporters and administrators review requests while the database preserves the history of each recovery. The interface uses semantic HTML, responsive CSS and JavaScript modules, with an Express REST API and MongoDB persistence.

The implemented application covers account access, listing CRUD, search and filters, student and administrator dashboards, image storage and a transactional claim workflow. Automated integration tests and an ordered Postman collection check successful operations and failure cases. Cloud publication and institution-specific report formatting are submission tasks that require final account and template configuration.

### Problem and objectives

- Provide one searchable campus noticeboard for lost and found belongings.
- Let students create, update and track their own reports through authenticated access.
- Protect identifying evidence from public viewing and restrict claim review to authorized users.
- Preserve account, item, image, claim and session data in a persistent MongoDB database.
- Reduce manual searching through date sorting, building filters and explainable possible-match suggestions.
- Demonstrate middleware, REST APIs, database CRUD, validation, async JavaScript and security checks.

### Scope and users

Visitors can browse public reports. Registered students can report items, manage their own listings and submit recovery requests on other listings. Reporters can review requests on their items. Administrators can manage campus listings and review all requests. Handovers take place through authorized campus staff rather than an unverified public contact exchange.

### Additional feature

Possible-match suggestions compare open reports of opposite types within the same category. Location, item-name keywords and date proximity contribute to a transparent score. These suggestions help discovery but do not establish ownership. The feature must be assigned or approved by the instructor before it is presented as the approved custom feature.

## 2 Requirements and system design

The browser and API are served from the same Express origin. This keeps cookie authentication and Fetch calls simple and avoids unnecessary cross-origin configuration. MongoDB stores application records and sessions, and supports multi-document transactions for claim approval.

| Layer        | Implementation                                                            |
| ------------ | ------------------------------------------------------------------------- |
| Presentation | Semantic HTML, responsive CSS, ES module JavaScript                       |
| Application  | Node.js and Express middleware and REST endpoints                         |
| Data         | MongoDB with Mongoose schemas, indexes and transactions                   |
| Testing      | Node test runner, Supertest, Postman collection and Newman                |
| Delivery     | Git-ready source, CI workflow, Render configuration and Atlas setup guide |

### Architecture

Figure 1. Browser requests pass through Express middleware before application data is read or changed in MongoDB. Public listing data and private claim data use different authorization rules.

### Recovery state changes

A report starts open. A recovery request starts pending. Approval changes the selected request to approved, changes the item to recovered and rejects its other pending requests inside one transaction. Rejection leaves the item available for another verified request. A reporter may close a report without deleting its history. Recovered reports cannot be reopened.

### Responsive and accessible interface

The layout adapts from a four-column desktop noticeboard to a two-column phone view. Labels, native form constraints, focus states, a skip link, text status badges and live status messages support keyboard and assistive-technology use. Reduced-motion preferences disable transitions. Full visual and device verification must be completed on the final deployed application.

## 3 Database design

Mongoose models define the expected data and validation rules. MongoDB identifiers connect users, items and claims. The sessions collection is maintained by the session store. Uploaded image buffers remain in the database so deployments do not depend on an ephemeral local filesystem.

| Collection | Principal fields                                                                    | Relationships                                         |
| ---------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| users      | name, email, passwordHash, role, timestamps                                         | One user owns many items and submits many claims      |
| items      | name, description, type, category, location, date, status, image, imageType, sample | owner references users                                |
| claims     | evidence, status, reviewNote, reviewedBy, timestamps                                | item and claimant reference items and users           |
| sessions   | session data and expiry                                                             | Opaque cookie identifier resolves server-side session |

### Indexes and integrity

- Unique email index prevents duplicate registrations. Emails are normalized to lowercase.
- Compound unique index on item and claimant prevents repeated claims, including concurrent inserts.
- Listing indexes support recent reports and combinations of type, category, location and status.
- Schema enums constrain roles, listing types, statuses, categories and buildings.
- Input validation rejects invalid or future dates and descriptions that are too short.
- Records with claims cannot be deleted or rewritten; close them to preserve the recovery audit trail.

### Concurrency and transactions

MongoDB replica-set transactions protect the approval workflow. The update requires the item to be open and the request to be pending. Simultaneous approval attempts can produce only one winning recovery. The transaction commits all related state changes together. Atlas or the local replica-set configuration is required; a standalone MongoDB process cannot support this operation.

### Sample data

The non-destructive seed creates an administrator, a demonstration student and 12 clearly labelled reports across electronics, cards, bags, keys, books, clothing and accessories. The records include several campus locations and a mixture of lost and found listings. Re-running the seed preserves existing data and does not duplicate its sample listings or reset existing passwords.

## 4 Implementation and security

### Frontend implementation

The main HTML document provides landmarks, navigation, the application container, dialog and live status area. JavaScript modules separate API/session handling, icons and page rendering. Hash-based routes select the home page, browse view, report form, item details, dashboards and account screens. Fetch requests use async/await; independent reads use Promise.all. Search forms, tabs and buttons use DOM event listeners, and user text is escaped before insertion into HTML.

### Backend implementation

Express middleware sets security headers, parses request bodies, loads MongoDB-backed sessions, applies rate limits, verifies CSRF headers and retrieves the authenticated user. Route handlers validate input, enforce ownership or role checks and perform database operations. A centralized error handler returns consistent JSON errors and hides unexpected server details from clients.

### Authentication and authorization

Registration creates only student accounts. Passwords are salted and hashed using bcrypt with cost factor 12. Passwords require at least 10 characters and are limited to 72 UTF-8 bytes. Login and registration regenerate the session identifier and CSRF token. Cookies are HTTP-only and same-site, and use the secure flag in production. Logout destroys the server session. The administrator role is provisioned through the seed rather than accepted from registration input.

Listing edits and deletion require the reporter or an administrator. Request review applies the same ownership rule. The claim retrieval query scopes results to the claimant or listing reporter unless the requester is an administrator. Public detail responses include the reporter name, but omit email, password hash and claim evidence.

### Uploads and error handling

Optional photo uploads are limited to one file and 3 MB. Byte signatures restrict accepted data to PNG, JPEG or WebP. The image endpoint serves the validated MIME type with security headers. Images are not malware-scanned or re-encoded, which is a limitation for future production hardening. Controlled errors distinguish invalid input, anonymous access, forbidden actions, missing records, conflicts and rate limits.

### Custom matching algorithm

Candidates must be open, belong to the same category and have the opposite report type. A matching campus location adds 3 points. Each name word longer than two characters found in the candidate name or description adds 2 points. Dates less than seven days apart add 1 point. Up to four results are returned in descending score order. This heuristic is explainable and intentionally does not claim identity verification.

## 5 API testing and results

The automated integration suite uses a real isolated MongoDB replica set, Supertest and the Node test runner. It exercises successful requests and negative cases rather than merely checking HTTP availability. Test output is retained in docs/test-results.txt. The Postman collection uses a cookie jar and rotating CSRF tokens and is also executable through Newman. Its actual run output is retained separately. The verified run passed all 28 integration tests and all 29 Postman assertions across 26 requests.

| Case group          | Expected behaviour                                                                     |
| ------------------- | -------------------------------------------------------------------------------------- |
| Authentication      | Valid accounts succeed; invalid input and wrong passwords fail; logout removes access  |
| Listing CRUD        | Report creation, retrieval and owner update succeed; other users cannot edit or delete |
| Search and metadata | Keyword and category/building/type filters retrieve the intended records               |
| Upload security     | Valid image bytes are persisted and retrieved; disguised image content is rejected     |
| Claim privacy       | Unrelated users cannot retrieve private evidence; claimant cannot approve own request  |
| Claim integrity     | Duplicate/self claims fail; history blocks destructive deletion or rewriting           |
| Atomic recovery     | Approval recovers item and rejects competing requests; concurrency yields one winner   |
| Roles and sessions  | Student admin access fails; admin metrics succeed; CSRF failures are rejected          |

### Postman execution

Import the collection and environment, choose the local environment and run all requests in order. The sequence registers distinct reporter and claimant accounts, creates and updates a report, tests invalid and unauthorized actions, submits a request and approves it as the reporter. The collection retrieves CSRF tokens and relies on the retained session cookie. Use an isolated test database because each run creates demonstration records.

### Evidence and visual verification

The submission package contains command-line test evidence. Postman GUI Runner screenshots and application screenshots must be captured from the final running deployment. Browser-based visual verification was not completed in the current environment because its preview runtime could not start MongoDB. No UI screenshots or live-deployment results are represented as verified.

Capture the home noticeboard, filtered search, report form, student dashboard, claim review and administrator dashboard. Record a successful and invalid API request, an unauthorized request and the complete Postman Runner summary. Do not expose real credentials or private identifying evidence in screenshots.

## 6 Deployment and operation

The application includes a Render service configuration, Dockerfile, lockfile, GitHub Actions workflow and step-by-step deployment instructions. A single Express service serves frontend assets and REST APIs. MongoDB Atlas provides persistent application data and replica-set transactions. Images and sessions are stored in MongoDB and therefore survive replacement of the web-service filesystem.

| Configuration                  | Purpose                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| MONGODB_URI                    | Database connection; keep in private environment configuration |
| SESSION_SECRET                 | Random session signing secret of at least 32 characters        |
| NODE_ENV                       | Set production for secure cookies and deployed behaviour       |
| PORT                           | Hosting-provided service port                                  |
| ADMIN_EMAIL and ADMIN_PASSWORD | Administrator provisioning through the seed                    |
| DEMO_PASSWORD                  | Password for the seeded demonstration student                  |

### Deployment sequence

- Create the student-owned GitHub repository and push the complete reviewed source without .env.
- Create the Atlas database user and restrict network access to the hosting service as appropriate.
- Connect the repository to Render and configure private runtime variables.
- Build with npm ci --omit=dev and start with npm start; set health check to /api/health.
- Run the seed once through an authorized shell or a private local environment using the same database.
- Verify HTTPS, sign-in, uploads, two-account recovery, administrator access and logout on the actual deployment.
- Restart or redeploy and confirm that listings, photos and user data remain present in MongoDB.

### Operational boundaries

The application does not include email verification, password recovery or campus SSO. It uses a small-dataset search approach, and claim retrieval is limited to the latest 200 authorized records. Larger usage requires indexed search, claim pagination, stronger media processing and a campus-approved data-retention policy. Handover and identity checks remain human responsibilities.

### Submission details

Repository URL: [Insert verified GitHub URL]
Application URL: [Insert verified deployed HTTPS URL]
Student name and register number: [Complete before submission]
The final submission deadline is 30 November 2026 through Google Classroom. The student must complete the individual demonstration and viva.

## 7 Conclusion references and disclosure

### Results and conclusion

CampusFind implements the required lost-and-found workflow with persistent database models, authenticated access, role and ownership checks, dynamic search, report management and private recovery requests. The transaction-based approval workflow preserves consistency when more than one claim is pending. Matching suggestions provide an additional discovery tool while requiring manual ownership verification. Automated API checks establish evidence for the implemented backend behaviour; final visual, cloud and submission checks remain necessary before assessment.

### Future improvements

A future version could integrate institution-managed authentication, verified campus email, password recovery, notifications, a controlled handover workflow, photo re-encoding and moderation, and more scalable search and pagination. Such changes should follow campus policy and should be accompanied by tests for the new security and business rules.

### References

Express documentation. Production best practices for security. https://expressjs.com/en/advanced/best-practice-security/

Express documentation. Session middleware. https://expressjs.com/en/resources/middleware/session/

Mongoose documentation. Validation. https://mongoosejs.com/docs/validation.html

MongoDB documentation. Transactions. https://www.mongodb.com/docs/manual/core/transactions/

Postman documentation. Test scripts. https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/

### AI assistance disclosure

AI assistance was used to prepare the initial interface design, application code, test cases and documentation. The student is responsible for reviewing and adapting the implementation, verifying results, following institutional AI-use requirements and explaining the submitted code. This disclosure must be updated to reflect the student’s actual review and contributions; no claim of independent unaided authorship is made.

### Student review record

Reviewed modules: [Complete after review]
Changes implemented and understood: [Complete]
Instructor approval of additional feature: [Record approval]
Final deployed smoke test date: [Complete after verification]
