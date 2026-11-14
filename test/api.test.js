import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { User, Item, Claim } from "../src/models.js";
import { seed } from "../src/seed.js";
let db,
  app,
  reporter,
  claimant,
  stranger,
  admin,
  reporterToken,
  claimantToken,
  strangerToken,
  adminToken,
  itemId,
  claimId,
  otherClaimId;
const secret = "integration-tests-only-secret-with-48-characters";
const base = {
  name: "Blue test backpack",
  category: "Bags",
  description: "A blue backpack with a distinctive stitched pocket.",
  location: "Library",
  date: "2026-01-01",
  type: "found",
};
async function register(name, email) {
  const agent = request.agent(app);
  let r = await agent.get("/api/auth/me");
  const token = r.body.csrfToken;
  r = await agent
    .post("/api/auth/register")
    .set("x-csrf-token", token)
    .send({ name, email, password: "Test-Password-123!" });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return [agent, r.body.csrfToken, r.body.user];
}
before(async () => {
  db = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
      args: ["--nounixsocket"],
    },
  });
  await mongoose.connect(db.getUri());
  await Promise.all([User.init(), Item.init(), Claim.init()]);
  app = createApp({ secret, testing: true });
  [reporter, reporterToken] = await register(
    "Reporter",
    "reporter@example.com",
  );
  [claimant, claimantToken] = await register(
    "Claimant",
    "claimant@example.com",
  );
  [stranger, strangerToken] = await register(
    "Other Student",
    "other@example.com",
  );
  let user;
  [admin, adminToken, user] = await register(
    "Administrator",
    "admin-test@example.com",
  );
  await User.findByIdAndUpdate(user.id, { role: "admin" });
});
after(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
test("01 public metadata and session token are available", async () => {
  const r = await request(app).get("/api/meta");
  assert.equal(r.status, 200);
  assert.ok(r.body.locations.includes("Library"));
});
test("02 rejects registration with invalid email and short password", async () => {
  const a = request.agent(app);
  const t = (await a.get("/api/auth/me")).body.csrfToken;
  const r = await a
    .post("/api/auth/register")
    .set("x-csrf-token", t)
    .send({ name: "Test", email: "bad", password: "short" });
  assert.equal(r.status, 400);
});
test("03 requires CSRF token for writes", async () => {
  const r = await reporter.post("/api/items").send(base);
  assert.equal(r.status, 403);
});
test("04 denies unauthenticated report creation", async () => {
  const a = request.agent(app);
  const t = (await a.get("/api/auth/me")).body.csrfToken;
  const r = await a.post("/api/items").set("x-csrf-token", t).send(base);
  assert.equal(r.status, 401);
});
test("05 creates a persistent item", async () => {
  const r = await reporter
    .post("/api/items")
    .set("x-csrf-token", reporterToken)
    .send(base);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  itemId = r.body.id;
  assert.ok(await Item.findById(itemId));
});
test("06 rejects invalid report fields", async () => {
  const r = await reporter
    .post("/api/items")
    .set("x-csrf-token", reporterToken)
    .send({ ...base, date: "2099-01-01", category: "Invalid" });
  assert.equal(r.status, 400);
});
test("07 retrieves keyword/category/location/type-filtered items", async () => {
  const r = await request(app)
    .get("/api/items")
    .query({ q: "blue", category: "Bags", location: "Library", type: "found" });
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 1);
});
test("08 detail does not leak reporter email or password hash", async () => {
  const r = await request(app).get(`/api/items/${itemId}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.owner.email, undefined);
  assert.equal(r.body.owner.passwordHash, undefined);
});
test("09 blocks another user from editing or deleting", async () => {
  let r = await claimant
    .patch(`/api/items/${itemId}`)
    .set("x-csrf-token", claimantToken)
    .send({ status: "closed" });
  assert.equal(r.status, 403);
  r = await claimant
    .delete(`/api/items/${itemId}`)
    .set("x-csrf-token", claimantToken);
  assert.equal(r.status, 403);
});
test("10 reporter can update listing", async () => {
  const r = await reporter
    .patch(`/api/items/${itemId}`)
    .set("x-csrf-token", reporterToken)
    .send({ ...base, name: "Updated blue backpack" });
  assert.equal(r.status, 200);
  assert.equal((await Item.findById(itemId)).name, "Updated blue backpack");
});
test("11 rejects disguised image upload", async () => {
  const r = await reporter
    .post("/api/items")
    .set("x-csrf-token", reporterToken)
    .field(base)
    .attach("image", Buffer.from('<svg onload="alert(1)"></svg>'), {
      filename: "fake.png",
      contentType: "image/png",
    });
  assert.equal(r.status, 400);
});
test("12 creates claim and prevents duplicate claim", async () => {
  let r = await claimant
    .post(`/api/items/${itemId}/claims`)
    .set("x-csrf-token", claimantToken)
    .send({ evidence: "The inside pocket has a stitched orange star." });
  assert.equal(r.status, 201);
  claimId = r.body.id;
  r = await claimant
    .post(`/api/items/${itemId}/claims`)
    .set("x-csrf-token", claimantToken)
    .send({ evidence: "The same distinguishing mark is inside." });
  assert.equal(r.status, 409);
});
test("13 reporter cannot claim own item", async () => {
  const r = await reporter
    .post(`/api/items/${itemId}/claims`)
    .set("x-csrf-token", reporterToken)
    .send({ evidence: "Trying to claim my own item with some evidence." });
  assert.equal(r.status, 400);
});
test("14 strangers cannot see private evidence", async () => {
  const r = await stranger.get("/api/claims");
  assert.equal(r.status, 200);
  assert.equal(r.body.claims.length, 0);
});
test("15 claimant cannot approve own claim", async () => {
  const r = await claimant
    .patch(`/api/claims/${claimId}`)
    .set("x-csrf-token", claimantToken)
    .send({ status: "approved" });
  assert.equal(r.status, 403);
});
test("16 preserve history: item with claims cannot be deleted or rewritten", async () => {
  let r = await reporter
    .delete(`/api/items/${itemId}`)
    .set("x-csrf-token", reporterToken);
  assert.equal(r.status, 409);
  r = await reporter
    .patch(`/api/items/${itemId}`)
    .set("x-csrf-token", reporterToken)
    .send(base);
  assert.equal(r.status, 409);
});
test("17 second claimant can request item", async () => {
  const r = await stranger
    .post(`/api/items/${itemId}/claims`)
    .set("x-csrf-token", strangerToken)
    .send({ evidence: "I think the bag contains a green notebook." });
  assert.equal(r.status, 201);
  otherClaimId = r.body.id;
});
test("18 atomic approval recovers item and rejects competing pending claims", async () => {
  const r = await reporter
    .patch(`/api/claims/${claimId}`)
    .set("x-csrf-token", reporterToken)
    .send({
      status: "approved",
      reviewNote: "Collect through the campus help desk.",
    });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await Item.findById(itemId)).status, "recovered");
  assert.equal((await Claim.findById(claimId)).status, "approved");
  assert.equal((await Claim.findById(otherClaimId)).status, "rejected");
});
test("19 prevents repeat review and reopening recovered item", async () => {
  let r = await reporter
    .patch(`/api/claims/${claimId}`)
    .set("x-csrf-token", reporterToken)
    .send({ status: "rejected" });
  assert.equal(r.status, 409);
  r = await reporter
    .patch(`/api/items/${itemId}`)
    .set("x-csrf-token", reporterToken)
    .send({ status: "open" });
  assert.equal(r.status, 409);
});
test("20 student cannot access admin statistics; admin can", async () => {
  let r = await claimant.get("/api/admin/stats");
  assert.equal(r.status, 403);
  r = await admin.get("/api/admin/stats");
  assert.equal(r.status, 200);
  assert.equal(r.body.users, 4);
});
test("21 malformed IDs and filter operators return controlled errors", async () => {
  let r = await request(app).get("/api/items/not-an-id");
  assert.equal(r.status, 400);
  r = await request(app).get("/api/items?type[$ne]=lost");
  assert.equal(r.status, 200);
  r = await request(app).get("/api/items?type=bad");
  assert.equal(r.status, 400);
});
test("22 rejects wrong password and logs out fully", async () => {
  const a = request.agent(app);
  let t = (await a.get("/api/auth/me")).body.csrfToken;
  let r = await a
    .post("/api/auth/login")
    .set("x-csrf-token", t)
    .send({ email: "reporter@example.com", password: "Wrong-Password" });
  assert.equal(r.status, 401);
  r = await a
    .post("/api/auth/login")
    .set("x-csrf-token", t)
    .send({ email: "reporter@example.com", password: "Test-Password-123!" });
  assert.equal(r.status, 200);
  t = r.body.csrfToken;
  r = await a.post("/api/auth/logout").set("x-csrf-token", t);
  assert.equal(r.status, 200);
  r = await a.get("/api/auth/me");
  assert.equal(r.body.user, null);
});
test("23 possible matches include opposite type in same category", async () => {
  let r = await reporter
    .post("/api/items")
    .set("x-csrf-token", reporterToken)
    .send({ ...base, type: "lost", name: "Blue backpack missing" });
  const lostId = r.body.id;
  r = await stranger
    .post("/api/items")
    .set("x-csrf-token", strangerToken)
    .send({ ...base, name: "Blue backpack found" });
  const foundId = r.body.id;
  r = await request(app).get(`/api/items/${lostId}/matches`);
  assert.equal(r.status, 200);
  assert.ok(r.body.matches.some((x) => String(x._id) === foundId));
});
test("24 seed is repeatable, preserves data and provides 12 samples", async () => {
  const options = {
    adminEmail: "seed-admin@example.com",
    adminPassword: "Seed-Admin-Password-123!",
    demoPassword: "Seed-Student-Password-123!",
  };
  await seed(options);
  await seed(options);
  assert.equal(await Item.countDocuments({ sample: true }), 12);
  assert.ok(await Item.findById(itemId));
});
test("25 static frontend and security headers are served", async () => {
  const r = await request(app).get("/");
  assert.equal(r.status, 200);
  assert.match(r.text, /CampusFind/);
  assert.ok(r.headers["content-security-policy"]);
  assert.equal(r.headers["x-powered-by"], undefined);
});
test("26 accepts real image bytes and retrieves the persisted photo", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
    "base64",
  );
  let r = await reporter
    .post("/api/items")
    .set("x-csrf-token", reporterToken)
    .field(base)
    .attach("image", png, { filename: "tiny.png", contentType: "image/png" });
  assert.equal(r.status, 201);
  const photoId = r.body.id;
  r = await request(app).get(`/api/items/${photoId}/image`);
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /image\/png/);
  assert.deepEqual(r.body, png);
  r = await reporter
    .delete(`/api/items/${photoId}`)
    .set("x-csrf-token", reporterToken);
  assert.equal(r.status, 200);
});
test("27 concurrent claim approvals produce exactly one winner", async () => {
  let r = await reporter
    .post("/api/items")
    .set("x-csrf-token", reporterToken)
    .send({ ...base, name: "Concurrency test item" });
  const concurrentId = r.body.id;
  const a = await claimant
    .post(`/api/items/${concurrentId}/claims`)
    .set("x-csrf-token", claimantToken)
    .send({ evidence: "A private ownership mark known only by the owner." });
  const b = await stranger
    .post(`/api/items/${concurrentId}/claims`)
    .set("x-csrf-token", strangerToken)
    .send({ evidence: "Another distinctive private mark for verification." });
  const results = await Promise.all(
    [a.body.id, b.body.id].map((cid) =>
      reporter
        .patch(`/api/claims/${cid}`)
        .set("x-csrf-token", reporterToken)
        .send({ status: "approved" }),
    ),
  );
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 409]);
  assert.equal(
    await Claim.countDocuments({ item: concurrentId, status: "approved" }),
    1,
  );
  assert.equal(
    await Claim.countDocuments({ item: concurrentId, status: "rejected" }),
    1,
  );
});
test("28 rejects short claim evidence", async () => {
  const i = await Item.findOne({
    status: "open",
    owner: { $ne: (await User.findOne({ email: "claimant@example.com" }))._id },
  });
  const r = await claimant
    .post(`/api/items/${i.id}/claims`)
    .set("x-csrf-token", claimantToken)
    .send({ evidence: "mine" });
  assert.equal(r.status, 400);
});

test("complaints are private and only administrators can resolve them", async () => {
  const created = await reporter
    .post("/api/complaints")
    .set("x-csrf-token", reporterToken)
    .send({
      subject: "Incorrect campus location",
      description: "The listing references the wrong campus building.",
      status: "resolved",
    });
  assert.equal(created.status, 201);
  const url = "/api/admin/complaints/" + created.body.id;
  assert.equal(
    (await claimant.get("/api/complaints")).body.complaints.length,
    0,
  );
  assert.equal((await claimant.get("/api/admin/complaints")).status, 403);
  const payload = {
    status: "resolved",
    response: "The location has been corrected.",
  };
  assert.equal(
    (await reporter.patch(url).set("x-csrf-token", reporterToken).send(payload))
      .status,
    403,
  );
  const queue = await admin.get("/api/admin/complaints?status=open");
  assert.equal(queue.status, 200);
  assert.equal(queue.body.complaints[0]._id, created.body.id);
  assert.equal(
    (await admin.patch(url).set("x-csrf-token", adminToken).send(payload))
      .status,
    200,
  );
  const mine = await reporter.get("/api/complaints");
  assert.equal(mine.body.complaints[0].status, "resolved");
  assert.equal(mine.body.complaints[0].response, payload.response);
});

test("administrator sign-in refuses a student without creating a session", async () => {
  const visitor = request.agent(app);
  const { body } = await visitor.get("/api/auth/me");
  const denied = await visitor
    .post("/api/auth/admin-login")
    .set("x-csrf-token", body.csrfToken)
    .send({ email: "reporter@example.com", password: "Test-Password-123!" });
  assert.equal(denied.status, 403);
  assert.equal((await visitor.get("/api/auth/me")).body.user, null);
});
