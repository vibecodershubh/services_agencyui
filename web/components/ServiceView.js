"use client";

import { useEffect, useState } from "react";
import { initScrollFx } from "../lib/scrollFx";

export function ServiceIndex() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/services").then((response) => response.json()).then(setData);
  }, []);

  useEffect(() => {
    const cleanup = initScrollFx();
    return cleanup;
  }, [data]);

  if (!data) return <main className="section-pad"><p className="loading">Loading capabilities…</p></main>;

  return (
    <main>
      <section className="section-pad">
        <h1>What we build<br /><em>next.</em></h1>
        <div className="plate-grid">
          {data.services.map((service) => (
            <a className="plate-card" data-tilt data-reveal href={`/services/${service.area}/${service.slug}`} key={service.slug}>
              <div className="plate-swatch">
                <span className="plate-label">{service.area}</span>
              </div>
              <div className="plate-body">
                <span className="plate-arrow">↗</span>
                <h3>{service.title}</h3>
                <p>{service.summary}</p>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

export function ServiceDetail({ slug }) {
  const [service, setService] = useState(null);

  useEffect(() => {
    fetch("/api/services").then((response) => response.json()).then(({ services }) => setService(services.find((item) => item.slug === slug) || false));
  }, [slug]);

  useEffect(() => {
    const cleanup = initScrollFx();
    return cleanup;
  }, [service]);

  if (service === null) return <main className="section-pad"><p className="loading">Loading capability…</p></main>;
  if (!service) return <main className="section-pad"><h1>Capability not found.</h1><a className="button button-primary" href="/services">Back to capabilities</a></main>;

  return (
    <main>
      <section className="section-pad dark">
        <h1>{service.title}</h1>
        <p className="hero-lede">{service.summary}</p>
      </section>
      <section className="section-pad">
        <div className="intro-grid">
          <div>
            <h2>Useful from<br /><em>day one.</em></h2>
          </div>
          <div data-reveal>
            <p className="large-copy">{service.description || service.summary}</p>
            <ul>{service.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          </div>
        </div>
        {service.tiers?.map((tier) => (
          <div className="panel" data-reveal key={tier.name}>
            <h3>{tier.name}</h3>
            <p>{tier.priceHint}</p>
            {tier.includes.map((item) => <p key={item}>✓ {item}</p>)}
          </div>
        ))}
        <a className="button button-primary" href="/contact">Get this service ↗</a>
      </section>
    </main>
  );
}
