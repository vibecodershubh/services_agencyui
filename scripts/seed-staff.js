// Usage: npm run seed:staff [email] [password]
// Creates a single staff user. Safe to re-run — skips if email already exists.
import bcrypt from "bcryptjs";
import { connectMongo, getDb, closeMongo } from "../src/shared/db/mongo.js";

const email    = process.argv[2] || "staff@agency.local";
const password = process.argv[3] || "changeme123";

async function run() {
  try {
    await connectMongo();
    const db = getDb();

    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      console.log(`[skip] ${email} already exists (id=${existing._id})`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { insertedId } = await db.collection("users").insertOne({
      email,
      passwordHash,
      role: "staff",
      clientId: null,
      createdAt: new Date(),
    });

    console.log(`[ok]  Staff user created: ${email} (id=${insertedId})`);
    console.log(`[!]   Change this password after first login.`);
  } catch (err) {
    console.error("[FAIL]", err.message);
    process.exit(1);
  } finally {
    await closeMongo();
  }
}

run();
