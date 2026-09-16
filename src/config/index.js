// Central configuration from environment. Secrets come from a secrets manager in prod.
export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  mongo: {
    uri: process.env.MONGO_URI || "mongodb://mongo:27017",
    dbName: process.env.MONGO_DB || "services_agency",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev-only-change-me",
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",         // public — safe on client
    keySecret: process.env.RAZORPAY_KEY_SECRET || "", // server-only
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "", // server-only
  },
};
