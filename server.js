const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 TV Channel List
const CHANNELS = {
  boishakhi: {
    manifest: 'https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8',
    base: 'https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/',
  },
  tsports: {
    manifest: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8',
    base: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/',
  },
  btv: {
    manifest: 'https://www.btvlive.gov.bd/live/37f2df30-3edf-42f3-a2ee-6185002c841c/BD/355ba051-9a60-48aa-adcf-5a6c64da8c5c/index.m3u8',
    base: 'https://www.btvlive.gov.bd/live/37f2df30-3edf-42f3-a2ee-6185002c841c/BD/355ba051-9a60-48aa-adcf-5a6c64da8c5c/',
  },
  anandatv: {
    manifest: 'https://app24.jagobd.com.bd/.../anandatv.stream/playlist.m3u8',
    base: 'https://app24.jagobd.com.bd/.../anandatv.stream/',
  },
  durontotv: {
    manifest: 'https://tvsen4.aynaott.com/durontotv/tracks-v1a1/mono.ts.m3u8',
    base: 'https://tvsen4.aynaott.com/durontotv/tracks-v1a1/',
  },
  enter10bangla: {
    manifest: 'https://live-bangla.akamaized.net/liveabr/playlist.m3u8',
    base: 'https://live-bangla.akamaized.net/liveabr/',
  },
  atnbangla: {
    manifest: 'https://cd198.anystream.uk:8082/hls/atbla85tv/index.m3u8',
    base: 'https://cd198.anystream.uk:8082/hls/atbla85tv/',
  },
  channel24: {
    manifest: 'https://ch24cdn.ncare.live/channel24/ch24office/index.m3u8',
    base: 'https://ch24cdn.ncare.live/channel24/ch24office/',
  },
  zeebangla: {
    manifest: 'http://eb4b8dcf.kablakaka.ru/iptv/WCKQ3HC3UMGVLG/6636/index.m3u8',
    base: 'http://eb4b8dcf.kablakaka.ru/iptv/WCKQ3HC3UMGVLG/6636/',
  },
  // এখানে আরও চ্যানেল যোগ করতে পারো
};

// 🔧 Global Middleware
app.use(cors());
app.disable('x-powered-by');
app.set('etag', false);

// 🔹 Root Route - Channel List
app.get('/', (req, res) => {
  const list = Object.keys(CHANNELS)
    .map(ch => `<li><a href="/live/${ch}" target="_blank">${ch.toUpperCase()} ▶️</a></li>`)
    .join('');
  res.send(`<h2>📺 Smart HLS Proxy Server</h2><ul>${list}</ul>`);
});

// 🔹 Manifest Handler
app.get('/live/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];
  if (!ch) return res.status(404).send('❌ Channel not found');

  try {
    const { data: manifest } = await axios.get(ch.manifest, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    // ✅ Rewrite all segment & nested playlist URLs
    const rewritten = manifest.replace(
      /(#EXT[^#\n]*\n)([^#\n]+\.(m3u8|ts|aac|mp4|m4s))/g,
      (match, info, path) => {
        // যদি absolute URL হয়, untouched রাখো
        if (/^https?:\/\//i.test(path)) return info + path.trim();
        // না হলে proxy segment link বানাও
        return info + `/segment/${channel}?file=${encodeURIComponent(path.trim())}`;
      }
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(rewritten);
  } catch (err) {
    console.error(`⚠️ Manifest Error [${channel}]:`, err.message);
    res.status(500).send('Failed to load manifest');
  }
});

// 🔹 Segment Handler
app.get('/segment/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];
  const file = req.query.file;

  if (!ch) return res.status(404).send('Channel not found');
  if (!file) return res.status(400).send('File parameter missing');

  const segmentUrl = file.startsWith('http')
    ? file
    : ch.base + decodeURIComponent(file);

  try {
    const response = await axios({
      method: 'GET',
      url: segmentUrl,
      responseType: 'stream',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*',
        'Referer': ch.base,
        'Origin': 'https://yourwebsite.com', // তোমার সাইটের নাম দাও
        'Accept-Encoding': 'identity',
      },
    });

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=10');
    res.setHeader('Access-Control-Allow-Origin', '*');

    response.data.pipe(res);
  } catch (err) {
    console.error(`❌ Segment Error [${channel}]:`, err.message);
    res.status(500).end();
  }
});

// 🚀 Start Server
app.listen(PORT, () => {
  console.log(`✅ Smart HLS Server running at: http://localhost:${PORT}`);
});
