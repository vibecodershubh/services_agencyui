// Services are HARDCODED here (no CMS) — devs edit + deploy. The marketing frontend
// renders these; the backend only ever references a service by its `slug`.

export const areas = ["ai-agents", "saas", "cloud", "devops"];

export const services = [
  {
    slug: "support-chatbot",
    area: "ai-agents",
    title: "AI Support Agent",
    summary: "A chatbot that handles tier-1 support, trained on your docs.",
    features: ["24/7 coverage", "Trained on your content", "Human handoff"],
    tiers: [{ name: "Starter", priceHint: "from ₹X", includes: ["1 bot", "email support"] }],
    faqs: [{ q: "How long to launch?", a: "Typically 2–3 weeks." }],
  },
  {
    slug: "saas-mvp",
    area: "saas",
    title: "SaaS MVP Build",
    summary: "We design and ship your first working SaaS product.",
    features: ["Full-stack build", "Auth + payments", "Deployed to prod"],
    tiers: [{ name: "MVP", priceHint: "project-based", includes: ["design", "build", "deploy"] }],
    faqs: [{ q: "Do you maintain it after?", a: "Optional retainer available." }],
  },
  {
    slug: "cloud-setup",
    area: "cloud",
    title: "Cloud Setup & Migration",
    summary: "Stand up or migrate your infrastructure to the cloud.",
    features: ["Architecture", "Migration", "Cost optimization"],
    tiers: [{ name: "Setup", priceHint: "from ₹X", includes: ["assessment", "setup"] }],
    faqs: [],
  },
  {
    slug: "devops-pipeline",
    area: "devops",
    title: "DevOps & CI/CD",
    summary: "Automated build, test, and deploy pipelines.",
    features: ["CI/CD", "Containerization", "Monitoring"],
    tiers: [{ name: "Pipeline", priceHint: "from ₹X", includes: ["CI/CD", "IaC"] }],
    faqs: [],
  },
];

export const serviceSlugs = new Set(services.map((s) => s.slug));
