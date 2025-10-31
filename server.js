const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ চ্যানেলগুলোর তালিকা
const CHANNELS = {
  tsports: {
    manifest: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8',
    base: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/',
  },
  Sonyaath: {
    manifest: 'https://live20.bozztv.com/giatvplayout7/giatv-209611/tracks-v1a1/mono.ts.m3u8',
    base: 'https://live20.bozztv.com/giatvplayout7/giatv-209611/tracks-v1a1/',
  },
  etn: {
    manifest: 'https://ekusheyserver.com/hls-live/livepkgr/_definst_/liveevent/livestream2.m3u8',
    base: 'https://ekusheyserver.com/hls-live/livepkgr/_definst_/liveevent/',
  },
  btvhd: {
    manifest: 'https://www.btvlive.gov.bd/live/37f2df30-3edf-42f3-a2ee-6185002c841c/BD/355ba051-9a60-48aa-adcf-5a6c64da8c5c/index.m3u8',
    base: 'https://www.btvlive.gov.bd/live/37f2df30-3edf-42f3-a2ee-6185002c841c/BD/355ba051-9a60-48aa-adcf-5a6c64da8c5c/',
  },
  boishakhi: {
    manifest: 'https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8',
    base: 'https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/',
  },
  snggit: {
    manifest: 'https://cdn-4.pishow.tv/live/1143/master.m3u8',
    base: 'https://cdn-4.pishow.tv/live/1143/',
  },
  sunbangla: {
    manifest: 'https://smart.bengaldigital.live/sun-bangla-paid/tracks-v1a1/mono.m3u8',
    base: 'https://smart.bengaldigital.live/sun-bangla-paid/tracks-v1a1/',
  },
  sunbangla: {
    manifest: 'https://live-bangla.akamaized.net/liveabr/playlist.m3u8',
    base: 'https://live-bangla.akamaized.net/liveabr/',
  },
};

// ⚙️ Global Middleware
app.use(cors());
app.set('etag', false); // ETag disable (reduce overhead)
app.disable('x-powered-by');

// 🏠 Root route
app.get('/', (req, res) => {
  const list = Object.keys(CHANNELS)
    .map(
      (key) =>
        `<li><a href="/live/${key}" target="_blank">${key.toUpperCase()} Live</a></li>`
    )
    .join('');
  res.send(`
    <h2>✅ Your Multi-Channel HLS Proxy Server is Running!</h2>
    <p>Available Channels:</p>
    <ul>${list}</ul>
  `);
});

// 🎯 Main Proxy Route (for each channel)
app.get('/live/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];
  if (!ch) return res.status(404).send('Channel not found.');

  try {
    const response = await axios.get(ch.manifest, { timeout: 5000 });
    let manifestContent = response.data;

    // সেগমেন্ট পাথ রিরাইট করা
    const PROXY_SEGMENT_BASE = `/segment/${channel}?file=`;
    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, path) => extinf + PROXY_SEGMENT_BASE + encodeURIComponent(path)
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-store');
    res.send(manifestContent);
  } catch (err) {
    console.error(`❌ [${channel}] manifest error:`, err.message);
    res.status(500).send('Error loading manifest.');
  }
});

// 🎬 Segment proxy route
app.get('/segment/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];
  if (!ch) return res.status(404).send('Channel not found.');

  const file = req.query.file;
  if (!file) return res.status(400).send('Segment file missing.');

  const url = ch.base + decodeURIComponent(file);
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 8000,
    });

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=5');
    response.data.pipe(res);
  } catch (err) {
    console.error(`❌ Segment error [${channel}]`, err.message);
    res.status(500).end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}/`);
});
