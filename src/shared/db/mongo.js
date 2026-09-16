import { MongoClient, ServerApiVersion } from "mongodb";
import dns from "node:dns";
import { config } from "../../config/index.js";

// Fix for Windows/ISP DNS servers failing querySrv for mongodb+srv URLs
dns.setServers(["8.8.8.8", "1.1.1.1"]);

let client, db;

export async function connectMongo() {
  if (db) return db;
  client = new MongoClient(config.mongo.uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();

  // Send a ping to confirm a successful connection
  await client.db("admin").command({ ping: 1 });
  console.log("[mongo] Pinged your deployment. You successfully connected to MongoDB!");

  db = client.db(config.mongo.dbName);
  await ensureIndexes(db);
  return db;
}

export function getDb() {
  if (!db) throw new Error("Mongo not connected — call connectMongo() first");
  return db;
}

async function ensureIndexes(db) {
  // users
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ clientId: 1 }, { sparse: true }); // staff→client login lookup

  // leads
  await db.collection("leads").createIndex({ status: 1, createdAt: -1 });

  // clients
  await db.collection("clients").createIndex({ sourceLeadId: 1 }, { unique: true, sparse: true }); // prevent double-convert
  await db.collection("clients").createIndex({ status: 1 });

  // engagements
  await db.collection("engagements").createIndex({ clientId: 1, status: 1 });

  // invoices
  await db.collection("invoices").createIndex({ clientId: 1, status: 1 });
  await db.collection("invoices").createIndex({ engagementId: 1 });

  // payments
  await db.collection("payments").createIndex({ razorpayOrderId: 1 }, { sparse: true }); // webhook lookup by order
  await ensureIndex(db.collection("payments"), { razorpayPaymentId: 1 }, { unique: true, sparse: true }); // idempotency guard
  await ensureIndex(db.collection("payments"), { invoiceId: 1 }, { unique: true }); // one payment record per invoice
}

async function ensureIndex(collection, key, options = {}) {
  const indexes = await collection.listIndexes().toArray();
  const keyName = Object.keys(key).map((field) => `${field}_${key[field]}`).join("_");
  const existing = indexes.find((index) => index.name === keyName);
  const matches = existing && Object.entries(options).every(([name, value]) => existing[name] === value);
  if (existing && !matches) await collection.dropIndex(existing.name);
  await collection.createIndex(key, options);
}

export async function closeMongo() {
  if (client) await client.close();
}
