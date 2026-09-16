import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../../shared/db/mongo.js";
import { authenticate, requireRole } from "../../shared/middleware/auth.js";
import { ownScope, requireOwnership } from "../../shared/db/ownScope.js";

export const invoicesRouter = Router();

// POST /invoices  — STAFF only. Bill an engagement.
invoicesRouter.post("/", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const { clientId, engagementId, lineItems = [], dueDate } = req.body;
    if (!clientId || !engagementId || !lineItems.length) {
      return res.status(400).json({ error: "clientId, engagementId and lineItems required" });
    }
    if (!ObjectId.isValid(clientId) || !ObjectId.isValid(engagementId)) {
      return res.status(400).json({ error: "clientId and engagementId must be valid ObjectIds" });
    }
    if (lineItems.some(li => typeof li.amount !== "number" || !isFinite(li.amount))) {
      return res.status(400).json({ error: "each lineItem must have a finite numeric amount (paise)" });
    }
    const amount = lineItems.reduce((s, li) => s + li.amount, 0);
    const db = getDb();
    const engagement = await db.collection("engagements").findOne({ _id: new ObjectId(engagementId) });
    if (!engagement) return res.status(404).json({ error: "engagement not found" });
    if (String(engagement.clientId) !== String(clientId)) return res.status(400).json({ error: "engagement does not belong to client" });
    const result = await db.collection("invoices").insertOne({
      clientId: new ObjectId(clientId),
      engagementId: new ObjectId(engagementId),
      lineItems, amount,
      status: "sent",
      dueDate: dueDate ? new Date(dueDate) : null,
      createdAt: new Date(),
    });
    res.status(201).json({ invoiceId: result.insertedId, amount });
  } catch (err) { next(err); }
});

// GET /invoices  — client sees own; staff see all.
invoicesRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const list = await db.collection("invoices")
      .find(ownScope(req.context, {}))
      .sort({ createdAt: -1 })
      .toArray();
    res.json(list);
  } catch (err) { next(err); }
});

// GET /invoices/:id  — ownership-checked; the portal polls this after payment.
invoicesRouter.get("/:id", authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const inv = await db.collection("invoices").findOne({ _id: new ObjectId(req.params.id) });
    if (!inv) return res.status(404).json({ error: "not found" });
    if (!requireOwnership(req.context, inv)) return res.status(403).json({ error: "forbidden" });
    res.json(inv);
  } catch (err) { next(err); }
});
