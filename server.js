import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

const TARGET_MANIFEST_URL = "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8";
const TARGET_BASE_URL = "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/";

// শুধু তোমার GitHub Pages ডোমেইন
const ALLOWED_ORIGIN = "https://ryvoxtb.github.io/web";

// CORS setup
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.startsWith(ALLOWED_ORIGIN)) {
        callback(null, true);
      } else {
        callback(new Error("❌ Access denied: Unauthorized domain"));
      }
    },
  })
);

// Main live route
app.get("/live/tsports", async (req, res) => {
  try {
    const ref = req.get("referer") || "";
    // 🔹 শুধুমাত্র domain check
    if (!ref.includes(ALLOWED_ORIGIN)) {
      return res.status(403).send("❌ Access Forbidden: Not allowed from this domain");
    }

    const response = await axios.get(TARGET_MANIFEST_URL);
    let manifest = response.data;

    const PROXY_BASE = "/live/tsports/segment?file=";

    manifest = manifest.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, path) => extinf + PROXY_BASE + encodeURIComponent(path)
    );

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.send(manifest);
  } catch (err) {
    console.error("❌ Manifest Error:", err.message);
    res.status(500).send("Manifest লোড করতে সমস্যা হয়েছে।");
  }
});

// Segment proxy
app.get("/live/tsports/segment", async (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).send("Missing file parameter");

  const ref = req.get("referer") || "";
  if (!ref.includes(ALLOWED_ORIGIN)) {
    return res.status(403).send("❌ Access Forbidden: Not allowed from this domain");
  }

  const url = TARGET_BASE_URL + file;

  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Content-Type", "video/mp2t");
    response.data.pipe(res);
  } catch (err) {
    console.error("❌ Segment Error:", err.message);
    res.status(500).send("Segment লোড করতে সমস্যা হয়েছে।");
  }
});

app.get("/", (req, res) => {
  res.send("✅ Secure T-Sports Proxy Server is running successfully!");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
