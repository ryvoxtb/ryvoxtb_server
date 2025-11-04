const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.disable('x-powered-by');
app.set('etag', false);

// 🧩 Channel list
const CHANNELS = {
  tsports: {
    manifest: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.m3u8',
  },
  durontotv: {
    manifest: 'https://tvsen4.aynaott.com/durontotv/tracks-v1a1/mono.m3u8',
  },
  boishakhi: {
    manifest: 'https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8',
  },
  channel24: {
    manifest: 'https://ch24cdn.ncare.live/channel24/ch24office/index.m3u8',
  },
  atnbangla: {
    manifest: 'https://cd198.anystream.uk:8082/hls/atbla85tv/index.m3u8',
  },
  enter10bangla: {
    manifest: 'https://live-bangla.akamaized.net/liveabr/playlist.m3u8',
  },
  zeebangla: {
    manifest: 'http://eb4b8dcf.kablakaka.ru/iptv/WCKQ3HC3UMGVLG/6636/index.m3u8',
  },
};

// 🏠 Root
app.get('/', (req, res) => {
  const list = Object.keys(CHANNELS)
    .map(ch => `<li><a href="/live/${ch}" target="_blank">${ch.toUpperCase()} ▶️</a></li>`)
    .join('');
  res.send(`<h2>📺 Smart HLS Proxy Server (Render Edition)</h2><ul>${list}</ul>`);
});

// 🎬 Manifest route
app.get('/live/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];
  if (!ch) return res.status(404).send('Channel not found.');

  try {
    const { data: manifest } = await axios.get(ch.manifest, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': ch.manifest,
        'Origin': 'https://yourwebsite.com',
        'Accept': '*/*',
      },
    });

    // Rewrite all segment and nested m3u8 URLs
    const rewritten = manifest.replace(
      /(#EXT[^#\n]*\n)([^#\n]+\.(m3u8|ts|aac|mp4|m4s))/g,
      (match, info, path) => {
        const absolute = new URL(path, ch.manifest).href;
        return info + `/segment/${channel}?file=${encodeURIComponent(absolute)}`;
      }
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-store');
    res.send(rewritten);
  } catch (err) {
    console.error(`❌ Manifest Error [${channel}]: ${err.message}`);
    res.status(500).send('Manifest fetch failed.');
  }
});

// 🎥 Segment route
app.get('/segment/:channel', async (req, res) => {
  const fileUrl = req.query.file;
  if (!fileUrl) return res.status(400).send('Missing file param.');

  try {
    const response = await axios({
      method: 'GET',
      url: decodeURIComponent(fileUrl),
      responseType: 'stream',
      timeout: 15000, // একটু বেশি timeout
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': fileUrl,
        'Origin': 'https://yourwebsite.com',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
      },
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=10');
    res.setHeader('Content-Type', 'video/mp2t');

    response.data.pipe(res);
  } catch (err) {
    console.error(`❌ Segment Error: ${err.message}`);
    res.status(500).end();
  }
});

// 🟢 Keepalive route (Render free dyno sleep ঠেকাতে)
app.get('/ping', (req, res) => res.send('pong'));

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ Render Proxy Live: http://localhost:${PORT}`);
});
