import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Blogger-only access
app.use((req, res, next) => {
  const allowedOrigin = "https://ryvoxtb.github.io/ryvoxtb/index.html";
  const origin = req.headers.origin || req.headers.referer || "";

  if (origin && origin.startsWith(allowedOrigin)) {
    next();
  } else {
    res.status(403).send("Access denied: Only allowed from your Blogger site.");
  }
});

// ✅ CORS setup
app.use(cors({
  origin: "https://ryvoxtb.github.io/ryvoxtb/index.html",
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
    const response = await axios.get(info.manifest);
    let manifestContent = response.data;

    // Rewrite segment paths to proxy
    const proxySegmentBase = `/segment/${channel}?file=`;

    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, seg) => `${extinf}${proxySegmentBase}${encodeURIComponent(seg)}`
    );

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(manifestContent);
  } catch (err) {
    console.error("Error loading manifest:", err.message);
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
    const response = await axios({
      method: "get",
      url: info.base + file,
      responseType: "stream"
    });

    res.setHeader("Content-Type", "video/mp2t");
    response.data.pipe(res);
  } catch (err) {
    console.error("Segment load error:", err.message);
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
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
