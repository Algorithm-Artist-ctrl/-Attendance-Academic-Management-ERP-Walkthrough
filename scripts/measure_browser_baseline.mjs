import { spawn } from 'child_process';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getBrowserWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
      } catch {}
    } catch {
      await sleep(200);
    }
  }
  throw new Error('Could not connect to Chrome /json/version');
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.eventListeners = new Map();
    this.sessionListeners = new Map();

    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        } else if (msg.method) {
          if (msg.sessionId && this.sessionListeners.has(msg.sessionId)) {
            const listeners = this.sessionListeners.get(msg.sessionId).get(msg.method) || [];
            for (const cb of listeners) cb(msg.params);
          } else {
            const listeners = this.eventListeners.get(msg.method) || [];
            for (const cb of listeners) cb(msg.params);
          }
        }
      };
    });
  }

  on(method, cb) {
    if (!this.eventListeners.has(method)) {
      this.eventListeners.set(method, []);
    }
    this.eventListeners.get(method).push(cb);
  }

  onSession(sessionId, method, cb) {
    if (!this.sessionListeners.has(sessionId)) {
      this.sessionListeners.set(sessionId, new Map());
    }
    const map = this.sessionListeners.get(sessionId);
    if (!map.has(method)) {
      map.set(method, []);
    }
    map.get(method).push(cb);
  }

  async send(method, params = {}, sessionId = undefined) {
    await this.ready;
    const id = this.id++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async close() {
    this.ws.close();
  }
}

