import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Allow only your GitHub Pages site (with flexibility)
app.use((req, res, next) => {
  const allowedOrigin = "https://ryvoxtb.github.io";
  const origin = req.headers.origin || req.headers.referer || "";

  // Debug log for Render console
  console.log("🔍 Request Origin/Referer:", origin || "None");

  // Allow if:
  // 1️⃣ Origin বা Referer GitHub Pages এর
  // 2️⃣ বা কোনো Origin নেই (যেমন video tag বা hls.js থেকে আসে)
  if (!origin || origin.startsWith(allowedOrigin)) {
    next();
  } else {
    console.log("❌ Access denied for origin:", origin);
    res.status(403).send("Access denied: Only allowed from your website.");
  }
});

// ✅ Dynamic CORS setup
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigin = "https://ryvoxtb.github.io";
    if (!origin || origin.startsWith(allowedOrigin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET"],
}));

// ✅ Channel list
const channels = {
  tsports: {
    manifest: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8",
    base: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/"
  },
  boishakhi: {
    manifest: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8",
    base: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/"
  }
};

// ✅ Dynamic manifest route
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const info = channels[channel];

  if (!info) return res.status(404).send("Channel not found.");

  try {
    console.log(`📡 Loading manifest for: ${channel}`);
    const response = await axios.get(info.manifest);
    let manifestContent = response.data;

    // Rewrite segment paths to proxy through this server
    const proxySegmentBase = `/segment/${channel}?file=`;

    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, seg) =>
        `${extinf}${proxySegmentBase}${encodeURIComponent(seg)}`
    );

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(manifestContent);
  } catch (err) {
    console.error("❌ Error loading manifest:", err.message);
    res.status(500).send("Error loading manifest.");
  }
});

// ✅ Segment proxy route
app.get("/segment/:channel", async (req, res) => {
  const { channel } = req.params;
  const info = channels[channel];

  if (!info) return res.status(404).send("Channel not found.");

  const file = req.query.file;
  if (!file) return res.status(400).send("Missing file parameter.");

  try {
    console.log(`🎞️ Streaming segment for ${channel}: ${file}`);
    const response = await axios({
      method: "get",
      url: info.base + file,
      responseType: "stream"
    });

    res.setHeader("Content-Type", "video/mp2t");
    response.data.pipe(res);
  } catch (err) {
    console.error("❌ Segment load error:", err.message);
    res.status(500).send("Segment load error.");
  }
});

// ✅ Root page
app.get("/", (req, res) => {
  res.send(`
    <h2>🎥 RyvoxTB Secure Live TV Server</h2>
    <p>Available channels:</p>
    <ul>
      <li><a href="/live/tsports" target="_blank">T-Sports</a></li>
      <li><a href="/live/boishakhi" target="_blank">Boishakhi TV</a></li>
    </ul>
    <p>Access allowed only from: <strong>https://ryvoxtb.github.io</strong></p>
  `);
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
