import { api, state, refreshSession } from "./api.js";
import { icon, itemIcon } from "./icons.js";
const $ = (s, el = document) => el.querySelector(s),
  $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
const shortDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;
let routeNumber = 0,
  toastTimer;
const toast = (m) => {
  clearTimeout(toastTimer);
  $("#toast").textContent = m;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4000);
};
const empty = (
  title = "Nothing here yet",
  text = "Your next campus connection starts with a report.",
) =>
  `<div class="empty">${icon("search")}<h3>${esc(title)}</h3><p>${esc(text)}</p><a class="button light small" href="#/report">Report an item ${icon("plus")}</a></div>`;
function art(i, detail = false) {
  return `<div class="item-art ${esc(i.category.split(" ")[0].toLowerCase())} ${detail ? "detail-art" : ""}">${i.hasImage ? `<img src="/api/items/${esc(i._id)}/image" alt="${esc(i.name)}" ${detail ? "" : 'loading="lazy"'}>` : icon(itemIcon(i))}${badge(i.status === "open" ? i.type : i.status)}${i.sample ? '<span class="sample-tag">DEMO LISTING</span>' : ""}</div>`;
}
function card(i) {
  return `<article class="card"><a class="card-link" href="#/items/${esc(i._id)}" aria-label="View ${esc(i.name)}">${art(i)}<div class="card-body"><div class="category">${esc(i.category)}</div><h3>${esc(i.name)}</h3><div class="card-meta">${icon("pin")}${esc(i.location)}</div><div class="card-meta">${icon("calendar")}${fmt(i.date)}</div><div class="card-bottom"><span>${i.type === "lost" ? "Help bring it home" : "Waiting for its person"}</span>${icon("arrow")}</div></div></a></article>`;
}
function navigation() {
  const hash = location.hash || "#/";
  $("#navigation").innerHTML = [
    ["#/", "Home"],
    ["#/browse", "Browse items"],
    ["#/guide", "How it works"],
    ...(state.user ? [["#/dashboard", "Dashboard"]] : []),
    ...(state.user?.role === "admin" ? [["#/admin", "Admin"]] : []),
  ]
    .map(
      ([url, label]) =>
        `<a href="${url}" class="${(url === "#/" ? hash === "#/" : hash.startsWith(url)) ? "active" : ""}" ${hash === url ? 'aria-current="page"' : ""}>${label}</a>`,
    )
    .join("");
  $("#account").innerHTML = state.user
    ? `<span class="avatar" title="${esc(state.user.name)}">${esc(state.user.name[0].toUpperCase())}</span><button class="button ghost small" id="logout">Sign out</button>`
    : `<a class="button ghost" href="#/login">Sign in</a><a class="button" href="#/report">${icon("plus")} Report item</a>`;
  $("#logout")?.addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      await refreshSession();
      location.hash = "#/";
      await render();
      toast("You have been signed out.");
    } catch (e) {
      toast(e.message);
    }
  });
}
function shell(html) {
  $("#main").innerHTML = `<div class="container reveal">${html}</div>`;
  navigation();
}
const head = (eyebrow, title, subtitle) =>
  `<div class="page-head"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>`;
