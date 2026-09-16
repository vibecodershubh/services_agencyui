"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, engagements: [], invoices: [] });
  useEffect(() => {
    const token = sessionStorage.getItem("etdox_access_token");
    if (!token) return router.replace("/portal/login");
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([fetch("/api/engagements", { headers }), fetch("/api/invoices", { headers })])
      .then(async ([engagements, invoices]) => setState({ loading: false, engagements: engagements.ok ? await engagements.json() : [], invoices: invoices.ok ? await invoices.json() : [] }))
      .catch(() => setState({ loading: false, engagements: [], invoices: [] }));
  }, [router]);
  if (state.loading) return <main className="portal-shell"><div className="portal-main"><p className="loading">Loading your workspace…</p></div></main>;
  return <main className="portal-shell"><nav className="portal-nav"><span>ETDOX / CLIENT PORTAL</span><button className="button" onClick={() => { sessionStorage.removeItem("etdox_access_token"); router.push("/portal/login"); }}>Sign out</button></nav><section className="portal-main"><div className="section-kicker">Your workspace</div><h1>Good to see you.</h1><div className="portal-grid"><div className="metric-card"><b>{state.engagements.length}</b><span>ENGAGEMENTS</span></div><div className="metric-card"><b>{state.invoices.filter((invoice) => invoice.status !== "paid").length}</b><span>OPEN INVOICES</span></div><div className="metric-card"><b>—</b><span>UPCOMING MILESTONE</span></div></div><div className="panel" style={{ marginTop: 18 }}><h2>Engagements</h2>{state.engagements.length ? state.engagements.map((item) => <p key={item._id}><a href={`/portal/engagements/${item._id}`}>{item.title} — {item.status} ↗</a></p>) : <p className="loading">No engagements available yet.</p>}</div><div className="panel" style={{ marginTop: 18 }}><h2>Invoices</h2>{state.invoices.length ? state.invoices.map((item) => <p key={item._id}><a href={`/portal/invoices/${item._id}`}>₹{(item.amount / 100).toLocaleString("en-IN")} — {item.status} ↗</a></p>) : <p className="loading">No invoices available yet.</p>}<p><a href="/portal/support">Contact support ↗</a></p></div></section></main>;
}