async function measurePage(browserCdp, targetUrl, options = {}) {
  const { isMobile = false, isSlow4G = false } = options;

  console.log(`\n======================================================`);
  console.log(`Measuring: ${targetUrl} [${isMobile ? 'Mobile' : 'Desktop'}${isSlow4G ? ' - Slow 4G' : ' - Normal'}]`);
  console.log(`======================================================`);

  const { targetId } = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browserCdp.send('Target.attachToTarget', { targetId, flatten: true });

  const requests = new Map();
  const completedRequests = [];
  let realtimeConnections = 0;

  browserCdp.onSession(sessionId, 'Network.requestWillBeSent', (params) => {
    requests.set(params.requestId, {
      requestId: params.requestId,
      url: params.request.url,
      method: params.request.method,
      type: params.type,
      startTime: params.timestamp,
    });
    if (params.request.url.includes('/realtime/v1/websocket')) {
      realtimeConnections++;
    }
  });

  browserCdp.onSession(sessionId, 'Network.responseReceived', (params) => {
    const req = requests.get(params.requestId);
    if (req) {
      req.status = params.response.status;
      req.mimeType = params.response.mimeType;
      req.encodedDataLength = params.response.encodedDataLength;
    }
  });

  browserCdp.onSession(sessionId, 'Network.loadingFinished', (params) => {
    const req = requests.get(params.requestId);
    if (req) {
      req.endTime = params.timestamp;
      req.durationMs = (params.timestamp - req.startTime) * 1000;
      req.encodedDataLength = params.encodedDataLength || req.encodedDataLength || 0;
      completedRequests.push(req);
    }
  });

  browserCdp.onSession(sessionId, 'Network.loadingFailed', (params) => {
    const req = requests.get(params.requestId);
    if (req) {
      req.failed = true;
      req.errorText = params.errorText;
      completedRequests.push(req);
    }
  });

  await browserCdp.send('Page.enable', {}, sessionId);
  await browserCdp.send('Network.enable', {}, sessionId);
  await browserCdp.send('Runtime.enable', {}, sessionId);
  await browserCdp.send('Performance.enable', {}, sessionId);

  if (isMobile) {
    await browserCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    }, sessionId);
  }

  if (isSlow4G) {
    // Chrome Slow 4G: 150ms RTT latency, 1.6Mbps down, 750Kbps up
    await browserCdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    }, sessionId);
    await browserCdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }, sessionId);
  } else {
    await browserCdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    }, sessionId);
    await browserCdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }, sessionId);
  }

  const startTime = Date.now();
  await browserCdp.send('Page.navigate', { url: targetUrl }, sessionId);

  // Wait for initial load
  let prevCount = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const curCount = completedRequests.length;
    if (curCount > 0 && curCount === prevCount && (Date.now() - startTime > (isSlow4G ? 6000 : 3000))) {
      break;
    }
    prevCount = curCount;
  }

  const loadDurationMs = Date.now() - startTime;

  let perfMetrics = {};
  try {
    const res = await browserCdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const paint = performance.getEntriesByType('paint');
          const fcp = paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0;
          const nav = performance.getEntriesByType('navigation')[0];
          return {
            fcp: Math.round(fcp),
            domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
            loadEvent: nav ? Math.round(nav.loadEventEnd) : 0,
          };
        })()
      `,
      returnByValue: true,
    }, sessionId);
    perfMetrics = res?.value || {};
  } catch {}

  let lcp = 0;
  try {
    const lcpRes = await browserCdp.send('Runtime.evaluate', {
      expression: `
        new Promise(resolve => {
          let lastLcp = 0;
          const po = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              lastLcp = entry.startTime;
            }
          });
          po.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => {
            po.disconnect();
            resolve(Math.round(lastLcp));
          }, 800);
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    lcp = lcpRes?.value || 0;
  } catch {}

  const totalRequests = completedRequests.length;
  const failedRequests = completedRequests.filter(r => r.failed || (r.status && r.status >= 400)).length;
  const supabaseRequests = completedRequests.filter(r => r.url.includes('.supabase.co/rest/v1'));
  
  let totalTransferred = 0;
  let jsTransferred = 0;
  for (const r of completedRequests) {
    totalTransferred += r.encodedDataLength || 0;
    if (r.type === 'Script' || r.url.endsWith('.js') || r.url.includes('.js?')) {
      jsTransferred += r.encodedDataLength || 0;
    }
  }

  const supabaseQueries = new Map();
  for (const r of supabaseRequests) {
    try {
      const parsed = new URL(r.url);
      const queryPath = parsed.pathname + parsed.search;
      supabaseQueries.set(queryPath, (supabaseQueries.get(queryPath) || 0) + 1);
    } catch {}
  }

  const duplicates = [];
  for (const [q, count] of supabaseQueries.entries()) {
    if (count > 1) {
      duplicates.push({ query: q, count });
    }
  }

  const sortedByDuration = [...completedRequests]
    .filter(r => r.durationMs !== undefined)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5);

  console.log(`\n📊 MEASUREMENT RESULTS:`);
  console.log(`- Page Load Time: ${loadDurationMs}ms`);
  console.log(`- FCP: ${perfMetrics.fcp || 0}ms`);
  console.log(`- LCP: ${lcp || perfMetrics.fcp || 0}ms`);
  console.log(`- DOMContentLoaded: ${perfMetrics.domContentLoaded || 0}ms`);
  console.log(`- Total Requests: ${totalRequests}`);
  console.log(`- Supabase REST Requests: ${supabaseRequests.length}`);
  console.log(`- Failed/Pending Requests: ${failedRequests}`);
  console.log(`- Total Transferred: ${(totalTransferred / 1024).toFixed(1)} KB`);
  console.log(`- JS Transferred: ${(jsTransferred / 1024).toFixed(1)} KB`);
  console.log(`- Realtime Channels: ${realtimeConnections}`);
  console.log(`- Duplicate Supabase Queries: ${duplicates.length}`);
  if (duplicates.length > 0) {
    for (const d of duplicates) {
      console.log(`   * ${d.count}x: ${d.query}`);
    }
  }
  console.log(`- Top 3 Slowest Requests:`);
  for (const s of sortedByDuration.slice(0, 3)) {
    const cleanUrl = s.url.length > 80 ? s.url.substring(0, 77) + '...' : s.url;
    console.log(`   * ${Math.round(s.durationMs)}ms: ${cleanUrl}`);
  }

  await browserCdp.send('Target.closeTarget', { targetId });

  return {
    targetUrl,
    mode: `${isMobile ? 'Mobile' : 'Desktop'}${isSlow4G ? ' (Slow 4G)' : ' (Normal)'}`,
    loadDurationMs,
    fcp: perfMetrics.fcp || 0,
    lcp: lcp || perfMetrics.fcp || 0,
    domContentLoaded: perfMetrics.domContentLoaded || 0,
    totalRequests,
    supabaseRequests: supabaseRequests.length,
    failedRequests,
    totalTransferredKb: Math.round((totalTransferred / 1024) * 10) / 10,
    jsTransferredKb: Math.round((jsTransferred / 1024) * 10) / 10,
    realtimeChannels: realtimeConnections,
    duplicateQueries: duplicates,
    slowestRequests: sortedByDuration.map(s => ({
      url: s.url,
      durationMs: Math.round(s.durationMs),
    })),
  };
}

async function main() {
  console.log('🚀 Launching Headless Chrome for CDP Measurement...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--user-data-dir=/tmp/chrome-perf-' + Date.now(),
  ]);

  try {
    await sleep(1500);
    const wsUrl = await getBrowserWs();
    console.log('✅ Connected to Browser WebSocket:', wsUrl);

    const browserCdp = new CDPClient(wsUrl);
    const prodUrl = 'https://attendance-academic-management-erp.onrender.com/';

    // 1. Desktop Normal
    const desktopNormal = await measurePage(browserCdp, prodUrl, {
      isMobile: false,
      isSlow4G: false,
    });

    // 2. Mobile Slow 4G
    const mobileSlow4G = await measurePage(browserCdp, prodUrl, {
      isMobile: true,
      isSlow4G: true,
    });

    console.log('\n======================================================');
    console.log('📋 COMPLETE BASELINE MEASUREMENT REPORT');
    console.log('======================================================');
    console.log(JSON.stringify({ desktopNormal, mobileSlow4G }, null, 2));

    await browserCdp.close();
  } finally {
    chromeProcess.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('Fatal error in measurement:', err);
  process.exit(1);
});
