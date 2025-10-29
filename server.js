import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ শুধুমাত্র তোমার ডোমেইন
const allowedOrigin = "http://ryvox.xo.je";

// ✅ অনুমোদিত ডোমেইন চেক
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || "";
  if (origin.startsWith(allowedOrigin)) {
    next();
  } else {
    res.status(403).send("Access Denied: Only allowed from ryvox.xo.je");
  }
});

app.use(cors({ origin: allowedOrigin, methods: ["GET"] }));

// ✅ চ্যানেল তালিকা
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
  anandatv: {
    manifest: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    base: "https://bitdash-a.akamaihd.net/content/sintel/hls/"
  },
  sangeet: {
    manifest: "https://cdn-4.pishow.tv/live/1143/master.m3u8",
    base: "https://cdn-4.pishow.tv/live/1143/"
  },
  sun: {
    manifest: "https://smart.bengaldigital.live/sun-bangla-paid/tracks-v1a1/mono.m3u8",
    base: "https://smart.bengaldigital.live/sun-bangla-paid/tracks-v1a1/"
  },
  anandatv: {
    manifest: "https://tvsen4.aynaott.com/durontotv/tracks-v1a1/mono.ts.m3u8",
    base: "https://tvsen4.aynaott.com/durontotv/tracks-v1a1/"
  }
};

// ✅ Manifest proxy route
app.get("/live/:channel", async (req, res) => {
  const { channel } = req.params;
  const info = channels[channel];
  if (!info) return res.status(404).send("Channel not found");

  try {
    const response = await axios.get(info.manifest, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": allowedOrigin
      }
    });

    let manifest = response.data;
    // Segment path পরিবর্তন করে proxy path বসাও
    manifest = manifest.replace(
      /^(?!#)(.*\.(ts|m4s|aac|mp4))/gm,
      (segment) => `/segment/${channel}?file=${encodeURIComponent(segment)}`
    );

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(manifest);
  } catch (err) {
    console.error("Manifest error:", err.message);
    res.status(500).send("Manifest load error");
  }
});

// ✅ Segment proxy route
app.get("/segment/:channel", async (req, res) => {
  const { channel } = req.params;
  const { file } = req.query;
  const info = channels[channel];

  if (!info || !file) return res.status(400).send("Invalid request");

  try {
    const response = await axios({
      url: info.base + file,
      method: "GET",
      responseType: "stream",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": allowedOrigin
      }
    });

    res.setHeader("Content-Type", "video/mp2t");
    response.data.pipe(res);
  } catch (err) {
    console.error("Segment error:", err.message);
    res.status(500).send("Segment load error");
  }
});

// ✅ Root info
app.get("/", (req, res) => {
  res.send(`
    <h2>🎥 RyvoxTB Secure & Fast Proxy Server</h2>
    <p>Allowed domain: ${allowedOrigin}</p>
    <ul>
      <li><a href="/live/tsports" target="_blank">T-Sports</a></li>
      <li><a href="/live/boishakhi" target="_blank">Boishakhi TV</a></li>
      <li><a href="/live/bangla_tv" target="_blank">Bangla TV</a></li>
      <li><a href="/live/anandatv" target="_blank">Ananda TV</a></li>
    </ul>
  `);
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
