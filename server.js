// ✅ Import dependencies
import express from "express";
import axios from "axios";
import cors from "cors";
import crypto from "crypto";

const app = express();
app.set("trust proxy", true); // ✅ Render/Vercel proxy IP fix
const PORT = process.env.PORT || 3000;

// ✅ Allowed domain (change if needed)
const allowedOrigin = "http://ryvox.xo.je";

// ✅ In-memory token store
const activeTokens = new Map();

// ✅ Generate secure IP-bound token
function generateToken(channel, ip) {
  const token = crypto.randomBytes(12).toString("hex");
  const expires = Date.now() + 5 * 60 * 1000; // ⏱️ 5 minutes validity
  activeTokens.set(token, { channel, expires, ip });
  return token;
}

// ✅ Clean up expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [t, data] of activeTokens.entries()) {
    if (data.expires < now) activeTokens.delete(t);
  }
}, 30000);

// ✅ Channel list
const channels = {
  tsports: {
    manifest: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8",
    base: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/",
  },
  boishakhi: {
    manifest:
      "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8",
    base: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/",
  },
  bangla_tv: {
    manifest:
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/1702-audio_113322_eng=113200-video=442000.m3u8",
    base: "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/",
  },
  channel24bd: {
    manifest:
      "https://ch24cdn.ncare.live/channel24/ch24office/tracks-v1a1/mono.m3u8",
    base: "https://ch24cdn.ncare.live/channel24/ch24office/tracks-v1a1/",
  }
};

// ✅ Get client IP (trust proxy enabled)
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return req.socket.remoteAddress;
}

// ✅ Allow only specific domain
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin || origin.startsWith(allowedOrigin)) return next();
  res.status(403).send("Access Denied: Only your domain is allowed.");
});

// ✅ Enable CORS
app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET"],
  })
);

// ✅ Token generator endpoint (optional)
app.get("/token/:channel", (req, res) => {
  const { channel } = req.params;
  if (!channels[channel]) return res.status(404).send("Channel not found");
  const ip = getClientIp(req);
  const token = generateToken(channel, ip);
  res.json({ token, expiresIn: 300 });
});

// ✅ Live stream manifest proxy
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const ch = channels[channel];
  if (!ch) return res.status(404).send("Channel not found");

  const userIP = getClientIp(req);

  try {
    const response = await axios.get(ch.manifest, { responseType: "text" });
    const lines = response.data.split("\n");
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const newLines = lines.map((line) => {
      if (line.startsWith("#") || line.trim() === "") return line;

      const token = generateToken(channel, userIP);
      const encoded = encodeURIComponent(line.trim());
      return `${baseUrl}/segment/${channel}?file=${encoded}&token=${token}`;
    });

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(newLines.join("\n"));
  } catch (err) {
    console.error("Manifest error:", err.message);
    res.status(500).send("Error fetching manifest.");
  }
});

// ✅ Segment proxy
app.get("/segment/:channel", async (req, res) => {
  const { channel } = req.params;
  const { file, token } = req.query;

  if (!channels[channel]) return res.status(404).send("Channel not found");
  if (!file || !token) return res.status(400).send("Missing file or token");

  const tokenInfo = activeTokens.get(token);
  const ip = getClientIp(req);

  if (!tokenInfo || tokenInfo.expires < Date.now() || tokenInfo.ip !== ip) {
    return res.status(403).send("Token expired, invalid, or IP mismatch");
  }

  // Resolve URL (absolute/relative)
  let target;
  try {
    const decoded = decodeURIComponent(file);
    if (/^https?:\/\//i.test(decoded)) target = decoded;
    else target = new URL(decoded, channels[channel].base).href;
  } catch (err) {
    return res.status(500).send("Invalid file path");
  }

  try {
    const upstream = await axios({
      url: target,
      method: "GET",
      responseType: "stream",
      timeout: 20000,
      headers: {
        Referer: channels[channel].manifest,
        "User-Agent": "RyvoxTB-Proxy/1.0",
      },
    });

    res.setHeader("Content-Type", upstream.headers["content-type"] || "video/mp2t");
    upstream.data.pipe(res);
  } catch (err) {
    console.error("Segment error:", err.message);
    res.status(502).send("Segment fetch error");
  }
});

// ✅ Home route
app.get("/", (req, res) => {
  res.send(`
    <h2>🎥 RyvoxTB Secure Live TV Server</h2>
    <p>Allowed Origin: ${allowedOrigin}</p>
    <p>Channels:</p>
    <ul>
      <li><a href="/live/tsports" target="_blank">T-Sports</a></li>
      <li><a href="/live/boishakhi" target="_blank">Boishakhi TV</a></li>
      <li><a href="/live/bangla_tv" target="_blank">Bangla TV</a></li>
      <li><a href="/live/anandatv" target="_blank">Ananda TV</a></li>
    </ul>
    <p>Tokens are IP-bound and valid for 5 minutes.</p>
  `);
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
