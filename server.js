import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

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

// --- CORS এবং Origin Validation ---

// ✅ Step 1: Request Origin Validation (GitHub Pages)
// এই মিডলওয়্যারটি নিশ্চিত করে যে শুধুমাত্র আপনার GitHub Pages থেকে আসা ট্র্যাফিক অনুমোদিত।
app.use((req, res, next) => {
  const allowedOrigin = "https://ryvoxtb.github.io";
  // Origin বা Referer হেডার চেক করা হচ্ছে
  const origin = req.headers.origin || req.headers.referer || "";

  // Debug Log
  console.log("🔍 Request Origin/Referer:", origin || "None");

  // অনুমোদন দেওয়া হচ্ছে যদি:
  // 1. কোনো Origin/Referer হেডার না থাকে (যা HLS সেগমেন্ট রিকোয়েস্টের জন্য স্বাভাবিক)
  // 2. অথবা Origin/Referer আপনার GitHub Pages এর URL দিয়ে শুরু হয়
  if (!origin || origin.startsWith(allowedOrigin)) {
    next();
  } else {
    console.log("❌ Access denied for origin:", origin);
    res.status(403).send("Access denied: Only allowed from your website.");
  }
});

// ✅ Step 2: Dynamic CORS setup for Browser
// এটি ব্রাউজারের জন্য CORS হেডার সেট করে।
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

// --- Proxy Routes ---

// ✅ Manifest proxy route: .m3u8 ফাইল লোড করার জন্য
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const info = channels[channel];

  if (!info) return res.status(404).send("Channel not found.");

  try {
    console.log(`📜 Loading manifest for ${channel}`);
    const manifestResponse = await axios.get(info.manifest);
    let manifestContent = manifestResponse.data;

    // HLS Manifest URL rewrite
    const proxySegmentBase = `/segment/${channel}?file=`;
    
    // সেগমেন্ট URL গুলিকে আপনার প্রক্সি রুটের দিকে নির্দেশ করার জন্য প্রতিস্থাপন করা হচ্ছে
    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, seg) => `${extinf}${proxySegmentBase}${encodeURIComponent(seg)}`
    );

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(manifestContent);
  } catch (err) {
    console.error("❌ Error loading manifest:", err.message);
    res.status(500).send("Error loading manifest.");
  }
});

// ✅ Segment proxy route: .ts/m4s ফাইল লোড করার জন্য
// 💡 এখানে সমস্যা সমাধান করা হয়েছে: User-Agent এবং Referer হেডার যোগ করা হয়েছে।
app.get("/segment/:channel", async (req, res) => {
  const { channel } = req.params;
  const info = channels[channel];

  if (!info) return res.status(404).send("Channel not found.");

  const file = req.query.file;
  if (!file) return res.status(400).send("Missing file parameter.");

  try {
    console.log(`🎞️ Streaming segment for ${channel}: ${file}`);
    
    // 💡 Upstream CDN Access Control সমস্যার সমাধান: হেডার যোগ
    const headers = {
      // এটি একটি সাধারণ Chrome ব্রাউজারের User-Agent
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", 
      // চ্যানেলটির মূল Base URL-কে Referer হিসেবে পাঠান 
      "Referer": info.base 
    };
    
    const response = await axios({
      method: "get",
      url: info.base + file,
      responseType: "stream",
      headers: headers // <-- নতুন হেডার এখানে যোগ করা হলো
    });

    res.setHeader("Content-Type", "video/mp2t");
    response.data.pipe(res);
  } catch (err) {
    console.error("❌ Segment load error (Upstream Server):", err.message);
    res.status(500).send("Segment load error. Check server logs for CDN error.");
  }
});

// ✅ Root page (ঐচ্ছিক)
app.get("/", (req, res) => {
  res.send(`
    <h2>🎥 RyvoxTB Secure Live TV Server</h2>
    <p>Server is running and secured for https://ryvoxtb.github.io</p>
  `);
});

// ✅ Server start
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
