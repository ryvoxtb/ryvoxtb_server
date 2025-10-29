import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ শুধুমাত্র এই ডোমেইন থেকে ভিডিও চলবে
const allowedOrigin = "http://ryvox.xo.je";

// ✅ অনুমোদিত ডোমেইন চেক
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || "";
  if (origin.startsWith(allowedOrigin)) {
    next();
  } else {
    res.status(403).send("Access Denied: This service is restricted to ryvox.xo.je");
  }
});

// ✅ CORS সেটআপ
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET"],
}));

// ✅ তোমার চ্যানেল লিস্ট
const channels = {
  tsports: {
    manifest: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8"
  },
  boishakhi: {
    manifest: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8"
  },
  bangla_tv: {
    manifest: "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/1702-audio_113322_eng=113200-video=442000.m3u8"
  },
  anandatv: {
    manifest: "https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/playlist.m3u8"
  }
};

// ✅ Channel stream proxy
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const info = channels[channel];
  if (!info) return res.status(404).send("Channel not found");

  try {
    const response = await axios.get(info.manifest);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(response.data);
  } catch (err) {
    console.error("Error fetching manifest:", err.message);
    res.status(500).send("Stream load error.");
  }
});

// ✅ Root info
app.get("/", (req, res) => {
  res.send(`
    <h2>🎥 RyvoxTB Lightweight Secure TV Server</h2>
    <p>Only allowed from: ${allowedOrigin}</p>
    <ul>
      <li><a href="/live/tsports" target="_blank">T-Sports</a></li>
      <li><a href="/live/boishakhi" target="_blank">Boishakhi TV</a></li>
      <li><a href="/live/bangla_tv" target="_blank">Bangla TV</a></li>
      <li><a href="/live/anandatv" target="_blank">Ananda TV</a></li>
    </ul>
  `);
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
