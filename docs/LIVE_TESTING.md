# CampusFind live testing evidence

Verified 8 November 2026.

- Live API workflow: 36 checks passed, zero failed.
- Separate administrator/student smoke: 12 checks passed.
- Live Postman/Newman: 26 requests, 29 assertions, zero failures.
- Existing API/DOM regression CI passed on the QA commit.

## Availability incident

The initial health request timed out after 90 seconds before any mutation. Redeployed the same application commit; all live suites subsequently passed. The underlying cause was not established.

## Evidence

- CampusFind_Live_Testing_Evidence.pdf: readable tables and browser screenshots.
- live-testing/live-results.json: per-check outcomes.
- live-testing/postman-live-results.json: sanitized HTTP statuses and assertions.
- live-testing/console.txt: actual Newman console output.
- admin-live-results.json: private-credential smoke outcomes; no credentials.
- verification-summary.json: aggregate scope and provenance.
- postman/: importable original collection and local environment.
- scripts/live-check.js: live test source.

Successful workflow: https://github.com/poornachandra3217-glitch/Web_Tech_Final_Project/actions/runs/42497400267

## Remaining visual verification

Authenticated dashboard screenshots and physical mobile layout checks remain. If your instructor specifically requires Postman GUI screenshots, capture those in the desktop Runner. This package honestly records Newman execution and does not fabricate GUI screenshots.

## Re-running

Live tests create new synthetic users and retained claim history. Run only with authorization. Do not repeatedly run the original collection against the live database; its broad search is intended for isolated testing. Use the included live script only in an approved assessment workflow. No production credentials are included.
