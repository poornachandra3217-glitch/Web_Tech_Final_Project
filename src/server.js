import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";
if (!process.env.MONGODB_URI)
  throw new Error("Set MONGODB_URI in .env or your hosting environment.");
await mongoose.connect(process.env.MONGODB_URI);
const server = createApp({
  mongoUrl: process.env.MONGODB_URI,
  secret: process.env.SESSION_SECRET,
}).listen(process.env.PORT || 3000, () =>
  console.log(`CampusFind running on port ${process.env.PORT || 3000}`),
);
async function shutdown() {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
