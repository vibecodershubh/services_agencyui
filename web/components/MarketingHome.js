"use client";

import { useCallback, useEffect, useState } from "react";
import { initScrollFx } from "../lib/scrollFx";
import WebGPUMedallion from "./WebGPUMedallion";

const SIGNALS = ["AI systems", "SaaS products", "Cloud foundations", "DevOps delivery"];

export default function MarketingHome() {
  const [services, setServices] = useState([]);
  const [status, setStatus] = useState("");
  const [webgpuOk, setWebgpuOk] = useState(false);
  const handleWebgpuSupport = useCallback((ok) => setWebgpuOk(ok), []);

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then((data) => setServices(data.services || [])).catch(() => setStatus("Capabilities are being refreshed."));
  }, []);

  useEffect(() => {
    const cleanup = initScrollFx();
    return cleanup;
  }, [services]);

  async function submit(event) {
    event.preventDefault();
    setStatus("Sending your enquiry…");
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      event.currentTarget.reset();
      setStatus("Received. We’ll be in touch within two working days.");
    } catch (error) {
      setStatus(error.message || "Could not send your enquiry.");
    }
  }

  return (
    <>
      <div className="nav-wrap">
        <nav className="nav-capsule">
          <a className="brand" href="#top"><span className="brand-mark">E</span><span>ETDOX</span></a>
          <div className="desktop-nav">
            <a href="#services">Capabilities</a>
            <a href="#approach">Approach</a>
            <a href="#contact">Start a project</a>
          </div>
          <a className="header-portal" href="/portal/login">Client portal ↗</a>
        </nav>
      </div>

      <main id="top">
        <section className="hero section-pad">
          <div className="hero-copy">
            <h1>Turn the hard<br /><em>problems</em> into<br />momentum.</h1>
            <p className="hero-lede">We help ambitious teams design, build, and operate the digital systems their next chapter depends on.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#contact">Tell us what you’re building ↗</a>
              <a href="#services">Explore capabilities ↓</a>
            </div>
          </div>
          <div className="medallion">
            <WebGPUMedallion onSupportChange={handleWebgpuSupport} />
            {!webgpuOk && <>
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit orbit-three" />
            </>}
            <div className={`orbit-core${webgpuOk ? " orbit-core--overlay" : ""}`}>BUILD<br />WITH<br /><b>INTENT</b></div>
            <span className="orbit-label label-top">IDEA → SYSTEM</span>
            <span className="orbit-label label-right">SYSTEM → SCALE</span>
            <span className="orbit-label label-bottom">SCALE → IMPACT</span>
          </div>
          <div className="hero-scroll">Scroll to explore <i /></div>
        </section>

        <div className="marquee">
          <div className="marquee-track">
            {[...SIGNALS, ...SIGNALS].map((s, i) => (
              <span className="marquee-item" key={i} aria-hidden={i >= SIGNALS.length ? "true" : undefined}>{s}</span>
            ))}
          </div>
        </div>

        <section className="intro section-pad dark" id="approach">
          <div className="intro-grid">
            <h2>Good ideas are everywhere.<br /><span>Useful systems are not.</span></h2>
            <div data-reveal>
              <p className="large-copy">We sit at the intersection of strategy, design, and engineering to make complicated things feel inevitable.</p>
              <p className="muted-copy">From the first honest conversation to the first real customer, our team brings the clarity and craft to make progress tangible.</p>
            </div>
          </div>
        </section>

        <section className="services-section section-pad" id="services">
          <div className="ghost-wrap" aria-hidden="true" data-parallax="0.05">
            <span className="ghost-line">Next move</span>
          </div>
          <div className="section-heading">
            <div>
              <h2>Built for the<br /><span>next move.</span></h2>
            </div>
            <p>Focused teams for the moments that matter — launching, fixing, and scaling what makes your business work.</p>
          </div>
          <div className="plate-grid">
            {services.length ? services.map((service, index) => (
              <article className="plate-card" data-tilt data-reveal key={service.slug}>
                <div className="plate-swatch">
                  <span className="plate-label">0{index + 1} / {service.area}</span>
                </div>
                <div className="plate-body">
                  <span className="plate-arrow">↗</span>
                  <h3>{service.title}</h3>
                  <p>{service.summary}</p>
                </div>
              </article>
            )) : <p className="loading">{status || "Loading capabilities…"}</p>}
          </div>
        </section>

        <section className="manifesto section-pad">
          <div className="manifesto-line" />
          <p data-reveal>“The best technology disappears into the confidence it gives a team.”</p>
          <div className="manifesto-meta">
            <span>ETDOX / FIELD NOTE 001</span>
            <span>BUILD WITH INTENT</span>
          </div>
        </section>

        <section className="process-band section-pad" id="process">
          <h2>Less theatre.<br /><span>More traction.</span></h2>
          <div className="line-list">
            <article className="line-item" data-reveal>
              <div><b>01</b><h3>Find the signal</h3><p>We get precise about the problem, the people, and the outcome worth building toward.</p></div>
            </article>
            <article className="line-item" data-reveal>
              <div><b>02</b><h3>Make it real</h3><p>Small, sharp iterations turn assumptions into a product people can touch and use.</p></div>
            </article>
            <article className="line-item" data-reveal>
              <div><b>03</b><h3>Make it last</h3><p>We leave you with the systems, visibility, and confidence to keep moving.</p></div>
            </article>
          </div>
        </section>

        <section className="contact-section section-pad" id="contact">
          <div className="contact-card">
            <div className="contact-intro">
              <h2>Have a hard<br /><em>problem?</em></h2>
              <p>Tell us enough to start a useful conversation. We’ll take it from there.</p>
              <div className="contact-aside">
                <span>Usually reply within 2 working days</span>
                <span>etdoxorg@gmail.com</span>
              </div>
            </div>
            <form onSubmit={submit}>
              <label>Name<input name="name" required placeholder="Your name" /></label>
              <label>Work email<input type="email" name="email" required placeholder="you@company.com" /></label>
              <label>Company <span className="optional">optional</span><input name="company" placeholder="Company or project" /></label>
              <label>What are you building?<textarea name="message" required rows="4" placeholder="A little context goes a long way…" /></label>
              <label>Area
                <select name="serviceSlug">
                  <option value="">Not sure yet</option>
                  {services.map((service) => <option value={service.slug} key={service.slug}>{service.title}</option>)}
                </select>
              </label>
              <button className="button button-light" type="submit">Send enquiry ↗</button>
              <p className="form-status">{status}</p>
            </form>
          </div>
        </section>

        <section className="portal-prompt section-pad">
          <h2>Everything your project needs,<br /><span>in one place.</span></h2>
          <a className="button button-outline" href="/portal/login">Access client portal ↗</a>
        </section>
      </main>

      <footer className="hairline-grid">
        <span>ETDOX</span>
        <span>Systems for the next chapter.</span>
        <span>© 2026 ETDOX</span>
      </footer>
    </>
  );
}
