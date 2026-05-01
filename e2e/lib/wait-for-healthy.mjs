const BACKEND_URL = process.env.API_BASE_URL || 'http://localhost:10000';
const NOTIFICATION_URL = process.env.WS_BASE_URL || 'http://localhost:8080';

const MAX_WAIT = parseInt(process.env.HEALTH_TIMEOUT || '180', 10) * 1000;
const POLL_INTERVAL = 3000;

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function waitForHealthy() {
  const start = Date.now();
  const targets = [
    { name: 'backend', url: `${BACKEND_URL}/actuator/health` },
    { name: 'notification', url: `${NOTIFICATION_URL}/healthz` },
  ];

  const ready = new Set();

  while (Date.now() - start < MAX_WAIT) {
    for (const t of targets) {
      if (ready.has(t.name)) continue;
      if (await probe(t.url)) {
        console.log(`  [healthy] ${t.name} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
        ready.add(t.name);
      }
    }
    if (ready.size === targets.length) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  const missing = targets.filter((t) => !ready.has(t.name)).map((t) => t.name);
  throw new Error(`Services not healthy after ${MAX_WAIT / 1000}s: ${missing.join(', ')}`);
}
