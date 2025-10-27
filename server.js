import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// 🔗 T-Sports stream info
const TARGET_MANIFEST_URL = "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8";
const TARGET_BASE_URL = "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/";

// ✅ নতুন ALLOWED_ORIGIN শুধুমাত্র তোমার নতুন GitHub Pages
const ALLOWED_ORIGIN = "https://ryvoxtb.github.io/web";

// ⚙️ কাস্টম CORS সেটআপ
app.use(
  cors({
    origin: (origin, callback) => {
      // GitHub Page ছাড়া অন্য কোনো জায়গা থেকে request এলে ব্লক
      if (!origin || origin.startsWith(ALLOWED_ORIGIN)) {
        callback(null, true);
      } else {
        callback(new Error("❌ Access denied: Unauthorized domain"));
      }
    },
  })
);

// ✅ মেইন লাইভ রুট
app.get("/live/tsports", async (req, res) => {
  try {
    // নিরাপত্তা: Referrer header চেক
    const ref = req.get("referer") || "";
    if (!ref.startsWith(`${ALLOWED_ORIGIN}/t_sports.html`)) {
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

// ✅ সেগমেন্ট ফাইল প্রক্সি
app.get("/live/tsports/segment", async (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).send("Missing file parameter");

  const ref = req.get("referer") || "";
  if (!ref.startsWith(`${ALLOWED_ORIGIN}/t_sports.html`)) {
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

// ✅ Root route
app.get("/", (req, res) => {
  res.send("✅ Secure T-Sports Proxy Server is running successfully!");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
