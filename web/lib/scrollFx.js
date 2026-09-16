// GSAP-driven scroll motion for the marketing site: reveal-on-scroll
// (ScrollTrigger.batch, staggered per group), scroll-linked parallax shift
// ([data-parallax], scrubbed), and pointer tilt ([data-tilt]). Call
// initScrollFx() from a page's top-level "use client" component after mount
// (and again whenever content it depends on — e.g. an async fetch — changes);
// it returns a cleanup function that fully tears down everything it created,
// so re-running it never orphans a stale trigger the way a hand-rolled
// IntersectionObserver would.
//
// Nothing here hides content by default: GSAP sets the from-state (opacity/y)
// itself at runtime, so if this script never runs, every element renders at
// its normal CSS opacity (1) — a failed script degrades to "no animation",
// never to "invisible content".

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

export function initScrollFx() {
  if (typeof window === "undefined") return () => {};
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ctx = gsap.context(() => {
    const reveals = gsap.utils.toArray("[data-reveal]");
    if (reduced) {
      gsap.set(reveals, { opacity: 1, y: 0 });
    } else if (reveals.length) {
      gsap.set(reveals, { opacity: 0, y: 24 });
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 90%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.08 }),
      });
    }

    if (!reduced) {
      gsap.utils.toArray("[data-tilt]").forEach((el) => {
        gsap.set(el, { transformPerspective: 800, transformStyle: "preserve-3d" });
        const setX = gsap.quickTo(el, "rotationX", { duration: 0.4, ease: "power3.out" });
        const setY = gsap.quickTo(el, "rotationY", { duration: 0.4, ease: "power3.out" });
        const onMove = (e) => {
          const rect = el.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width - 0.5;
          const py = (e.clientY - rect.top) / rect.height - 0.5;
          setX(py * -6);
          setY(px * 6);
        };
        const onLeave = () => { setX(0); setY(0); };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
      });

      gsap.utils.toArray("[data-parallax]").forEach((el) => {
        const speed = parseFloat(el.dataset.parallax || "0.08");
        gsap.to(el, {
          y: -(window.innerHeight * speed),
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        });
      });
    }

    // Content this run depends on (async fetch, fonts) may still be settling —
    // measure again once it has.
    ScrollTrigger.refresh();
  });

  return () => ctx.revert();
}
