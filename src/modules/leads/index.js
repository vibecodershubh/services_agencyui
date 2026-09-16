import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../../shared/db/mongo.js";
import { sendMail } from "../../shared/mailer/index.js";
import { authenticate, requireRole } from "../../shared/middleware/auth.js";
import { serviceSlugs } from "../../../content/services.js";

export const leadsRouter = Router();

const recentRequests = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;

function allowRequest(ip) {
  const now = Date.now();
  const recent = (recentRequests.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return false;
  recent.push(now);
  recentRequests.set(ip, recent);
  return true;
}

// POST /leads  — PUBLIC. The enquiry form submits here. The only public write.
leadsRouter.post("/", async (req, res, next) => {
  try {
    if (!allowRequest(req.ip)) return res.status(429).json({ error: "too many enquiries; try again later" });
    const { name, email, phone = "", company = "", serviceSlug = "", message = "", budgetHint = "" } = req.body;
    if (!name || !email || !message || req.body.website) {
      return res.status(400).json({ error: "name, email and message are required" });
    }
    if (name.length > 120 || email.length > 254 || message.length > 5000) {
      return res.status(400).json({ error: "enquiry fields exceed allowed length" });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "valid email required" });
    // Validate the service reference against the hardcoded catalog.
    if (serviceSlug && !serviceSlugs.has(serviceSlug)) {
      return res.status(400).json({ error: "unknown serviceSlug" });
    }

    const db = getDb();
    const result = await db.collection("leads").insertOne({
      name, email, phone, company, serviceSlug, message, budgetHint,
      status: "new",
      createdAt: new Date(),
    });

    // Notify the team (fire-and-forget; the lead is already saved either way).
    sendMail({
      to: "team@agency.example",
      subject: `New enquiry: ${serviceSlug || "general"}`,
      body: `${name} (${email}) — ${message}`,
    }).catch(() => {});

    res.status(201).json({ leadId: result.insertedId });
  } catch (err) { next(err); }
});

// GET /leads  — STAFF only. Work the pipeline.
leadsRouter.get("/", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const db = getDb();
    const leads = await db.collection("leads").find({}).sort({ createdAt: -1 }).toArray();
    res.json(leads);
  } catch (err) { next(err); }
});

// PATCH /leads/:id  — STAFF only. Update status as they qualify/convert.
leadsRouter.patch("/:id", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["new", "contacted", "qualified", "converted", "closed"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "invalid status" });
    const db = getDb();
    await db.collection("leads").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status } }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});
