import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { ObjectId } from "mongodb";
import { getDb } from "../../shared/db/mongo.js";
import { authenticate } from "../../shared/middleware/auth.js";
import { requireOwnership } from "../../shared/db/ownScope.js";
import { sendMail } from "../../shared/mailer/index.js";
import { config } from "../../config/index.js";

export const paymentsRouter = Router();

// Lazy singleton — fails clearly at call time if keys aren't set, not at startup.
let _rzp;
function getRazorpay() {
  if (!_rzp) {
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw Object.assign(
        new Error("Razorpay keys not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET"),
        { status: 503 }
      );
    }
    _rzp = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  }
  return _rzp;
}

// POST /payments/create — any authenticated user; ownership-checked per invoice.
paymentsRouter.post("/create", authenticate, async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) return res.status(400).json({ error: "invoiceId required" });
    if (!ObjectId.isValid(invoiceId)) return res.status(400).json({ error: "invoiceId is not a valid ObjectId" });

    const db = getDb();
    const invoice = await db.collection("invoices").findOne({ _id: new ObjectId(invoiceId) });
    if (!invoice) return res.status(404).json({ error: "invoice not found" });
    if (!requireOwnership(req.context, invoice)) return res.status(403).json({ error: "forbidden" });
    if (invoice.status === "paid") return res.status(409).json({ error: "already paid" });

    const order = await getRazorpay().orders.create({
      amount: invoice.amount,              // already in paise
      currency: "INR",
      receipt: invoice._id.toString(),     // for reconciliation in the Razorpay dashboard
    });

    await db.collection("payments").insertOne({
      invoiceId: invoice._id,
      clientId: invoice.clientId,
      razorpayOrderId: order.id,
      razorpayPaymentId: null,
      status: "created",
      amount: invoice.amount,
      createdAt: new Date(),
    });

    res.json({ razorpayOrderId: order.id, keyId: config.razorpay.keyId, amount: invoice.amount });
  } catch (err) { next(err); }
});

// POST /payments/webhook — Razorpay server-to-server. The ONLY place that may set
// an invoice to "paid". Mounted with express.raw() in src/index.js — do not reorder.
paymentsRouter.post("/webhook", async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body; // Buffer from express.raw()

    if (!config.razorpay.webhookSecret) return res.status(503).json({ error: "webhook secret not configured" });

    const expected = crypto
      .createHmac("sha256", config.razorpay.webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!signature || signature !== expected) {
      return res.status(400).json({ error: "invalid signature" });
    }

    const event = JSON.parse(rawBody.toString());

    // Only act on payment.captured — acknowledge all other event types silently.
    if (event.event !== "payment.captured") return res.status(200).json({ ok: true });

    const entity = event?.payload?.payment?.entity;
    if (!entity) return res.status(200).json({ ok: true });

    const db = getDb();

    // Idempotency — the same webhook can arrive more than once.
    const already = await db.collection("payments").findOne({ razorpayPaymentId: entity.id });
    if (already?.status === "captured") return res.status(200).json({ ok: true });

    const payment = await db.collection("payments").findOne({ razorpayOrderId: entity.order_id });
    if (!payment) {
      // Return 200 so Razorpay doesn't retry — log for manual reconciliation.
      console.warn("[webhook] no payment record for razorpayOrderId:", entity.order_id);
      return res.status(200).json({ ok: true });
    }

    await db.collection("payments").updateOne(
      { _id: payment._id },
      { $set: { razorpayPaymentId: entity.id, status: "captured", capturedAt: new Date() } }
    );
    await db.collection("invoices").updateOne(
      { _id: payment.invoiceId },
      { $set: { status: "paid", paidAt: new Date() } }
    );

    sendMail({
      to: "team@agency.example",
      subject: "Invoice paid",
      body: `Invoice ${payment.invoiceId} marked paid via Razorpay payment ${entity.id}`,
    }).catch(() => {});

    res.status(200).json({ ok: true });
  } catch (err) { next(err); }
});
