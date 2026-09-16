import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDb } from "../../shared/db/mongo.js";
import { authenticate, requireRole } from "../../shared/middleware/auth.js";
import { config } from "../../config/index.js";

export const authRouter = Router();

// POST /auth/login  — clients and staff both log in here.
authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const db = getDb();
    const user = await db.collection("users").findOne({ email });
    if (!user) return res.status(401).json({ error: "invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const accessToken = jwt.sign(
      { sub: user._id.toString(), role: user.role, clientId: user.clientId || null },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTtl }
    );
    res.json({ accessToken, role: user.role });
  } catch (err) { next(err); }
});

// POST /auth/users  — STAFF only. Provision a client login after converting a lead.
authRouter.post("/users", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const { email, password, role = "client", clientId = null } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (!["staff", "client"].includes(role)) return res.status(400).json({ error: "role must be staff or client" });
    if (role === "client" && !clientId) return res.status(400).json({ error: "clientId required for client role" });

    let clientOid = null;
    if (clientId) {
      try { clientOid = new ObjectId(clientId); } catch {
        return res.status(400).json({ error: "clientId is not a valid ObjectId" });
      }
    }

    const db = getDb();
    const exists = await db.collection("users").findOne({ email });
    if (exists) return res.status(409).json({ error: "email already registered" });
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.collection("users").insertOne({
      email, passwordHash, role, clientId: clientOid, createdAt: new Date(),
    });
    res.status(201).json({ userId: result.insertedId });
  } catch (err) { next(err); }
});
