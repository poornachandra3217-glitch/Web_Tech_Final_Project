// Temporary QA database only. Production uses src/server.js and persistent MONGODB_URI.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { seed } from "../src/seed.js";
const db = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger", args: ["--nounixsocket"] },
});
await mongoose.connect(db.getUri());
await seed({
  adminEmail: "admin@example.com",
  adminPassword: "Campus-QA-Admin-123!",
  demoPassword: "Campus-QA-Student-123!",
});
const server = createApp({
  mongoUrl: db.getUri(),
  secret: "qa-only-secret-at-least-32-characters-long",
  testing: true,
}).listen(process.env.PORT || 3000, "0.0.0.0", () =>
  console.log("QA preview: http://localhost:3000 (temporary test data)"),
);
async function stop() {
  server.close();
  await mongoose.disconnect();
  await db.stop();
  process.exit();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
