const express = require("express");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { URL } = require("url");

const app = express();
app.set("trust proxy", true); // if behind Cloud/Render/etc
const PORT = process.env.PORT || 3000;

// --- CONFIG (set via env in production) ---
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://ryvox.xo.je";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "change_this_to_strong_secret";
const TOKEN_TTL_SEC = Number(process.env.TOKEN_TTL_SEC || 300); // default 5 min

// --- Lightweight channels (add/modify) ---
const channels = {
  tsports: {
    manifest: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8",
    base: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/",
  },
  boishakhi: {
    manifest: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8",
    base: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/",
  },
  anandatv: {
    manifest: "https://app24.jagobd.com.bd/.../anandatv.stream/playlist.m3u8",
    base: "https://app24.jagobd.com.bd/.../anandatv.stream/",
    // optional headers for origin fetch (Jagobd often needs Referer)
    headers: {
      Referer: "https://www.jagobd.com/",
      Origin: "https://www.jagobd.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  },
};

// --- Minimal security: CORS + rate-limit ---
app.use(cors({
  origin: function(origin, cb) {
    if (!origin) return cb(null, true); // allow non-browser requests
    if (origin === ALLOWED_ORIGIN) return cb(null, true);
    return cb(new Error("CORS not allowed"), false);
  },
  methods: ["GET"]
}));

const limiter = rateLimit({
  windowMs: 15 * 1000, // 15s window
  max: 80, // limit per IP (adjust)
});
app.use(limiter);

// --- Token helpers (HMAC-signed JSON payload base64) ---
function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function sign(str) {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(str).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function createTokenPayload(channel, ip) {
  const payload = {
    channel,
    ip: ip || null,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
    jti: crypto.randomBytes(8).toString("hex")
  };
  const b = base64url(JSON.stringify(payload));
  const sig = sign(b);
  return `${b}.${sig}`;
}
function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [b, sig] = parts;
    const expected = sign(b);
    // timingSafeEqual needs Buffers of same length
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(b, "base64").toString());
    return payload;
  } catch (e) {
    return null;
  }
}

// (Optional) simple in-memory used-jti set for quick replay protection while token valid
const usedJtis = new Map(); // jti -> expirySec
setInterval(() => {
  const now = Math.floor(Date.now()/1000);
  for (const [k, exp] of usedJtis) if (exp < now) usedJtis.delete(k);
}, 30*1000);

// --- helper to get client IP (trust proxy enabled) ---
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return req.socket.remoteAddress;
}

// --- endpoint: serve proxied manifest with per-manifest token ---
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const ch = channels[channel];
  if (!ch) return res.status(404).send("Channel not found");

  const clientIp = getClientIp(req);

  try {
    const originResp = await axios.get(ch.manifest, {
      responseType: "text",
      headers: ch.headers || undefined,
      timeout: 10000,
    });

    const lines = originResp.data.split(/\r?\n/);
    // create ONE token for this manifest (per-client IP)
    const token = createTokenPayload(channel, clientIp);

    // rewrite all non-comment lines to absolute /segment URLs (keep comments as-is)
    const baseHost = `${req.protocol}://${req.get("host")}`;
    const outLines = lines.map(line => {
      if (!line || line.trim() === "" || line.startsWith("#")) return line;
      // keep original URI encoded in 'file' param; segments will be resolved at /segment
      const encoded = encodeURIComponent(line.trim());
      return `${baseHost}/segment/${channel}?file=${encoded}&token=${encodeURIComponent(token)}`;
    });

    // prevent caching (important — token per-manifest must not be cached)
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.send(outLines.join("\n"));
  } catch (err) {
    console.error("[/live] fetch manifest error:", err.message || err);
    return res.status(502).send("Upstream manifest fetch error");
  }
});

// --- endpoint: serve segments after token validation (per-manifest token validated here) ---
app.get("/segment/:channel", async (req, res) => {
  const { channel } = req.params;
  const { file, token } = req.query;
  if (!file || !token) return res.status(400).send("Missing file or token");
  const ch = channels[channel];
  if (!ch) return res.status(404).send("Channel not found");

  const payload = verifyToken(String(token));
  if (!payload) return res.status(403).send("Invalid token");

  // basic validations
  const now = Math.floor(Date.now()/1000);
  if (payload.channel !== channel) return res.status(403).send("Channel mismatch");
  if (payload.exp < now) return res.status(403).send("Token expired");

  const clientIp = getClientIp(req);
  if (payload.ip && payload.ip !== clientIp) return res.status(403).send("IP mismatch");

  // simple replay protection (reject if same jti used recently)
  if (usedJtis.has(payload.jti)) return res.status(403).send("Token replay detected");
  usedJtis.set(payload.jti, payload.exp);

  // reconstruct target URL from original manifest line
  let orig;
  try { orig = decodeURIComponent(String(file)); } catch(e) { orig = String(file); }

  let target;
  try {
    if (/^https?:\/\//i.test(orig)) {
      target = orig;
    } else if (/^\/\//.test(orig)) {
      target = `${req.protocol}:${orig}`;
    } else {
      const base = ch.base || ch.manifest.replace(/[^\/]+$/,'');
      target = new URL(orig, base).href;
    }
  } catch (err) {
    console.error("[/segment] URL resolve error", err.message || err);
    return res.status(500).send("Invalid segment URL");
  }

  // fetch upstream segment (pass channel.headers if provided)
  const upstreamHeaders = {
    Referer: ch.manifest,
    "User-Agent": req.headers["user-agent"] || "Light-HLS-Proxy/1.0",
  };
  if (ch.headers) Object.assign(upstreamHeaders, ch.headers);

  try {
    const up = await axios({
      url: target,
      method: "GET",
      responseType: "stream",
      timeout: 20000,
      headers: upstreamHeaders,
    });

    // pass along content-type; prevent caching
    res.setHeader("Content-Type", up.headers["content-type"] || "video/mp2t");
    res.setHeader("Cache-Control", "no-store");
    up.data.pipe(res);
    up.data.on("error", (err) => {
      console.error("[/segment] upstream stream error", err && err.message);
      try { res.end(); } catch(e) {}
    });
  } catch (err) {
    console.error("[/segment] fetch error", err.message || err);
    return res.status(502).send("Upstream segment fetch error");
  }
});

// --- simple root ---
app.get("/", (req, res) => {
  res.send(`<h3>Light & Secure HLS Proxy</h3><p>Allowed origin: ${ALLOWED_ORIGIN}</p>`);
});

// start
app.listen(PORT, () => {
  console.log(`LightSecure HLS proxy listening on ${PORT}`);
});
