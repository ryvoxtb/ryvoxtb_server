const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.disable('x-powered-by');
app.set('etag', false);

// 📺 Channel list
const CHANNELS = {
  tsports: {
    manifest: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.m3u8',
  },
  durontotv: {
    manifest: 'https://tvsen4.aynaott.com/durontotv/tracks-v1a1/mono.m3u8',
  },
  channel24: {
    manifest: 'https://ch24cdn.ncare.live/channel24/ch24office/index.m3u8',
  },
  atnbangla: {
    manifest: 'https://cd198.anystream.uk:8082/hls/atbla85tv/index.m3u8',
  },
  boishakhi: {
    manifest: 'https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8',
  },
  enter10bangla: {
    manifest: 'https://live-bangla.akamaized.net/liveabr/playlist.m3u8',
  },
};

// 🏠 Home route
app.get('/', (req, res) => {
  const list = Object.keys(CHANNELS)
    .map(
      (name) =>
        `<li><a href="/live/${name}" target="_blank">${name.toUpperCase()} ▶️</a></li>`
    )
    .join('');
  res.send(`
    <h2 style="font-family:sans-serif;text-align:center;">📺 Ryvox TV Server</h2>
    <ul style="font-size:18px;list-style:none;line-height:2;">
      ${list}
    </ul>
  `);
});

// 🎬 Manifest fetch and rewrite
app.get('/live/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];
  if (!ch) return res.status(404).send('Channel not found');

  try {
    const { data: manifest } = await axios.get(ch.manifest, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const rewritten = manifest.replace(
      /(#EXT[^#\n]*\n)([^#\n]+\.(m3u8|ts|mp4|aac|m4s))/g,
      (m, info, path) => {
        const abs = new URL(path, ch.manifest).href;
        return info + `/segment/${channel}?file=${encodeURIComponent(abs)}`;
      }
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(rewritten);
  } catch (err) {
    console.error(`Manifest error for ${channel}: ${err.message}`);
    res.status(500).send('Manifest error');
  }
});

// 🎥 Segment proxy
app.get('/segment/:channel', async (req, res) => {
  const fileUrl = req.query.file;
  if (!fileUrl) return res.status(400).send('Missing file param');

  try {
    const response = await axios({
      method: 'GET',
      url: decodeURIComponent(fileUrl),
      responseType: 'stream',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=5');
    res.setHeader('Content-Type', 'video/mp2t');
    response.data.pipe(res);
  } catch (err) {
    console.error(`Segment error: ${err.message}`);
    res.status(500).end();
  }
});

// 🟢 Keepalive
app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
