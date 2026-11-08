// Executes the supplied Postman collection against an isolated real MongoDB replica set.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import newman from "newman";
import { createApp } from "../src/app.js";
import { User, Claim } from "../src/models.js";
import fs from "node:fs";
const db = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger", args: ["--nounixsocket"] },
});
await mongoose.connect(db.getUri());
await Promise.all([User.init(), Claim.init()]);
const app = createApp({
  secret: "postman-isolated-test-only-secret-with-48-characters",
  testing: true,
});
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
try {
  const port = server.address().port;
  const result = await new Promise((resolve, reject) =>
    newman.run(
      {
        collection: JSON.parse(
          fs.readFileSync("postman/CampusFind.postman_collection.json", "utf8"),
        ),
        environment: {
          values: [
            {
              key: "baseUrl",
              value: `http://127.0.0.1:${port}`,
              enabled: true,
            },
          ],
        },
        reporters: ["cli", "json"],
        reporter: { json: { export: "docs/postman-results.json" } },
        color: "off",
      },
      (err, summary) => (err ? reject(err) : resolve(summary)),
    ),
  );
  if (result.run.failures.length) process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await db.stop();
}
