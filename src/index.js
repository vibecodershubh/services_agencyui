import express from "express";
import { config } from "./config/index.js";
import { connectMongo } from "./shared/db/mongo.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";

import { authRouter } from "./modules/auth/index.js";
import { leadsRouter } from "./modules/leads/index.js";
import { clientsRouter } from "./modules/clients/index.js";
import { engagementsRouter } from "./modules/engagements/index.js";
import { invoicesRouter } from "./modules/invoices/index.js";
import { paymentsRouter } from "./modules/payments/index.js";
import { services, areas } from "../content/services.js";

const app = express();

// The Razorpay webhook needs the RAW body for HMAC verification — mount before JSON parser.
app.use("/payments/webhook", express.raw({ type: "*/*" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Public: the hardcoded services (frontend could also import them directly at build time).
app.get("/services", (req, res) => res.json({ areas, services }));

app.use("/auth", authRouter);
app.use("/leads", leadsRouter);
app.use("/clients", clientsRouter);
app.use("/engagements", engagementsRouter);
app.use("/invoices", invoicesRouter);
app.use("/payments", paymentsRouter);

app.use(errorHandler);

async function start() {
  await connectMongo();
  app.listen(config.port, () => console.log(`[app] listening on :${config.port}`));
}

start().catch((e) => { console.error("[app] fatal:", e); process.exit(1); });
