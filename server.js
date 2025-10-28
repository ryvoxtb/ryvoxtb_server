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

// 🔐 Generate a new short-lived token
function generateToken(channel) {
  const token = crypto.randomBytes(8).toString("hex");
  const expires = Date.now() + 60 * 6000; // 60 seconds
  activeTokens.set(token, { channel, expires });
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
  bangla_tv: { // ✅ নতুন যুক্ত চ্যানেল
    manifest: "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/1702-audio_113322_eng=113200-video=442000.m3u8",
    base: "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/"
  }
};

// ✅ Domain Access Protection
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || "";
  if (origin.startsWith(allowedOrigin)) {
    next();
  } else {
    res.status(403).send("Access denied: Only allowed from askview.free.nf.");
  }
});

// ✅ CORS setup
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET"],
}));

// ✅ Route: Generate token (used by your site)
app.get("/token/:channel", (req, res) => {
  const { channel } = req.params;
  if (!channels[channel]) return res.status(404).send("Channel not found");

  const token = generateToken(channel);
  res.json({ token, expiresIn: 10 });
});

// ✅ Route: Stream manifest (with token)
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const info = channels[channel];

  if (!info) return res.status(404).send("Channel not found");

  try {
    const response = await axios.get(info.manifest);
    let manifestContent = response.data;

    // Proxy segment paths through /segment
    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, seg) => {
        const token = generateToken(channel);
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

// ✅ Route: Segment proxy (with token validation)
app.get("/segment/:channel", async (req, res) => {
  const { channel } = req.params;
  const file = req.query.file;
  const token = req.query.token;

  if (!channels[channel]) return res.status(404).send("Channel not found");
  if (!file || !token) return res.status(400).send("Missing file or token");

  const info = activeTokens.get(token);
  if (!info || info.channel !== channel || info.expires < Date.now()) {
    return res.status(403).send("Token expired or invalid");
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

// ✅ Root page
app.get("/", (req, res) => {
  res.send(`
    <h2>🎥 RyvoxTB Secure Live TV Server</h2>
    <p>Allowed domain: ${allowedOrigin}</p>
    <p>Channels:</p>
    <ul>
      <li><a href="/live/tsports" target="_blank">T-Sports</a></li>
      <li><a href="/live/boishakhi" target="_blank">Boishakhi TV</a></li>
      <li><a href="/live/bangla_tv" target="_blank">Bangla TV</a></li>
    </ul>
  `);
});

// ✅ Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