function filters(params) {
  return `<form id="search-form" class="search-panel" role="search"><label class="search-box">${icon("search")}<input aria-label="Search items" name="q" placeholder="Search for something you've lost…" value="${esc(params.get("q") || "")}" maxlength="100"></label><select name="category" aria-label="Category"><option value="">All categories</option>${state.meta.categories.map((v) => `<option ${params.get("category") === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select><select name="location" aria-label="Campus building"><option value="">All locations</option>${state.meta.locations.map((v) => `<option ${params.get("location") === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select><select name="sort" aria-label="Sort by date"><option value="newest">Newest first</option><option value="oldest" ${params.get("sort") === "oldest" ? "selected" : ""}>Oldest first</option></select><button class="button" type="submit">Search ${icon("arrow")}</button></form>`;
}
function bindFilters(params) {
  $("#search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = new URLSearchParams(new FormData(e.target));
    if (params.get("type")) q.set("type", params.get("type"));
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    location.hash = `#/browse?${q}`;
  });
  $$("[data-type]").forEach((b) =>
    b.addEventListener("click", () => {
      const q = new URLSearchParams(params);
      b.dataset.type ? q.set("type", b.dataset.type) : q.delete("type");
      q.delete("page");
      location.hash = `#/browse?${q}`;
    }),
  );
  $$("[data-page]").forEach((b) =>
    b.addEventListener("click", () => {
      const q = new URLSearchParams(params);
      q.set("page", b.dataset.page);
      location.hash = `#/browse?${q}`;
    }),
  );
}
async function browse(home, params, token) {
  const [data, stats] = await Promise.all([
    api(`/items?${home ? "status=open" : params}`),
    home ? api("/stats") : Promise.resolve(null),
  ]);
  if (token !== routeNumber) return;
  const hero = home
    ? `<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="dot"></span> A SMALL ACT. A BIG DIFFERENCE.</div><h1>Lost something?<br>Let's <em>find it together.</em></h1><p>Your campus. Your community. One place to reconnect with the things that matter.</p><div class="hero-actions"><a class="button lime" href="#/report?type=lost">${icon("search")} I've lost something</a><a class="button outline" href="#/report?type=found">${icon("plus")} I found something</a></div><div class="trust-line">${icon("shield")} Built for the Sai University community</div></div><img class="hero-art" src="/art.svg" alt="Illustrated campus belongings: backpack, phone, keys and ID card"></section><div class="stats-strip">${[
        ["box", stats.open, "Open listings"],
        ["search", stats.lost, "Looking for a home"],
        ["check", stats.found, "Found & waiting"],
        ["users", stats.recovered, "Happy reunions"],
      ]
        .map(
          ([ic, n, t]) =>
            `<div class="stat"><span class="stat-icon">${icon(ic)}</span><div><strong>${n}</strong><small>${t}</small></div></div>`,
        )
        .join(
          "",
        )}</div><div class="section-heading"><div><h2>Around the campus</h2><p>Something familiar? Your belongings might be closer than you think.</p></div><a class="text-link" href="#/browse">View all listings ${icon("arrow")}</a></div>`
    : head(
        "THE CAMPUS NOTICEBOARD",
        "Find what you’re looking for.",
        "Search lost and found reports across the Sai University campus.",
      );
  shell(
    `${hero}${filters(params)}<div class="filter-bar"><div class="tabs">${[
      ["", "All items"],
      ["lost", "Lost"],
      ["found", "Found"],
    ]
      .map(
        ([v, t]) =>
          `<button class="tab ${(params.get("type") || "") === v ? "active" : ""}" data-type="${v}" aria-pressed="${(params.get("type") || "") === v}">${t}</button>`,
      )
      .join(
        "",
      )}</div><span class="count-label">${data.total} ${data.total === 1 ? "item" : "items"} ${home ? "waiting to reconnect" : "in this search"}</span></div><section aria-label="Item listings" class="grid">${
      data.items.length
        ? data.items
            .slice(0, home ? 8 : 12)
            .map(card)
            .join("")
        : empty(
            "No items found",
            "Try a different keyword, category or campus building.",
          )
    }</section>${home ? '<div class="center-action"><a class="button light" href="#/browse">Explore all listings ' + icon("arrow") + "</a></div>" : data.pages > 1 ? `<div class="pagination">${data.page > 1 ? `<button class="button light small" data-page="${data.page - 1}">Previous</button>` : ""}<span>Page ${data.page} of ${data.pages}</span>${data.page < data.pages ? `<button class="button light small" data-page="${data.page + 1}">Next</button>` : ""}</div>` : ""}${home ? `<aside class="help-band"><div><div class="eyebrow">KINDNESS COMES FULL CIRCLE</div><h3>Found something? Make someone’s day.</h3><p>A quick report could mean the world to someone looking for it.</p></div><a class="button" href="#/report?type=found">Report a found item ${icon("arrow")}</a></aside>` : ""}`,
  );
  bindFilters(params);
}
function formError(form, m) {
  let el = $(".error", form);
  if (!el) {
    el = document.createElement("div");
    el.className = "error";
    el.setAttribute("role", "alert");
    form.prepend(el);
  }
  el.textContent = m;
  el.scrollIntoView({ block: "nearest" });
}
function bindForm(id, handler) {
  const f = $(id);
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $('button[type="submit"]', f);
    b.disabled = true;
    try {
      await handler(f);
    } catch (e) {
      formError(f, e.message);
    } finally {
      b.disabled = false;
    }
  });
}
function authPage(register, params) {
  shell(
    `<div class="auth-layout"><section class="auth-intro"><div><div class="eyebrow">WELCOME TO YOUR CAMPUS COMMUNITY</div><h2>Good things<br>find their way<br>back.</h2><p>A little help from your campus can make all the difference.</p></div><img src="/art.svg" alt="An illustration of lost campus belongings"></section><section class="auth-form"><h2>${register ? "Join the community" : "Welcome back."}</h2><p class="form-subtitle">${register ? "Create your account and help your campus reconnect." : "Sign in to report, claim and reconnect."}</p><form id="auth-form">${register ? '<div class="field"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" maxlength="80" required></div>' : ""}<div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" maxlength="160" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" ${register ? 'minlength="10"' : ""} maxlength="72" required>${register ? "<small>Use at least 10 characters. Maximum 72 UTF-8 bytes.</small>" : ""}</div><button class="button" type="submit">${register ? "Create account" : "Sign in"} ${icon("arrow")}</button></form><p class="auth-switch">${register ? "Already part of the community?" : "New around here?"} <a href="#/${register ? "login" : "register"}?next=${encodeURIComponent(params.get("next") || "/dashboard")}">${register ? "Sign in" : "Create an account"}</a></p></section></div>`,
  );
  bindForm("#auth-form", async (f) => {
    const data = await api(`/auth/${register ? "register" : "login"}`, {
      method: "POST",
      body: Object.fromEntries(new FormData(f)),
    });
    state.user = data.user;
    const next = params.get("next") || "/dashboard";
    location.hash =
      "#" +
      (/^\/(report|dashboard|items\/[a-f0-9]+)(\?.*)?$/.test(next)
        ? next
        : "/dashboard");
    toast(register ? "Welcome to CampusFind." : "Good to see you again.");
  });
}
function requireAuth(next) {
  if (state.user) return true;
  location.hash = `#/login?next=${encodeURIComponent(next)}`;
  return false;
}
async function reportPage(params, token, editId) {
  if (!requireAuth(editId ? `/items/${editId}` : `/report?${params}`)) return;
  let item = editId ? await api(`/items/${editId}`) : null;
  if (token !== routeNumber) return;
  if (item && item.owner._id !== state.user.id && state.user.role !== "admin")
    throw new Error("You cannot edit this listing.");
  shell(
    `${head(editId ? "UPDATE YOUR REPORT" : "LET’S MAKE A CONNECTION", editId ? "Edit your listing." : "Every reunion starts here.", editId ? "Keep the details clear and current." : "Share a few details. Your campus will take it from here.")}<div class="narrow panel"><form id="report-form"><div class="form-grid"><div class="field full"><label for="type">I’m reporting something…</label><select name="type" id="type"><option value="lost" ${(item?.type || params.get("type")) === "lost" ? "selected" : ""}>Lost — help me find my item</option><option value="found" ${(item?.type || params.get("type")) === "found" ? "selected" : ""}>Found — help me return an item</option></select></div><div class="field full"><label for="name">Item name</label><input id="name" name="name" maxlength="100" required placeholder="e.g. Blue canvas backpack" value="${esc(item?.name || "")}"></div><div class="field"><label for="category">Category</label><select name="category" id="category" required><option value="">Choose a category</option>${state.meta.categories.map((v) => `<option ${item?.category === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div><div class="field"><label for="location">Campus location</label><select name="location" id="location" required><option value="">Choose a building or area</option>${state.meta.locations.map((v) => `<option ${item?.location === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div><div class="field"><label for="date">Date lost or found</label><input name="date" id="date" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${item ? new Date(item.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label for="image">Photo (optional)</label><input name="image" id="image" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPEG or WebP. Maximum 3 MB.</small></div><div class="field full"><label for="description">Description</label><textarea name="description" id="description" minlength="10" maxlength="1500" required placeholder="Colour, brand, where you last saw it… Keep unique identifying details private so you can verify ownership.">${esc(item?.description || "")}</textarea><small>Do not publish ID numbers, phone numbers, passwords or other sensitive details.</small></div>${item?.hasImage ? '<div class="field full"><label><input type="checkbox" name="removeImage" value="true"> Remove existing image</label></div>' : ""}</div><div class="notice">${icon("shield")} Only you and administrators can manage your report. Claim evidence is visible only to the people involved and administrators.</div><div class="form-actions"><a class="button light" href="${editId ? "#/items/" + editId : "#/browse"}">Cancel</a><button class="button" type="submit">${editId ? "Save changes" : "Publish report"} ${icon("arrow")}</button></div></form></div>`,
  );
  $("#image").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file && file.size > 3 * 1024 * 1024) {
      e.target.value = "";
      toast("Please choose an image smaller than 3 MB.");
    }
  });
  bindForm("#report-form", async (f) => {
    const body = new FormData(f);
    if (!body.get("image")?.size) body.delete("image");
    const data = await api(editId ? `/items/${editId}` : "/items", {
      method: editId ? "PATCH" : "POST",
      body,
    });
    location.hash = `#/items/${editId || data.id}`;
    toast(data.message);
  });
}
function modal(html) {
  $("#modal-content").innerHTML = html;
  $("#modal").showModal();
}
$("#modal .close-dialog").addEventListener("click", () => $("#modal").close());
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.target.close();
  }
});
function confirmAction(title, text, action) {
  modal(
    `<h2 id="modal-title">${esc(title)}</h2><p>${esc(text)}</p><form id="confirm-form"><div class="form-actions"><button class="button light" type="button" id="cancel-modal">Cancel</button><button class="button" type="submit">Confirm</button></div></form>`,
  );
  $("#cancel-modal").onclick = () => $("#modal").close();
  bindForm("#confirm-form", async () => {
    await action();
    $("#modal").close();
    await render();
  });
}
async function detailPage(id, token) {
  const [item, { matches }] = await Promise.all([
    api(`/items/${id}`),
    api(`/items/${id}/matches`),
  ]);
  if (token !== routeNumber) return;
  const isOwner =
    state.user &&
    (item.owner?._id === state.user.id || state.user.role === "admin");
  shell(
    `<a class="back-link" href="#/browse">${icon("back")} Back to the noticeboard</a><section class="detail-layout">${art(item, true)}<div class="detail-copy"><div class="category">${esc(item.category)}</div>${badge(item.status === "open" ? item.type : item.status)}<h1>${esc(item.name)}</h1><p>${esc(item.description)}</p><div class="detail-meta"><div><small>LOCATION</small><strong>${esc(item.location)}</strong></div><div><small>DATE ${item.type === "lost" ? "LOST" : "FOUND"}</small><strong>${fmt(item.date)}</strong></div><div><small>REPORTED BY</small><strong>${esc(item.owner?.name || "Campus member")}</strong></div><div><small>LISTING STATUS</small><strong>${esc(item.status)}</strong></div></div><div class="detail-actions">${isOwner ? `<a class="button" href="#/edit/${id}">Edit listing</a>${item.status === "open" ? `<button class="button light" id="close-item">Close listing</button>` : ""}<button class="button danger" id="delete-item">Delete</button>` : item.status === "open" ? `<button class="button" id="claim-item">${item.type === "found" ? "This might be mine" : "I may have found this"} ${icon("arrow")}</button>` : ""}</div><div class="notice">${item.type === "found" ? "Recognise this item? Submit private identifying details." : "Found a possible match? Let the reporter know with private identifying details."} Arrange a safe handover through the campus help desk after approval.${item.sample ? " This is a demonstration listing." : ""}</div></div></section><section class="spaced"><div class="section-heading"><div><div class="eyebrow">A LITTLE HELP FROM CAMPUSFIND</div><h2>Possible matches</h2><p>Suggestions use category, location, item keywords and date. Always verify ownership.</p></div></div><div class="grid">${matches.length ? matches.map(card).join("") : empty("No possible matches yet", "New reports may bring a connection. Check back later.")}</div></section>`,
  );
  $("#claim-item")?.addEventListener("click", () => {
    if (!requireAuth(`/items/${id}`)) return;
    modal(
      `<h2 id="modal-title">${item.type === "found" ? "Make a recovery request" : "Help return this item"}</h2><p>Describe details only the owner would know, such as a distinctive mark or what is inside. This evidence is private.</p><form id="claim-form"><div class="field"><label for="evidence">Ownership or finding evidence</label><textarea id="evidence" name="evidence" minlength="15" maxlength="1500" required></textarea><small>Include a safe way to coordinate through the campus help desk. Do not include passwords or full ID numbers.</small></div><div class="form-actions"><button class="button" type="submit">Submit request ${icon("arrow")}</button></div></form>`,
    );
    bindForm("#claim-form", async (f) => {
      const data = await api(`/items/${id}/claims`, {
        method: "POST",
        body: Object.fromEntries(new FormData(f)),
      });
      $("#modal").close();
      toast(data.message);
      location.hash = "#/dashboard?tab=claims";
    });
  });
  $("#close-item")?.addEventListener("click", () =>
    confirmAction(
      "Close this listing?",
      "The listing will remain in your history and will stop accepting new requests.",
      async () => {
        await api(`/items/${id}`, {
          method: "PATCH",
          body: { status: "closed" },
        });
        toast("Listing closed.");
      },
    ),
  );
  $("#delete-item")?.addEventListener("click", () =>
    confirmAction(
      "Delete this listing?",
      "Listings with claims cannot be deleted. Close them to preserve the recovery history.",
      async () => {
        await api(`/items/${id}`, { method: "DELETE" });
        location.hash = "#/dashboard";
        toast("Listing deleted.");
      },
    ),
  );
}
function claimCard(c) {
  const reviewer =
    state.user.role === "admin" || c.item?.owner === state.user.id;
  return `<article class="claim-card"><div><span class="category">${reviewer ? "INCOMING REQUEST" : "YOUR REQUEST"} · ${shortDate(c.createdAt)}</span><h3><a href="#/items/${esc(c.item?._id)}">${esc(c.item?.name || "Unavailable listing")}</a></h3><p><strong>From ${esc(c.claimant?.name || "Campus member")}:</strong> ${esc(c.evidence)}</p>${c.reviewNote ? `<p><strong>Review note:</strong> ${esc(c.reviewNote)}</p>` : ""}${badge(c.status)}</div>${reviewer && c.status === "pending" ? `<div class="detail-actions"><button class="button small" data-review="${c._id}" data-status="approved">Approve</button><button class="button light small" data-review="${c._id}" data-status="rejected">Reject</button></div>` : ""}</article>`;
}
function bindReviews() {
  $$("[data-review]").forEach((b) =>
    b.addEventListener("click", () => {
      const status = b.dataset.status;
      modal(
        `<h2 id="modal-title">${status === "approved" ? "Approve this recovery?" : "Reject this request?"}</h2><p>${status === "approved" ? "Approval marks the item recovered and rejects other pending requests. Verify the evidence before continuing." : "The requester will see your decision in their dashboard."}</p><form id="review-form"><div class="field"><label for="reviewNote">Review or handover note (optional)</label><textarea id="reviewNote" name="reviewNote" maxlength="500" placeholder="e.g. Please collect from the campus help desk."></textarea></div><div class="form-actions"><button class="button" type="submit">Confirm ${status === "approved" ? "approval" : "rejection"}</button></div></form>`,
      );
      bindForm("#review-form", async (f) => {
        const d = await api(`/claims/${b.dataset.review}`, {
          method: "PATCH",
          body: { status, reviewNote: new FormData(f).get("reviewNote") },
        });
        $("#modal").close();
        toast(d.message);
        await render();
      });
    }),
  );
}
async function dashboard(params, token) {
  if (!requireAuth("/dashboard")) return;
  const [data, { claims }] = await Promise.all([
    api(
      "/items?mine=true&" +
        new URLSearchParams({ page: params.get("page") || "1" }),
    ),
    api("/claims"),
  ]);
  if (token !== routeNumber) return;
  const ownClaims = claims.filter((c) => c.claimant?._id === state.user.id),
    incoming = claims.filter((c) => c.item?.owner === state.user.id),
    tab = params.get("tab") || "listings";
  shell(
    `${head("YOUR CAMPUS CORNER", `Hello, ${state.user.name.split(" ")[0]}.`, "Keep track of your reports, recovery requests and good deeds.")}<div class="dashboard-stats">${[
      [data.total, "My listings"],
      [ownClaims.length, "My recovery requests"],
      [
        incoming.filter((c) => c.status === "pending").length,
        "Awaiting my review",
      ],
    ]
      .map(
        ([n, t]) =>
          `<div class="dashboard-stat"><small>${t}</small><strong>${n}</strong></div>`,
      )
      .join("")}</div><div class="section-heading"><div class="tabs">${[
      ["listings", "My listings"],
      ["claims", "My requests"],
      ["incoming", "Incoming"],
    ]
      .map(
        ([v, t]) =>
          `<a class="tab ${tab === v ? "active" : ""}" href="#/dashboard?tab=${v}">${t}</a>`,
      )
      .join(
        "",
      )}</div><a class="button small" href="#/report">${icon("plus")} New report</a></div>${tab === "listings" ? `<div class="grid">${data.items.length ? data.items.map(card).join("") : empty("Your noticeboard is clear", "Report something lost or found to get started.")}</div>${data.pages > 1 ? `<div class="pagination">${data.page > 1 ? `<a class="button light small" href="#/dashboard?page=${data.page - 1}">Previous</a>` : ""}<span>Page ${data.page} of ${data.pages}</span>${data.page < data.pages ? `<a class="button light small" href="#/dashboard?page=${data.page + 1}">Next</a>` : ""}</div>` : ""}` : (tab === "incoming" ? incoming : ownClaims).length ? (tab === "incoming" ? incoming : ownClaims).map(claimCard).join("") : empty("No recovery requests yet", "Your requests and their status will appear here.")}`,
  );
  bindReviews();
}
async function adminPage(params, token) {
  if (!requireAuth("/admin")) return;
  if (state.user.role !== "admin")
    throw new Error("Administrator access required.");
  const [stats, extra, data, { claims }] = await Promise.all([
    api("/stats"),
    api("/admin/stats"),
    api(`/items?page=${Number(params.get("page")) || 1}`),
    api("/claims"),
  ]);
  if (token !== routeNumber) return;
  const max = Math.max(1, ...extra.byCategory.map((x) => x.count));
  shell(
    `${head("CAMPUS OPERATIONS", "A clearer view of campus.", "Review requests, manage listings and keep every recovery moving.")}<div class="dashboard-stats">${[
      [stats.total, "Total listings"],
      [extra.users, "Registered members"],
      [extra.pending, "Pending requests"],
    ]
      .map(
        ([n, t]) =>
          `<div class="dashboard-stat"><small>${t}</small><strong>${n}</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="admin-layout"><section class="panel"><h3>Items by category</h3><div class="chart">${extra.byCategory.map((x) => `<div class="chart-row"><span>${esc(x._id)}</span><progress max="${max}" value="${x.count}" class="w-100" aria-label="${esc(x._id)} count"></progress><strong>${x.count}</strong></div>`).join("")}</div></section><section class="panel"><h3>Recovery overview</h3><p class="muted">${stats.recovered} items marked recovered · ${stats.open} open reports</p><div class="notice">Approve claims only after ownership verification. Approval updates the item and all related pending requests together.</div><a class="button light small" href="#/report">Add a campus report ${icon("plus")}</a></section></div><div class="section-heading"><h2>Campus listings</h2><span class="count-label">Page ${data.page} of ${data.pages || 1}</span></div><div class="table-wrap"><table><thead><tr><th>Item</th><th>Type</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>${data.items.map((i) => `<tr><td><a href="#/items/${i._id}">${esc(i.name)}</a></td><td>${badge(i.type)}</td><td>${esc(i.location)}</td><td>${badge(i.status)}</td><td><div class="detail-actions"><a class="button light small" href="#/edit/${i._id}">Edit</a><button class="button light small" data-manage="${i._id}" data-current="${i.status}">Status</button></div></td></tr>`).join("")}</tbody></table></div>${data.pages > 1 ? `<div class="pagination">${data.page > 1 ? `<a class="button light small" href="#/admin?page=${data.page - 1}">Previous</a>` : ""}${data.page < data.pages ? `<a class="button light small" href="#/admin?page=${data.page + 1}">Next</a>` : ""}</div>` : ""}<section class="spaced"><div class="section-heading"><h2>Recovery requests</h2><span class="count-label">Most recent ${claims.length} requests</span></div>${claims.length ? claims.map(claimCard).join("") : empty("No requests to review", "New recovery requests will appear here.")}</section>`,
  );
  bindReviews();
  $$("[data-manage]").forEach((b) =>
    b.addEventListener("click", () => {
      modal(
        `<h2 id="modal-title">Update listing status</h2><form id="status-form"><div class="field"><label for="status">Status</label><select id="status" name="status">${["open", "closed", "recovered"].map((s) => `<option ${s === b.dataset.current ? "selected" : ""}>${s}</option>`).join("")}</select></div><p class="form-note">For a verified claim, approve the request instead. A manual status change does not approve or reject claims.</p><div class="form-actions"><button class="button" type="submit">Save status</button></div></form>`,
      );
      bindForm("#status-form", async (f) => {
        await api(`/items/${b.dataset.manage}`, {
          method: "PATCH",
          body: Object.fromEntries(new FormData(f)),
        });
        $("#modal").close();
        toast("Item status updated.");
        await render();
      });
    }),
  );
}
function guide() {
  shell(
    `${head("A COMMUNITY THAT LOOKS OUT FOR YOU", "A little help goes a long way.", "Three simple steps to bring campus belongings back where they belong.")}<div class="steps">${[
      [
        "01",
        "Report it",
        "Lost or found something? Add a clear description, a campus location and an optional photo. Keep unique identification details private.",
      ],
      [
        "02",
        "Make the connection",
        "Search the noticeboard or check possible matches. Submit private evidence on a listing that looks familiar.",
      ],
      [
        "03",
        "Bring it home",
        "The reporter reviews each request. Once verified, coordinate a handover through the campus help desk and mark the recovery complete.",
      ],
    ]
      .map(
        ([n, t, d]) =>
          `<section class="panel"><span class="step-number">${n}</span><h3>${t}</h3><p>${d}</p></section>`,
      )
      .join(
        "",
      )}</div><div class="notice"><strong>Keep your community safe.</strong> Do not publish complete ID details, financial information, passwords or private contact details. For valuable or sensitive items, hand them to authorised campus staff. CampusFind does not provide emergency assistance or verify identities automatically.</div><aside class="help-band"><div><h3>Ready to make someone’s day?</h3><p>A few details can start a happy reunion.</p></div><a href="#/report" class="button">Report an item ${icon("arrow")}</a></aside>`,
  );
}
async function render() {
  const token = ++routeNumber;
  $("#modal").close();
  const [path, query = ""] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(query);
  navigation();
  $("#main").innerHTML =
    '<div class="loading" role="status">Finding our way…</div>';
  try {
    if (path === "/") await browse(true, params, token);
    else if (path === "/browse") await browse(false, params, token);
    else if (path === "/login" || path === "/register")
      authPage(path === "/register", params);
    else if (path === "/report") await reportPage(params, token);
    else if (/^\/edit\/[a-f0-9]{24}$/.test(path))
      await reportPage(params, token, path.split("/")[2]);
    else if (/^\/items\/[a-f0-9]{24}$/.test(path))
      await detailPage(path.split("/")[2], token);
    else if (path === "/dashboard") await dashboard(params, token);
    else if (path === "/admin") await adminPage(params, token);
    else if (path === "/guide") guide();
    else
      shell(
        head(
          "PAGE NOT FOUND",
          "Let’s find your way back.",
          "This page is not on our campus map.",
        ) + '<a class="button" href="#/">Back to home</a>',
      );
  } catch (e) {
    if (token === routeNumber)
      shell(
        `${head("SOMETHING NEEDS ATTENTION", "We couldn’t load this page.", e.message)}<a class="button" href="#/">Back to home</a>`,
      );
  }
  if (token === routeNumber) {
    document.title = `${path === "/dashboard" ? "Your dashboard" : path === "/admin" ? "Admin" : path === "/browse" ? "Browse items" : "Campus Lost & Found"} · CampusFind`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}
window.addEventListener("hashchange", render);
try {
  await refreshSession();
  state.meta = await api("/meta");
  await render();
} catch (e) {
  shell(
    `${head("CONNECTION REQUIRED", "CampusFind is taking a moment.", e.message)}<p class="muted">Check that the server and MongoDB database are running, then refresh.</p>`,
  );
}
