const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MANIFEST_TIMEOUT_MS = parseInt(process.env.MANIFEST_TIMEOUT_MS || '20000', 10);
const SEGMENT_TIMEOUT_MS = parseInt(process.env.SEGMENT_TIMEOUT_MS || '15000', 10);
const MAX_REDIRECTS = 5;

// -----------------------------
// Channel list (edit as needed)
// -----------------------------
const CHANNELS = {
  tsports: {
    manifest: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8',
    base: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/',
  },
  // add other channels here (same shape: { manifest, base })
};

// Short in-memory manifest cache to reduce upstream hits
// key: manifestUrl, value: { text, expiresAt }
const manifestCache = new Map();
const MANIFEST_CACHE_TTL_MS = 5000; // short TTL to avoid stale playlists for live

// -----------------------------
// Utility helpers
// -----------------------------
function getContentType(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  switch (ext) {
    case '.ts': return 'video/mp2t';
    case '.aac': return 'audio/aac';
    case '.mp4':
    case '.m4s': return 'video/mp4';
    case '.m3u8': return 'application/vnd.apple.mpegurl';
    case '.vtt': return 'text/vtt';
    default: return 'application/octet-stream';
  }
}

function safeResolve(base, relative) {
  try {
    // If relative is absolute URL -> returns relative
    return new URL(relative, base).toString();
  } catch (e) {
    // fallback using legacy url.resolve
    return url.resolve(base, relative);
  }
}

// -----------------------------
// Global middleware
// -----------------------------
app.use(cors());
app.disable('x-powered-by');
app.set('etag', false);

// Simple health endpoint
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Root: list channels
app.get('/', (req, res) => {
  const list = Object.keys(CHANNELS).map((k) => `<li><a href="/live/${k}" target="_blank">${k.toUpperCase()} Live</a></li>`).join('');
  res.send(`<!doctype html><meta charset="utf-8"><title>HLS Proxy</title><h2>HLS Proxy</h2><ul>${list}</ul>`);
});

