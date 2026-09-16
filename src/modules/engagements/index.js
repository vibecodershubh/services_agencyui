import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../../shared/db/mongo.js";
import { authenticate, requireRole } from "../../shared/middleware/auth.js";
import { ownScope, requireOwnership } from "../../shared/db/ownScope.js";
import { serviceSlugs } from "../../../content/services.js";

export const engagementsRouter = Router();

// POST /engagements  — STAFF only. Create as a `proposal`; flips to `active` on acceptance.
engagementsRouter.post("/", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const { clientId, serviceSlug, title, status = "proposal" } = req.body;
    if (!clientId || !title) return res.status(400).json({ error: "clientId and title required" });
    const validStatuses = ["proposal", "active", "paused", "completed"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "invalid status" });
    if (serviceSlug && !serviceSlugs.has(serviceSlug)) {
      return res.status(400).json({ error: "unknown serviceSlug" });
    }
    if (!ObjectId.isValid(clientId)) return res.status(400).json({ error: "clientId is not a valid ObjectId" });
    const db = getDb();
    const client = await db.collection("clients").findOne({ _id: new ObjectId(clientId) });
    if (!client) return res.status(404).json({ error: "client not found" });
    const result = await db.collection("engagements").insertOne({
      clientId: new ObjectId(clientId),
      serviceSlug, title, status,
      deliverables: [],
      startedAt: new Date(),
    });
    res.status(201).json({ engagementId: result.insertedId });
  } catch (err) { next(err); }
});

// GET /engagements  — client sees own; staff see all (ownership-scoped).
engagementsRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const list = await db.collection("engagements")
      .find(ownScope(req.context, {}))
      .sort({ startedAt: -1 })
      .toArray();
    res.json(list);
  } catch (err) { next(err); }
});

// GET /engagements/:id  — ownership-checked.
engagementsRouter.get("/:id", authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const eng = await db.collection("engagements").findOne({ _id: new ObjectId(req.params.id) });
    if (!eng) return res.status(404).json({ error: "not found" });
    if (!requireOwnership(req.context, eng)) return res.status(403).json({ error: "forbidden" });
    res.json(eng);
  } catch (err) { next(err); }
});
