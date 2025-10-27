import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();

// Render নিজের PORT সেট করে, তাই নিচেরভাবে ব্যবহার করো
const PORT = process.env.PORT || 3000;

// 🔗 লক্ষ্য (target) স্ট্রিম লিংক
const TARGET_MANIFEST_URL = "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8";
const TARGET_BASE_URL = "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/";

// ✅ CORS enable করা হলো
app.use(cors());

// 🎯 মেইন M3U8 ফাইলের প্রক্সি রুট
app.get("/live/tsports", async (req, res) => {
  try {
    const response = await axios.get(TARGET_MANIFEST_URL);
    let manifest = response.data;

    const PROXY_BASE = "/live/tsports/segment?file=";

    // সব TS বা M4S ফাইল replace করা
    manifest = manifest.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, path) => extinf + PROXY_BASE + encodeURIComponent(path)
    );

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(manifest);
  } catch (err) {
    console.error("❌ Manifest Error:", err.message);
    res.status(500).send("Manifest লোড করতে সমস্যা হয়েছে।");
  }
});

// 🎯 সেগমেন্ট ফাইল প্রক্সি রুট
app.get("/live/tsports/segment", async (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).send("Missing file parameter");

  const url = TARGET_BASE_URL + file;

  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "video/mp2t");
    response.data.pipe(res);
  } catch (err) {
    console.error("❌ Segment Error:", err.message);
    res.status(500).send("Segment লোড করতে সমস্যা হয়েছে।");
  }
});

app.get("/", (req, res) => {
  res.send("✅ Live TV Proxy Server is running successfully!");
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