// -----------------------------
// Manifest proxy & rewrite
// -----------------------------
app.get('/live/:channel', async (req, res) => {
  const channelKey = req.params.channel && req.params.channel.toLowerCase();
  const ch = CHANNELS[channelKey];
  if (!ch) return res.status(404).send('Channel not found');

  const manifestUrl = ch.manifest;

  // serve from short cache if possible
  const cached = manifestCache.get(manifestUrl);
  if (cached && cached.expiresAt > Date.now()) {
    res.set({ 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*' });
    return res.send(cached.text);
  }

  try {
    const axiosResp = await axios.get(manifestUrl, {
      timeout: MANIFEST_TIMEOUT_MS,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Node HLS Proxy)',
        'Accept': '*/*',
        'Referer': manifestUrl,
        'Origin': new URL(manifestUrl).origin,
      },
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    let manifestText = axiosResp.data;

    // Rewrite: replace sub-playlists and segment references with proxy endpoints
    // We'll handle two common cases:
    // 1) #EXT-X-STREAM-INF\n<sub.m3u8>
    // 2) #EXTINF\n<segment.ts>

    // 1) sub-playlists (variant playlists)
    manifestText = manifestText.replace(/(#EXT-X-STREAM-INF[^\n]*\n)(?![#\s])([^\n]+)/gm, (m, info, p) => {
      const resolved = safeResolve(manifestUrl, p.trim());
      return info + `/segment/${channelKey}?file=` + encodeURIComponent(resolved);
    });

    // 2) segments and segment-like references
    manifestText = manifestText.replace(/(#EXTINF[^\n]*\n)(?![#\s])([^\n]+)/gm, (m, info, p) => {
      const resolved = safeResolve(manifestUrl, p.trim());
      return info + `/segment/${channelKey}?file=` + encodeURIComponent(resolved);
    });

    // Also rewrite key/mapping references (#EXT-X-KEY URI=...) and similar
    manifestText = manifestText.replace(/(URI=")([^\"]+)(")/gm, (m, pre, p, post) => {
      // if it's a full URL or relative, rewrite to proxy
      const resolved = safeResolve(manifestUrl, p);
      return `URI="/segment/${channelKey}?file=` + encodeURIComponent(resolved) + `"`;
    });

    // Cache briefly
    manifestCache.set(manifestUrl, { text: manifestText, expiresAt: Date.now() + MANIFEST_CACHE_TTL_MS });

    res.set({ 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*' });
    return res.send(manifestText);

  } catch (err) {
    console.error(`Manifest fetch failed for ${channelKey}:`, err.message || err);
    return res.status(502).send('Failed to fetch manifest');
  }
});

// -----------------------------
// Segment proxying with redirect handling and Range fallback
// -----------------------------

function proxyRequestWithRedirects(segmentUrl, clientReq, clientRes, channelKey, redirectCount = 0, useRange = false) {
  if (redirectCount > MAX_REDIRECTS) return clientRes.status(500).end();

  let parsed;
  try { parsed = new URL(segmentUrl); } catch (e) {
    // if not absolute, try using channel base
    const ch = CHANNELS[channelKey];
    if (!ch) return clientRes.status(400).send('Invalid segment URL');
    const resolved = safeResolve(ch.base, segmentUrl);
    return proxyRequestWithRedirects(resolved, clientReq, clientRes, channelKey, redirectCount, useRange);
  }

  const isHttps = parsed.protocol === 'https:';
  const reqModule = isHttps ? https : http;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Node HLS Proxy)',
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    // prefer using the channel's manifest as referer - some CDNs look for this
    'Referer': CHANNELS[channelKey] && CHANNELS[channelKey].manifest ? CHANNELS[channelKey].manifest : parsed.origin,
  };

  if (useRange && clientReq.headers['range']) headers['Range'] = clientReq.headers['range'];

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.pathname + (parsed.search || ''),
    method: 'GET',
    headers,
  };

  const upstreamReq = reqModule.request(options, (upstreamRes) => {
    // Redirects
    if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
      const nextUrl = new URL(upstreamRes.headers.location, parsed).toString();
      console.log(`Redirect for ${segmentUrl} -> ${nextUrl}`);
      upstreamRes.resume(); // drain
      return proxyRequestWithRedirects(nextUrl, clientReq, clientRes, channelKey, redirectCount + 1, useRange);
    }

    // 416 Range Not Satisfiable -> retry without Range
    if (upstreamRes.statusCode === 416 && useRange) {
      console.warn('Upstream returned 416 for Range; retrying without Range');
      upstreamRes.resume();
      return proxyRequestWithRedirects(segmentUrl, clientReq, clientRes, channelKey, redirectCount + 1, false);
    }

    if (upstreamRes.statusCode >= 400) {
      console.error(`Upstream returned ${upstreamRes.statusCode} for ${segmentUrl}`);
      clientRes.status(upstreamRes.statusCode).end();
      return;
    }

    // prepare headers to client
    const contentType = upstreamRes.headers['content-type'] || getContentType(parsed.pathname);

    const headersToSend = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=5',
    };
    if (upstreamRes.headers['content-length']) headersToSend['Content-Length'] = upstreamRes.headers['content-length'];
    if (upstreamRes.headers['content-range']) headersToSend['Content-Range'] = upstreamRes.headers['content-range'];
    if (upstreamRes.headers['etag']) headersToSend['ETag'] = upstreamRes.headers['etag'];

    clientRes.writeHead(upstreamRes.statusCode, headersToSend);
    upstreamRes.pipe(clientRes);
  });

  upstreamReq.setTimeout(SEGMENT_TIMEOUT_MS, () => {
    upstreamReq.destroy();
    clientRes.status(504).end();
  });

  upstreamReq.on('error', (e) => {
    console.error('Upstream request error:', e.message || e);
    clientRes.status(502).end();
  });

  upstreamReq.end();
}

app.get('/segment/:channel', (req, res) => {
  const channelKey = (req.params.channel || '').toLowerCase();
  const ch = CHANNELS[channelKey];
  if (!ch) return res.status(404).send('Channel not found');

  const file = req.query.file;
  if (!file) return res.status(400).send('Missing file param');

  const decoded = decodeURIComponent(file);
  // If file is a relative path, safeResolve will prepend base
  const resolved = decoded.startsWith('http') ? decoded : safeResolve(ch.base, decoded);

  // Try with Range header if client sent one, otherwise without Range
  const useRange = !!req.headers['range'];
  proxyRequestWithRedirects(resolved, req, res, channelKey, 0, useRange);
});

// -----------------------------
// Graceful shutdown
// -----------------------------
const server = app.listen(PORT, () => console.log(`🚀 HLS Proxy listening on http://localhost:${PORT}`));

function shutdown() {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
