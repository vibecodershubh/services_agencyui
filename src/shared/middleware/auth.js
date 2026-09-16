import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { config } from "../../config/index.js";

// Attaches req.context = { userId, role, clientId } from a verified JWT.
// clientId is restored to ObjectId so ownScope queries match stored ObjectIds.
export function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    const p = jwt.verify(token, config.jwt.secret);
    let clientId = null;
    if (p.clientId) {
      try { clientId = new ObjectId(p.clientId); } catch { /* malformed — leave null */ }
    }
    req.context = { userId: p.sub, role: p.role, clientId };
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.context || !roles.includes(req.context.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}
