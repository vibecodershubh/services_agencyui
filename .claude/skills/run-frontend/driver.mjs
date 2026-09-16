// Driver for the services-agency web app: starts the API + Next.js dev
// servers, drives pages with Playwright (against system Chrome — this repo
// has no network access to download Playwright's own browser build), and
// stops them again. Run from anywhere; paths resolve relative to repo root.
//
// Usage:
//   node .claude/skills/run-frontend/driver.mjs up
//   node .claude/skills/run-frontend/driver.mjs shot <path> <name> [waitSelector]
//   node .claude/skills/run-frontend/driver.mjs demo
//   node .claude/skills/run-frontend/driver.mjs down

import { chromium } from "playwright-core";
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RUN_DIR = path.join(tmpdir(), "services-agency-run");
const SHOTS_DIR = path.join(RUN_DIR, "shots");
mkdirSync(SHOTS_DIR, { recursive: true });

const API_PORT = 3000;
const WEB_PORT = 3001;
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

function findBrowser() {
  return CHROME_CANDIDATES.find((p) => existsSync(p));
}

async function isRunning(url) {
  try {
    const res = await fetch(url);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForPort(url, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isRunning(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function spawnBackground(npmScript, logFile) {
  const fd = openSync(logFile, "a");
  const child = spawn(`npm run ${npmScript}`, {
    cwd: ROOT,
    shell: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
}

// Windows-only: find the PID listening on a port and taskkill it. npm's
// child PID ($!) is just the npm wrapper — it doesn't forward SIGTERM to
// the server process it spawns, so killing by port is what actually frees it.
function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`).toString();
    const pids = new Set(out.trim().split("\n").map((l) => l.trim().split(/\s+/).pop()).filter(Boolean));
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`);
        console.log(`killed port ${port} (pid ${pid})`);
      } catch {}
    }
    if (pids.size === 0) console.log(`nothing listening on ${port}`);
  } catch {
    console.log(`nothing listening on ${port}`);
  }
}

async function ensureSpawned(label, url, npmScript, logFile) {
  if (await isRunning(url)) {
    console.log(`${label} already up`);
    return;
  }
  console.log(`starting ${label} (npm run ${npmScript})...`);
  spawnBackground(npmScript, logFile);
}

async function cmdUp() {
  await Promise.all([
    ensureSpawned("backend", API_URL + "/health", "dev", path.join(RUN_DIR, "backend.log")),
    ensureSpawned("frontend", WEB_URL, "dev:web", path.join(RUN_DIR, "frontend.log")),
  ]);

  const [apiReady, webReady] = await Promise.all([
    waitForPort(API_URL + "/health"),
    waitForPort(WEB_URL),
  ]);
  console.log(`backend ready: ${apiReady} (logs: ${path.join(RUN_DIR, "backend.log")})`);
  console.log(`frontend ready: ${webReady} (logs: ${path.join(RUN_DIR, "frontend.log")})`);
  if (!apiReady || !webReady) process.exit(1);
}

function cmdDown() {
  killPort(API_PORT);
  killPort(WEB_PORT);
}

async function launchBrowser() {
  const browserPath = findBrowser();
  if (!browserPath) {
    console.error("No system Chrome/Edge found at the known install paths. Edit CHROME_CANDIDATES in driver.mjs.");
    process.exit(1);
  }
  return chromium.launch({ executablePath: browserPath });
}

// Takes an already-launched browser so callers doing multiple shots (cmdDemo)
// pay Chromium's launch cost once instead of once per page.
async function shoot(browser, urlPath, name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleMsgs = [];
  // "Failed to load resource" console entries don't carry a URL — track
  // the actual failing requests via the response event instead, so the
  // known-harmless favicon 404 (no icon file in web/app/ yet) can be
  // filtered out precisely rather than by guessing at console text.
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().startsWith("Failed to load resource")) return;
    consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleMsgs.push(`[pageerror] ${err.message}`));
  const failedRequests = [];
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().endsWith("/favicon.ico")) {
      failedRequests.push(`${res.status()} ${res.url()}`);
    }
  });

  const url = WEB_URL + urlPath;
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch((e) => {
    console.log("nav error:", e.message);
    return null;
  });
  console.log("status:", resp?.status());
  const shotPath = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("screenshot:", shotPath);
  console.log("console:", consoleMsgs.length ? consoleMsgs.join("\n") : "(clean)");
  console.log("failed requests:", failedRequests.length ? failedRequests.join("\n") : "(none)");

  await page.close();
}

async function cmdShot(urlPath, name) {
  const browser = await launchBrowser();
  await shoot(browser, urlPath, name);
  await browser.close();
}

async function cmdDemo() {
  await cmdUp();
  const browser = await launchBrowser();
  await shoot(browser, "/", "home");
  await shoot(browser, "/services", "services-index");
  await shoot(browser, "/portal/login", "portal-login");
  await browser.close();
  console.log(`\nAll screenshots in ${SHOTS_DIR}`);
  console.log("Servers left running — call `node driver.mjs down` when finished.");
}

const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  case "up":
    await cmdUp();
    break;
  case "down":
    cmdDown();
    break;
  case "shot":
    await cmdShot(rest[0], rest[1]);
    break;
  case "demo":
    await cmdDemo();
    break;
  default:
    console.log("usage: node driver.mjs <up|down|shot <path> <name>|demo>");
    process.exit(1);
}
