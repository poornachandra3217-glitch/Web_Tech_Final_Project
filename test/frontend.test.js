// DOM smoke tests exercise actual frontend modules against an Express/MongoDB API.
// These verify behaviour, not browser layout or rendering.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { seed } from "../src/seed.js";
let db,
  server,
  dom,
  base,
  originalFetch = global.fetch,
  cookie = "";
const NativeFormData = global.FormData;
async function until(predicate) {
  const limit = Date.now() + 6000;
  while (Date.now() < limit) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(
    "UI did not reach the expected state: " +
      document.querySelector("main")?.textContent.slice(0, 300),
  );
}
function click(s) {
  const el = document.querySelector(s);
  assert.ok(el, `Missing ${s}`);
  el.click();
}
function fill(s, value) {
  const el = document.querySelector(s);
  assert.ok(el);
  el.value = value;
}
function submit(s) {
  document
    .querySelector(s)
    .dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
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
  await seed({
    adminEmail: "admin@example.com",
    adminPassword: "Frontend-Admin-123!",
    demoPassword: "Frontend-Student-123!",
  });
  server = createApp({
    secret: "frontend-only-integration-secret-with-at-least-48-characters",
    testing: true,
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  dom = new JSDOM(fs.readFileSync("public/index.html", "utf8"), {
    url: base + "/#/",
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.location = dom.window.location;
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  global.FormData = class extends NativeFormData {
    constructor(form) {
      super();
      if (form) {
        for (const [k, v] of new dom.window.FormData(form))
          if (typeof v === "string") this.append(k, v);
      }
    }
  };
  global.fetch = async (url, options = {}) => {
    const headers = new Headers(options.headers);
    if (cookie) headers.set("cookie", cookie);
    const response = await originalFetch(new URL(url, base), {
      ...options,
      headers,
    });
    const set = response.headers.getSetCookie();
    if (set.length) cookie = set[0].split(";")[0];
    return response;
  };
  await import("../public/app.js");
});
after(async () => {
  global.fetch = originalFetch;
  global.FormData = NativeFormData;
  dom?.window.close();
  await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  await db?.stop();
});
test("29 home module renders real database listings and statistics", () => {
  assert.match(document.querySelector("h1").textContent, /Lost something/);
  assert.equal(document.querySelectorAll(".card").length, 8);
  assert.match(document.querySelector(".stats-strip").textContent, /12/);
});
test("30 search form navigates to a filtered result", async () => {
  fill('[name="q"]', "Sony");
  submit("#search-form");
  await until(() => document.querySelectorAll(".card").length === 1);
  assert.match(document.querySelector(".card h3").textContent, /Sony/);
});
test("31 sign-in form loads the student dashboard", async () => {
  location.hash = "#/login";
  await until(() => document.querySelector("#auth-form"));
  fill("#email", "student@example.com");
  fill("#password", "Frontend-Student-123!");
  submit("#auth-form");
  await until(() => document.querySelector(".dashboard-stats"));
  assert.match(document.querySelector("h1").textContent, /Demo/);
  assert.ok(document.querySelectorAll(".card").length > 0);
});
test("32 report form publishes a persistent listing and opens detail", async () => {
  location.hash = "#/report?type=lost";
  await until(() => document.querySelector("#report-form"));
  fill("#name", "Frontend test notebook");
  fill("#category", "Books");
  fill("#location", "Library");
  fill(
    "#description",
    "A test notebook with orange page tabs and a blue cover.",
  );
  submit("#report-form");
  await until(
    () =>
      document.querySelector(".detail-copy h1")?.textContent ===
      "Frontend test notebook",
  );
  assert.match(
    document.querySelector(".detail-copy").textContent,
    /Demo Student/,
  );
});
test("33 sign-out clears protected navigation and account session", async () => {
  click("#logout");
  await until(() =>
    document.querySelector("#account")?.textContent.includes("Sign in"),
  );
  const r = await global.fetch("/api/auth/me");
  assert.equal((await r.json()).user, null);
});
