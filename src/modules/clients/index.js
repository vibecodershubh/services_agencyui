import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../../shared/db/mongo.js";
import { authenticate, requireRole } from "../../shared/middleware/auth.js";

export const clientsRouter = Router();

// POST /clients  — STAFF only. Convert a qualified lead into a client record.
clientsRouter.post("/", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const { name, primaryContact = {}, sourceLeadId = null } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const db = getDb();
    const doc = {
      name,
      primaryContact,
      status: "active",
      createdAt: new Date(),
    };
    if (sourceLeadId) {
      if (!ObjectId.isValid(sourceLeadId)) return res.status(400).json({ error: "sourceLeadId is not a valid ObjectId" });
      doc.sourceLeadId = new ObjectId(sourceLeadId);
    }
    const result = await db.collection("clients").insertOne(doc);
    // Mark the source lead converted.
    if (sourceLeadId) {
      await db.collection("leads").updateOne(
        { _id: new ObjectId(sourceLeadId) },
        { $set: { status: "converted" } }
      );
    }
    res.status(201).json({ clientId: result.insertedId });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "lead already converted to a client" });
    next(err);
  }
});

// GET /clients  — STAFF only.
clientsRouter.get("/", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const db = getDb();
    const clients = await db.collection("clients").find({}).sort({ createdAt: -1 }).toArray();
    res.json(clients);
  } catch (err) { next(err); }
});
