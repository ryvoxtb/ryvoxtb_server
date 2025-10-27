import express from "express";
import axios from "axios";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();
const PORT = process.env.PORT || 3000;

// T-Sports stream URLs
const TARGET_MANIFEST_URL = "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8";
const TARGET_BASE_URL = "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/";

// Secret key for JWT
const SECRET_KEY = "YOUR_SECRET_KEY"; // change this to something secret

// Allowed domain
const ALLOWED_ORIGIN = "https://ryvoxtb.github.io/web";

// CORS setup
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith(ALLOWED_ORIGIN)) callback(null, true);
    else callback(new Error("❌ Access denied: Unauthorized domain"));
  }
}));

// 🔹 Generate token API
app.get("/generate-token", (req, res) => {
  // Token valid for 60 seconds
  const token = jwt.sign({ access: "video" }, SECRET_KEY, { expiresIn: "60s" });
  res.json({ token });
});

// 🔹 Middleware to validate token
const verifyToken = (req, res, next) => {
  const token = req.query.token;
  if (!token) return res.status(403).send("❌ Access Forbidden: Token missing");

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).send("❌ Token expired or invalid");
    next();
  });
};

// 🔹 Video manifest route
app.get("/live/tsports", verifyToken, async (req, res) => {
  try {
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
    res.status(500).send("Manifest load error");
  }
});

// 🔹 Video segment proxy
app.get("/live/tsports/segment", verifyToken, async (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).send("Missing file parameter");

  try {
    const response = await axios({
      url: TARGET_BASE_URL + file,
      method: "GET",
      responseType: "stream"
    });

    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Content-Type", "video/mp2t");
    response.data.pipe(res);
  } catch (err) {
    console.error("❌ Segment Error:", err.message);
    res.status(500).send("Segment load error");
  }
});

app.get("/", (req, res) => {
  res.send("✅ Secure T-Sports Proxy Server with 10s Token is running!");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
