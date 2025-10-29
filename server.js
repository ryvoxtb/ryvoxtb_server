// server.js
import express from "express";
import axios from "axios";
import cors from "cors";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

// change to your allowed origin
const allowedOrigin = "http://ryvox.xo.je";

// In-memory token store: token -> { channel, expires, ip }
const activeTokens = new Map();

// Generate token (IP-bound)
function generateToken(channel, ip) {
  const token = crypto.randomBytes(12).toString("hex"); // longer token
  const expires = Date.now() + 120 * 1000; // 2 minutes
  activeTokens.set(token, { channel, expires, ip });
  return token;
}

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [t, info] of activeTokens.entries()) {
    if (info.expires < now) activeTokens.delete(t);
  }
}, 30000);

// Channel definitions (manifest + optional base for relative segments)
const channels = {
  tsports: {
    manifest: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8",
    base: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/"
  },
  boishakhi: {
    manifest: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8",
    base: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/"
  },
  bangla_tv: {
    manifest: "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/1702-audio_113322_eng=113200-video=442000.m3u8",
    base: "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/"
  },
  anandatv: {
    manifest: "https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/playlist.m3u8",
    base: "https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/"
  }
};

// Domain check middleware
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || "";
  if (origin && origin.startsWith(allowedOrigin)) return next();
  // allow token fetches from server itself (optional)
  if (!origin) return next();
  return res.status(403).send("Access denied: only allowed from configured origin");
});

// CORS (so browser can request token / manifest)
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET"]
}));

// Helper: get client IP (respect x-forwarded-for if behind proxy)
// NOTE: when behind a reverse proxy, ensure trust proxy is configured
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return req.socket.remoteAddress;
}

// Token endpoint (if client wants to request tokens separately)
app.get("/token/:channel", (req, res) => {
  const { channel } = req.params;
  if (!channels[channel]) return res.status(404).send("Channel not found");
  const userIP = getClientIp(req);
  const token = generateToken(channel, userIP);
  res.json({ token, expiresIn: 120 });
});

// Live manifest endpoint - rewrites URIs to absolute proxy URLs with tokens
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const info = channels[channel];
  if (!info) return res.status(404).send("Channel not found");

  const userIP = getClientIp(req);

  try {
    // fetch manifest as text
    const response = await axios.get(info.manifest, { responseType: "text", timeout: 10000 });
    const manifestRaw = response.data;

    // Break into lines and rewrite non-# lines (URIs)
    const hostPrefix = `${req.protocol}://${req.get("host")}`;

    const lines = manifestRaw.split(/\r?\n/);
    const outLines = lines.map(line => {
      // keep comments/empty lines as-is
      if (!line || line.trim().length === 0) return line;
      if (line.startsWith("#")) return line;

      // line is a URI (could be relative or absolute)
      // generate a token per requested resource
      const token = generateToken(channel, userIP);

      // encode the original value (so we can reconstruct later)
      // We will pass the original URI exactly as it was, and segment handler will resolve it
      const encoded = encodeURIComponent(line);

      // return an absolute proxy URL pointing to /segment/:channel
      return `${hostPrefix}/segment/${channel}?file=${encoded}&token=${token}`;
    });

    const manifestOut = outLines.join("\n");
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(manifestOut);

  } catch (err) {
    console.error("[/live] Error fetching manifest for", channel, err.message || err.toString());
    res.status(500).send("Error loading manifest");
  }
});

// Segment proxy endpoint - validates token + ip, resolves target, streams it
app.get("/segment/:channel", async (req, res) => {
  const { channel } = req.params;
  const fileParam = req.query.file;
  const token = req.query.token;

  if (!channels[channel]) return res.status(404).send("Channel not found");
  if (!fileParam || !token) return res.status(400).send("Missing file or token");

  const info = activeTokens.get(token);
  const userIP = getClientIp(req);

  if (!info || info.channel !== channel || info.expires < Date.now() || info.ip !== userIP) {
    return res.status(403).send("Token expired, invalid, or IP mismatch");
  }

  // reconstruct original URI from fileParam
  let originalUri;
  try {
    originalUri = decodeURIComponent(fileParam);
  } catch (e) {
    originalUri = fileParam;
  }

  // Determine final target URL:
  // - if originalUri starts with http or // -> use as absolute (// -> add protocol)
  // - otherwise resolve relative to channel.base if provided, else to manifest location
  let targetUrl;
  try {
    if (/^\/\//.test(originalUri)) {
      // protocol-relative
      targetUrl = `${req.protocol}:${originalUri}`;
    } else if (/^https?:\/\//i.test(originalUri)) {
      targetUrl = originalUri;
    } else {
      // relative path -> resolve against base if available, else against manifest
      const channelInfo = channels[channel];
      const baseStr = channelInfo.base || (channelInfo.manifest ? channelInfo.manifest.replace(/[^\/]+$/,'') : null);
      if (!baseStr) {
        return res.status(500).send("Cannot resolve relative segment URL (no base)");
      }
      // Use URL constructor to resolve
      targetUrl = new URL(originalUri, baseStr).href;
    }
  } catch (err) {
    console.error("[/segment] URL resolution error:", err.message);
    return res.status(500).send("URL resolution error");
  }

  try {
    // stream the target resource
    const upstream = await axios({
      method: "get",
      url: targetUrl,
      responseType: "stream",
      timeout: 20000,
      headers: {
        // optional: pass a Referer or User-Agent if needed by origin
        Referer: channels[channel].manifest,
        "User-Agent": req.headers["user-agent"] || "RyvoxTB-Proxy/1.0"
      }
    });

    // Set Content-Type from upstream if present, otherwise default to video/mp2t
    const ct = upstream.headers["content-type"] || "video/mp2t";
    res.setHeader("Content-Type", ct);

    // Stream data
    upstream.data.pipe(res);

    // optional: handle upstream end / errors
    upstream.data.on("error", err => {
      console.error("[/segment] upstream stream error:", err.message);
      try { res.end(); } catch(e) {}
    });

  } catch (err) {
    console.error("[/segment] error fetching", targetUrl, err.message || err.toString());
    // Consider returning 502 for upstream errors
    res.status(502).send("Segment fetch error");
  }
});

// Root info page
app.get("/", (req, res) => {
  res.send(`
    <h2>🎥 RyvoxTB Secure Live TV Server</h2>
    <p>Allowed origin: ${allowedOrigin}</p>
    <p>IP-bound tokens (2 minutes). Proxying manifests & segments.</p>
    <ul>
      <li><a href="/live/tsports" target="_blank">T-Sports (manifest)</a></li>
      <li><a href="/live/boishakhi" target="_blank">Boishakhi (manifest)</a></li>
      <li><a href="/live/bangla_tv" target="_blank">Bangla TV (manifest)</a></li>
      <li><a href="/live/anandatv" target="_blank">Ananda TV (manifest)</a></li>
    </ul>
    <p>Use the HLS player on your frontend to consume <code>/live/:channel</code>.</p>
  `);
});

// Start server
app.listen(PORT, () => console.log(`✅ Secure server running on port ${PORT}`));
