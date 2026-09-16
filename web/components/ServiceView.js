"use client";

import { useEffect, useState } from "react";

export function ServiceIndex() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch("/api/services").then((response) => response.json()).then(setData); }, []);
  if (!data) return <main className="section-pad"><p className="loading">Loading capabilities…</p></main>;
  return <main><section className="section-pad"><div className="section-kicker">Capabilities</div><h1>What we build<br/><em>next.</em></h1><div className="service-grid">{data.services.map((service) => <a className="service-card" href={`/services/${service.area}/${service.slug}`} key={service.slug}><span className="service-index">{service.area}</span><span className="service-arrow">↗</span><h3>{service.title}</h3><p>{service.summary}</p></a>)}</div></section></main>;
}

export function ServiceDetail({ slug }) {
  const [service, setService] = useState(null);
  useEffect(() => { fetch("/api/services").then((response) => response.json()).then(({ services }) => setService(services.find((item) => item.slug === slug) || false)); }, [slug]);
  if (service === null) return <main className="section-pad"><p className="loading">Loading capability…</p></main>;
  if (!service) return <main className="section-pad"><h1>Capability not found.</h1><a className="button button-primary" href="/services">Back to capabilities</a></main>;
  return <main><section className="section-pad dark"><div className="section-kicker">{service.area} / capability</div><h1>{service.title}</h1><p className="hero-lede">{service.summary}</p></section><section className="section-pad"><div className="intro-grid"><div><div className="section-kicker">What you get</div><h2>Useful from<br/><em>day one.</em></h2></div><div><p className="large-copy">{service.description || service.summary}</p><ul>{service.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></div></div>{service.tiers?.map((tier) => <div className="panel" key={tier.name}><h3>{tier.name}</h3><p>{tier.priceHint}</p>{tier.includes.map((item) => <p key={item}>✓ {item}</p>)}</div>)}<a className="button button-primary" href="/contact">Get this service ↗</a></section></main>;
}
