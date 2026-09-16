import { connectMongo, getDb, closeMongo } from "../src/shared/db/mongo.js";

async function run() {
  try {
    await connectMongo();
    const db = getDb();

    // --- insert + read-back ---
    const col = db.collection("_smoke_test");
    const { insertedId } = await col.insertOne({ ping: "pong", ts: new Date() });
    console.log(`[ok] inserted  _id=${insertedId}`);

    const found = await col.findOne({ _id: insertedId });
    if (!found || found.ping !== "pong") throw new Error("read-back mismatch");
    console.log(`[ok] read back  ping=${found.ping}`);

    await col.deleteOne({ _id: insertedId });
    console.log(`[ok] cleaned up scratch doc`);

    // --- spot-check indexes ---
    const checks = [
      { coll: "users",    key: "email",            unique: true  },
      { coll: "users",    key: "clientId",         sparse: true  },
      { coll: "clients",  key: "sourceLeadId",     unique: true, sparse: true },
      { coll: "invoices", key: "engagementId"                    },
      { coll: "payments", key: "razorpayOrderId",  sparse: true  },
      { coll: "payments", key: "invoiceId"                       },
    ];

    for (const { coll, key, unique, sparse } of checks) {
      const indexes = await db.collection(coll).indexes();
      const idx = indexes.find(i => i.key[key] !== undefined);
      if (!idx) throw new Error(`${coll}.${key} index missing`);
      if (unique && !idx.unique) throw new Error(`${coll}.${key} should be unique`);
      if (sparse && !idx.sparse) throw new Error(`${coll}.${key} should be sparse`);
      console.log(`[ok] ${coll}.${key} index confirmed`);
    }

    console.log("\n[PASS] Stage 1 — connection + all indexes verified.");
  } catch (err) {
    console.error("\n[FAIL]", err.message);
    process.exit(1);
  } finally {
    await closeMongo();
  }
}

run();
