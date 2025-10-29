import express from "express";
import axios from "axios";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

const app = express();
app.set("trust proxy", true); // respect x-forwarded-for (useful behind proxies)
const PORT = process.env.PORT || 3000;

// CONFIG - change as needed or via environment
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://ryvox.xo.je";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "replace_this_with_strong_secret_in_prod";
const TOKEN_TTL_SEC = Number(process.env.TOKEN_TTL_SEC || 180); // token life (seconds)
const REPLAY_CLEANUP_INTERVAL_MS = 30 * 1000; // cleanup replay store
const FORCE_HTTPS = process.env.FORCE_HTTPS === "1";

// ---------- Simple channel config ----------
/**
 * For channels you can optionally provide:
 *  - manifest: m3u8 url
 *  - base: base url to resolve relative segments (optional)
 *  - headers: optional object of extra headers to use when fetching origin segments/manifests
 */
const channels = {
  tsports: {
    manifest: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8",
    base: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/",
  },
  boishakhi: {
    manifest: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8",
    base: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/",
  },
  bangla_tv: {
    manifest:
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/1702-audio_113322_eng=113200-video=442000.m3u8",
    base: "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/",
  },
  anandatv: {
    manifest:
      "https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/playlist.m3u8",
    base:
      "https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/",
    headers: {
      Referer: "https://www.jagobd.com/",
      Origin: "https://www.jagobd.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  },
};

// ---------- Security middlewares ----------
app.use(helmet({
  contentSecurityPolicy: false, // disable complex CSP here; configure at frontend if needed
}));
app.disable("x-powered-by");

// Force HTTPS (if behind a load balancer that supports TLS termination)
if (FORCE_HTTPS) {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
    const host = req.get("host");
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}

// CORS: only allow your origin
app.use(cors({
  origin: (origin, cb) => {
    // allow non-browser requests with no origin (e.g. server-to-server)
    if (!origin) return cb(null, true);
    if (origin === ALLOWED_ORIGIN) return cb(null, true);
    return cb(new Error("CORS not allowed"), false);
  },
  methods: ["GET"],
}));

// Rate limiting (protect endpoints from abuse)
const limiter = rateLimit({
  windowMs: 30 * 1000,
  max: 60, // 60 requests per 30s per IP (tweak as needed)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ---------- Token: stateless HMAC-signed ----------
function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function sign(payloadStr) {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(payloadStr).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function createSignedToken({ channel, ip, ttlSec = TOKEN_TTL_SEC }) {
  const header = { alg: "HS256", typ: "JWT-LIKE" };
  const jti = crypto.randomBytes(9).toString("hex");
  const payload = {
    channel,
    ip: ip || null,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
    jti,
  };
  const headerB = base64url(JSON.stringify(header));
  const payloadB = base64url(JSON.stringify(payload));
  const sig = sign(`${headerB}.${payloadB}`);
  const token = `${headerB}.${payloadB}.${sig}`;
  return token;
}
function verifySignedToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [hb, pb, sig] = parts;
    const expected = sign(`${hb}.${pb}`);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(pb, "base64").toString());
    return payload;
  } catch (err) {
    return null;
  }
}

// ---------- Replay protection (store used jtis) ----------
const usedJtis = new Map(); // jti -> expiry (seconds-since-epoch)
function addUsedJti(jti, exp) {
  usedJtis.set(jti, exp);
}
function isJtiUsed(jti) {
  return usedJtis.has(jti);
}
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of usedJtis.entries()) {
    if (exp < now) usedJtis.delete(jti);
  }
}, REPLAY_CLEANUP_INTERVAL_MS);

