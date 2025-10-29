import express from "express";
import axios from "axios";
import cors from "cors";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Only your domain is allowed
const allowedOrigin = "http://ryvox.xo.je";

// ✅ Temporary tokens storage (in-memory)
const activeTokens = new Map();

// 🔐 Generate a new short-lived token (IP-bound)
function generateToken(channel, ip) {
  const token = crypto.randomBytes(8).toString("hex");
  const expires = Date.now() + 120 * 1000; // 2 minutes
  activeTokens.set(token, { channel, expires, ip });
  return token;
}

// 🧹 Cleanup expired tokens every 30s
setInterval(() => {
  const now = Date.now();
  for (const [token, info] of activeTokens) {
    if (info.expires < now) activeTokens.delete(token);
  }
}, 30000);

// ✅ Channel sources
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
  anandatv: { // ✅ নতুন যুক্ত চ্যানেল
    manifest: "https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/playlist.m3u8",
    base: "https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/"
  }
};

// ✅ Domain Access Protection
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || "";
  if (origin.startsWith(allowedOrigin)) {
    next();
  } else {
    res.status(403).send("Access denied: Only allowed from ryvox.xo.je");
  }
});

// ✅ CORS setup
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET"],
}));

// ✅ Route: Generate token
app.get("/token/:channel", (req, res) => {
  const { channel } = req.params;
  const userIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  if (!channels[channel]) return res.status(404).send("Channel not found");

  const token = generateToken(channel, userIP);
  res.json({ token, expiresIn: 120 });
});

// ✅ Route: Stream manifest (with token)
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const info = channels[channel];
  const userIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!info) return res.status(404).send("Channel not found");

  try {
    const response = await axios.get(info.manifest);
    let manifestContent = response.data;

    // Proxy segment paths through /segment
    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, seg) => {
        const token = generateToken(channel, userIP);
        return `${extinf}/segment/${channel}?file=${encodeURIComponent(seg)}&token=${token}`;
      }
    );

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(manifestContent);
  } catch (err) {
    console.error("Error loading manifest:", err.message);
    res.status(500).send("Error loading manifest.");
  }
});

// ✅ Route: Segment proxy (token + IP validation)
app.get("/segment/:channel", async (req, res) => {
  const { channel } = req.params;
  const file = req.query.file;
  const token = req.query.token;
  const userIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!channels[channel]) return res.status(404).send("Channel not found");
  if (!file || !token) return res.status(400).send("Missing file or token");

  const info = activeTokens.get(token);
  if (!info || info.channel !== channel || info.expires < Date.now() || info.ip !== userIP) {
    return res.status(403).send("Token expired, invalid, or IP mismatch");
  }

  try {
    const response = await axios({
      method: "get",
      url: channels[channel].base + file,
      responseType: "stream"
    });

    res.setHeader("Content-Type", "video/mp2t");
    response.data.pipe(res);
  } catch (err) {
    console.error("Segment error:", err.message);
    res.status(500).send("Segment error.");
  }
});

// ✅ Root page (for info)
app.get("/", (req, res) => {
  res.send(`
    <h2>🎥 RyvoxTB Secure Live TV Server</h2>
    <p>Allowed domain: ${allowedOrigin}</p>
    <p>Secure IP-bound token system (2 min)</p>
    <ul>
      <li><a href="/live/tsports" target="_blank">T-Sports</a></li>
      <li><a href="/live/boishakhi" target="_blank">Boishakhi TV</a></li>
      <li><a href="/live/bangla_tv" target="_blank">Bangla TV</a></li>
      <li><a href="/live/anandatv" target="_blank">Ananda TV</a></li>
    </ul>
  `);
});

// ✅ Start server
app.listen(PORT, () => console.log(`✅ Secure server running on port ${PORT}`));
