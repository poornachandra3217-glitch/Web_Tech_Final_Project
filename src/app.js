import express from "express";
import session from "express-session";
import { MongoStore } from "connect-mongo";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { User, Item, Claim, CATEGORIES, LOCATIONS } from "./models.js";
const root = path.dirname(fileURLToPath(import.meta.url));
const fail = (status, message) => Object.assign(new Error(message), { status });
const cleanUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});
const wrap = (f) => (req, res, next) =>
  Promise.resolve(f(req, res, next)).catch(next);
const id = (x) => mongoose.isValidObjectId(x);
const str = (x, max = 1500) => {
  if (typeof x !== "string" || !x.trim() || x.length > max)
    throw fail(400, "Please complete all fields with valid text.");
  return x.trim();
};
const owned = (req, item) =>
  req.user.role === "admin" || String(item.owner) === req.user.id;
function itemInput(body) {
  const data = {
    name: str(body.name, 100),
    description: str(body.description),
    category: str(body.category, 40),
    location: str(body.location, 40),
    type: str(body.type, 10),
    date: str(body.date, 30),
  };
  if (
    !CATEGORIES.includes(data.category) ||
    !LOCATIONS.includes(data.location) ||
    !["lost", "found"].includes(data.type) ||
    data.description.length < 10
  )
    throw fail(
      400,
      "Check category, location, type and description (minimum 10 characters).",
    );
  const date = new Date(data.date);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !Number.isFinite(+date) ||
    date.toISOString().slice(0, 10) !== data.date ||
    date > new Date()
  )
    throw fail(400, "Choose a valid date that is not in the future.");
  return data;
}
function validImage(file) {
  if (!file) return {};
  const b = file.buffer;
  let type;
  if (
    b.length > 8 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    type = "image/png";
  if (b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
    type = "image/jpeg";
  if (
    b.length > 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    type = "image/webp";
  if (!type) throw fail(400, "Upload a PNG, JPEG or WebP image.");
  return { image: b, imageType: type };
}
export function createApp({ mongoUrl, secret, store, testing = false } = {}) {
  if (!secret || secret.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const app = express();
  app.disable("x-powered-by");
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "blob:", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests:
            process.env.NODE_ENV === "production" ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    req.body ??= {};
    next();
  });
  app.use(
    session({
      name: "campusfind.sid",
      secret,
      resave: false,
      saveUninitialized: false,
      store:
        store ||
        (mongoUrl
          ? MongoStore.create({ mongoUrl, collectionName: "sessions" })
          : undefined),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 12,
      },
    }),
  );
  app.get("/api/health", (req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: testing ? 10000 : 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please try again later." },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!req.session.csrf)
      req.session.csrf = crypto.randomBytes(24).toString("hex");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("x-csrf-token") !== req.session.csrf
    )
      return next(fail(403, "Security token expired. Refresh and try again."));
    next();
  });
  app.use(
    "/api",
    wrap(async (req, res, next) => {
      if (req.session.userId) {
        req.user = await User.findById(req.session.userId);
        if (!req.user) delete req.session.userId;
      }
      next();
    }),
  );
  const auth = (req, res, next) =>
    req.user ? next() : next(fail(401, "Please sign in to continue."));
  const admin = (req, res, next) =>
    req.user?.role === "admin"
      ? next()
      : next(fail(403, "Administrator access required."));
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: testing ? 1000 : 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  const setSession = async (req, user) => {
    await new Promise((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.userId = user.id;
    req.session.csrf = crypto.randomBytes(24).toString("hex");
    await new Promise((resolve, reject) =>
      req.session.save((e) => (e ? reject(e) : resolve())),
    );
  };
  app.get("/api/auth/me", (req, res) =>
    res.json({
      user: req.user ? cleanUser(req.user) : null,
      csrfToken: req.session.csrf,
    }),
  );
  app.get("/api/meta", (req, res) =>
    res.json({ categories: CATEGORIES, locations: LOCATIONS }),
  );
  app.post(
    "/api/auth/register",
    authLimiter,
    wrap(async (req, res) => {
      const name = str(req.body.name, 80),
        email = str(req.body.email, 160).toLowerCase(),
        password = str(req.body.password, 72);
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        password.length < 10 ||
        Buffer.byteLength(password) > 72
      )
        throw fail(400, "Use a valid email and a password of 10–72 bytes.");
      const user = await User.create({
        name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
      });
      await setSession(req, user);
      res
        .status(201)
        .json({ user: cleanUser(user), csrfToken: req.session.csrf });
    }),
  );
  app.post(
    "/api/auth/login",
    authLimiter,
    wrap(async (req, res) => {
      const email = str(req.body.email, 160).toLowerCase(),
        password = str(req.body.password, 72);
      const user = await User.findOne({ email }).select("+passwordHash");
      if (!user || !(await bcrypt.compare(password, user.passwordHash)))
        throw fail(401, "Email or password is incorrect.");
      await setSession(req, user);
      res.json({ user: cleanUser(user), csrfToken: req.session.csrf });
    }),
  );
  app.post(
    "/api/auth/logout",
    auth,
    wrap(async (req, res) => {
      await new Promise((resolve, reject) =>
        req.session.destroy((e) => (e ? reject(e) : resolve())),
      );
      res
        .clearCookie("campusfind.sid", { path: "/" })
        .json({ message: "Signed out." });
    }),
  );
  app.get(
    "/api/stats",
    wrap(async (req, res) => {
      const [total, open, lost, found, recovered] = await Promise.all([
        Item.countDocuments(),
        Item.countDocuments({ status: "open" }),
        Item.countDocuments({ type: "lost", status: "open" }),
        Item.countDocuments({ type: "found", status: "open" }),
        Item.countDocuments({ status: "recovered" }),
      ]);
      res.json({ total, open, lost, found, recovered });
    }),
  );
  app.get(
    "/api/items",
    wrap(async (req, res) => {
      const q = {};
      for (const [key, values] of Object.entries({
        type: ["lost", "found"],
        category: CATEGORIES,
        location: LOCATIONS,
        status: ["open", "closed", "recovered"],
      })) {
        if (req.query[key]) {
          if (!values.includes(req.query[key]))
            throw fail(400, `Invalid ${key}.`);
          q[key] = req.query[key];
        }
      }
      if (req.query.mine === "true") {
        if (!req.user) throw fail(401, "Please sign in.");
        q.owner = req.user._id;
      }
      if (req.query.q) {
        const term = str(req.query.q, 100).replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        q.$or = [
          { name: { $regex: term, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
        ];
      }
      const page = Math.max(
          1,
          Math.min(10000, Number.parseInt(req.query.page) || 1),
        ),
        limit = 12;
      const sort =
        req.query.sort === "oldest"
          ? { date: 1, createdAt: 1 }
          : { date: -1, createdAt: -1 };
      const [items, total] = await Promise.all([
        Item.find(q)
          .select("-image")
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Item.countDocuments(q),
      ]);
      res.json({
        items: items.map((x) => ({ ...x, hasImage: !!x.imageType })),
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    }),
  );
  app.param("id", (req, res, next, value) =>
    id(value) ? next() : next(fail(400, "Invalid record ID.")),
  );
  app.get(
    "/api/items/:id/image",
    wrap(async (req, res) => {
      const item = await Item.findById(req.params.id).select("+image");
      if (!item?.image) throw fail(404, "Image not found.");
      res
        .type(item.imageType)
        .set("Cache-Control", "public, max-age=3600")
        .send(item.image);
    }),
  );
  app.get(
    "/api/items/:id",
    wrap(async (req, res) => {
      const item = await Item.findById(req.params.id)
        .populate("owner", "name")
        .lean();
      if (!item) throw fail(404, "Listing not found.");
      res.json({ ...item, hasImage: !!item.imageType });
    }),
  );
  app.get(
    "/api/items/:id/matches",
    wrap(async (req, res) => {
      const item = await Item.findById(req.params.id);
      if (!item) throw fail(404, "Listing not found.");
      const candidates = await Item.find({
        _id: { $ne: item._id },
        type: item.type === "lost" ? "found" : "lost",
        status: "open",
        category: item.category,
      }).lean();
      const words = item.name
        .toLowerCase()
        .split(/\W+/)
        .filter((x) => x.length > 2);
      const matches = candidates
        .map((x) => ({
          ...x,
          hasImage: !!x.imageType,
          score:
            (x.location === item.location ? 3 : 0) +
            words.filter((w) =>
              `${x.name} ${x.description}`.toLowerCase().includes(w),
            ).length *
              2 +
            (Math.abs(+new Date(x.date) - +item.date) < 604800000 ? 1 : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      res.json({ matches });
    }),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 3 * 1024 * 1024,
      files: 1,
      fields: 10,
      fieldSize: 4000,
    },
  }).single("image");
  app.post(
    "/api/items",
    auth,
    upload,
    wrap(async (req, res) => {
      const data = itemInput(req.body);
      const item = await Item.create({
        ...data,
        ...validImage(req.file),
        owner: req.user._id,
      });
      res.status(201).json({ id: item.id, message: "Your report is live." });
    }),
  );
  app.patch(
    "/api/items/:id",
    auth,
    upload,
    wrap(async (req, res) => {
      const item = await Item.findById(req.params.id);
      if (!item) throw fail(404, "Listing not found.");
      if (!owned(req, item))
        throw fail(
          403,
          "Only the reporter or an administrator can edit this listing.",
        );
      if (req.body.name !== undefined) {
        if (await Claim.exists({ item: item._id }))
          throw fail(
            409,
            "Listings with claims cannot be rewritten. You can still close the listing.",
          );
        Object.assign(item, itemInput(req.body));
      }
      if (req.body.status !== undefined) {
        if (!["open", "closed", "recovered"].includes(req.body.status))
          throw fail(400, "Invalid item status.");
        if (item.status === "recovered" && req.body.status !== "recovered")
          throw fail(409, "Recovered items cannot be reopened.");
        item.status = req.body.status;
      }
      Object.assign(item, validImage(req.file));
      if (req.body.removeImage === "true") {
        item.image = undefined;
        item.imageType = undefined;
      }
      await item.save();
      res.json({ message: "Listing updated." });
    }),
  );
  app.delete(
    "/api/items/:id",
    auth,
    wrap(async (req, res) => {
      const item = await Item.findById(req.params.id);
      if (!item) throw fail(404, "Listing not found.");
      if (!owned(req, item)) throw fail(403, "You cannot delete this listing.");
      if (await Claim.exists({ item: item._id }))
        throw fail(
          409,
          "Listings with claims must be closed instead of deleted to preserve the recovery history.",
        );
      await item.deleteOne();
      res.json({ message: "Listing deleted." });
    }),
  );
  app.post(
    "/api/items/:id/claims",
    auth,
    wrap(async (req, res) => {
      const item = await Item.findById(req.params.id);
      if (!item) throw fail(404, "Listing not found.");
      if (String(item.owner) === req.user.id)
        throw fail(400, "You cannot submit a claim on your own listing.");
      if (item.status !== "open")
        throw fail(409, "This listing is no longer open.");
      const evidence = str(req.body.evidence);
      if (evidence.length < 15)
        throw fail(
          400,
          "Provide at least 15 characters of private identification evidence.",
        );
      const claim = await Claim.create({
        item: item._id,
        claimant: req.user._id,
        evidence,
      });
      res.status(201).json({
        id: claim.id,
        message: "Request sent. The reporter will review your evidence.",
      });
    }),
  );
  app.get(
    "/api/claims",
    auth,
    wrap(async (req, res) => {
      let q = {};
      if (req.user.role !== "admin") {
        const items = await Item.find({ owner: req.user._id }).distinct("_id");
        q = { $or: [{ claimant: req.user._id }, { item: { $in: items } }] };
      }
      const claims = await Claim.find(q)
        .populate("item", "name type status owner")
        .populate("claimant", "name")
        .sort({ createdAt: -1 })
        .limit(200);
      res.json({ claims });
    }),
  );
  app.patch(
    "/api/claims/:id",
    auth,
    wrap(async (req, res) => {
      const claim = await Claim.findById(req.params.id);
      if (!claim) throw fail(404, "Claim not found.");
      const item = await Item.findById(claim.item);
      if (!item) throw fail(404, "Listing not found.");
      if (!owned(req, item))
        throw fail(
          403,
          "Only the reporter or an administrator can review this claim.",
        );
      if (!["approved", "rejected"].includes(req.body.status))
        throw fail(400, "Choose approved or rejected.");
      if (claim.status !== "pending")
        throw fail(409, "This request has already been reviewed.");
      const note =
        typeof req.body.reviewNote === "string"
          ? req.body.reviewNote.trim()
          : "";
      if (note.length > 500)
        throw fail(400, "Review note must be 500 characters or fewer.");
      // Transactions ensure only one claim can win and that all related statuses change together.
      await mongoose.connection.transaction(async (session) => {
        if (req.body.status === "approved") {
          const updated = await Item.findOneAndUpdate(
            { _id: item._id, status: "open" },
            { $set: { status: "recovered" } },
            { returnDocument: "after", session },
          );
          if (!updated)
            throw fail(409, "This item is no longer available for approval.");
        }
        const updated = await Claim.findOneAndUpdate(
          { _id: claim._id, status: "pending" },
          {
            $set: {
              status: req.body.status,
              reviewNote: note,
              reviewedBy: req.user._id,
            },
          },
          { returnDocument: "after", session, runValidators: true },
        );
        if (!updated) throw fail(409, "This claim was already reviewed.");
        if (req.body.status === "approved")
          await Claim.updateMany(
            { item: item._id, _id: { $ne: claim._id }, status: "pending" },
            {
              $set: {
                status: "rejected",
                reviewNote: "Another recovery request was approved.",
                reviewedBy: req.user._id,
              },
            },
            { session },
          );
      });
      res.json({ message: `Request ${req.body.status}.` });
    }),
  );
  app.get(
    "/api/admin/stats",
    auth,
    admin,
    wrap(async (req, res) => {
      const [users, pending, byCategory] = await Promise.all([
        User.countDocuments(),
        Claim.countDocuments({ status: "pending" }),
        Item.aggregate([
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);
      res.json({ users, pending, byCategory });
    }),
  );
  app.use("/api", (req, res, next) =>
    next(fail(404, "API endpoint not found.")),
  );
  app.use(express.static(path.join(root, "../public")));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.status || 500,
      message = error.message;
    if (error.code === 11000) {
      status = 409;
      message =
        "This email is registered, or you have already requested this item.";
    }
    if (error.name === "ValidationError" || error.name === "CastError") {
      status = 400;
      message = "Please check the submitted fields.";
    }
    if (error instanceof multer.MulterError) {
      status = 400;
      message = "Upload one image smaller than 3 MB.";
    }
    if (status >= 500) {
      console.error(error);
      message = "Something went wrong. Please try again.";
    }
    res.status(status).json({ error: message });
  });
  return app;
}