// ---------- Helpers ----------
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return req.socket.remoteAddress;
}
function makeAbsoluteProxyUrl(req, channel, originalUri, token) {
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}/segment/${channel}?file=${encodeURIComponent(originalUri)}&token=${encodeURIComponent(token)}`;
}

// ---------- Routes ----------

// Home
app.get("/", (req, res) => {
  res.send(`<h2>Secure HLS Proxy</h2><p>Allowed Origin: ${ALLOWED_ORIGIN}</p>`);
});

// Optional public token endpoint (only from ALLOWED_ORIGIN)
app.get("/token/:channel", (req, res) => {
  const { channel } = req.params;
  if (!channels[channel]) return res.status(404).send("Channel not found");
  // only allow if origin matches (CORS also blocks, but double-check)
  const origin = req.headers.origin || "";
  if (origin && origin !== ALLOWED_ORIGIN) return res.status(403).send("Forbidden origin");
  const ip = getClientIp(req);
  const token = createSignedToken({ channel, ip });
  res.json({ token, expiresIn: TOKEN_TTL_SEC });
});

// Live manifest proxy: rewrites each URI to /segment/:channel with signed token
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const ch = channels[channel];
  if (!ch) return res.status(404).send("Channel not found");

  const clientIp = getClientIp(req);

  try {
    // fetch manifest; pass custom headers if channel requires
    const manifestResp = await axios.get(ch.manifest, {
      responseType: "text",
      headers: ch.headers ? ch.headers : undefined,
      timeout: 10000,
    });
    const manifestText = manifestResp.data;
    const lines = manifestText.split(/\r?\n/);

    const outLines = lines.map(line => {
      if (!line || line.trim() === "" || line.startsWith("#")) return line;
      // build token bound to client IP and channel
      const token = createSignedToken({ channel, ip: clientIp });
      return makeAbsoluteProxyUrl(req, channel, line.trim(), token);
    });

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    // prevent caching to avoid token reuse from caches
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.send(outLines.join("\n"));
  } catch (err) {
    console.error("[/live] fetch manifest error:", err.message || err);
    return res.status(502).send("Error fetching upstream manifest");
  }
});

// Segment endpoint: validate signed token, check ip, replay, then stream origin
app.get("/segment/:channel", async (req, res) => {
  const { channel } = req.params;
  const { file, token } = req.query;
  if (!channels[channel]) return res.status(404).send("Channel not found");
  if (!file || !token) return res.status(400).send("Missing file or token");

  // verify token
  const payload = verifySignedToken(String(token));
  if (!payload) return res.status(403).send("Invalid token");
  const nowSec = Math.floor(Date.now() / 1000);

  if (payload.channel !== channel) return res.status(403).send("Channel mismatch");
  if (payload.exp < nowSec) return res.status(403).send("Token expired");

  // IP check (if token included ip)
  const clientIp = getClientIp(req);
  if (payload.ip && payload.ip !== clientIp) return res.status(403).send("IP mismatch");

  // replay protection
  if (isJtiUsed(payload.jti)) return res.status(403).send("Token already used");
  // mark used
  addUsedJti(payload.jti, payload.exp);

  // reconstruct original uri
  let orig;
  try {
    orig = decodeURIComponent(String(file));
  } catch (e) {
    orig = String(file);
  }

  // resolve to absolute target
  let target;
  try {
    if (/^https?:\/\//i.test(orig)) {
      target = orig;
    } else if (/^\/\//.test(orig)) {
      // protocol-relative
      target = `${req.protocol}:${orig}`;
    } else {
      const base = channels[channel].base || channels[channel].manifest.replace(/[^\/]+$/,'');
      target = new URL(orig, base).href;
    }
  } catch (err) {
    console.error("[/segment] URL resolve error", err);
    return res.status(500).send("Invalid segment URL");
  }

  // build headers for upstream (merge channel.headers if present)
  const upstreamHeaders = {
    Referer: channels[channel].manifest,
    "User-Agent": req.headers["user-agent"] || "Ryvox-SecureProxy/1.0",
  };
  if (channels[channel].headers) {
    Object.assign(upstreamHeaders, channels[channel].headers);
  }

  // fetch upstream as stream
  try {
    const up = await axios({
      url: target,
      method: "GET",
      responseType: "stream",
      timeout: 20000,
      headers: upstreamHeaders,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // set upstream content-type; also ensure no caching
    res.setHeader("Content-Type", up.headers["content-type"] || "video/mp2t");
    res.setHeader("Cache-Control", "no-store");
    up.data.pipe(res);

    up.data.on("error", (err) => {
      console.error("[/segment] upstream stream error", err.message || err);
      try { res.end(); } catch(e) {}
    });
  } catch (err) {
    console.error("[/segment] fetch error", err.message || err);
    return res.status(502).send("Upstream fetch error");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Secure HLS proxy listening on port ${PORT}`);
});
