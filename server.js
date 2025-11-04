const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// চ্যানেল তালিকা (নাম ছোট হাতেও হতে হবে)
const CHANNELS = {
  boishakhi: {
    manifest: 'https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8',
    base: 'https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/',
  },
  tsports: {
    manifest: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8',
    base: 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/',
  },
  // আরও চ্যানেল এখানে যোগ করুন...
};

// Global Middleware
app.use(cors());
app.disable('x-powered-by');
app.set('etag', false); // Disable ETag to reduce overhead

// Root route - চ্যানেল লিস্ট দেখাবে
app.get('/', (req, res) => {
  const list = Object.keys(CHANNELS)
    .map((key) => `<li><a href="/live/${key}" target="_blank">${key.toUpperCase()} Live</a></li>`)
    .join('');
  res.send(`<h2>Multi-Channel HLS Proxy Server</h2><ul>${list}</ul>`);
});

// Main route: ম্যানিফেস্ট ফাইল প্রসেসিং
app.get('/live/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];

  if (!ch) return res.status(404).send('Channel not found.');

  try {
    const { data: manifest } = await axios.get(ch.manifest, { timeout: 7000 });

    // ম্যানিফেস্টে segment path রিরাইট করা
    // HLS ম্যানিফেস্টে .ts, .aac, .mp4, .m4s ফাইলের পাথ বদলানো হচ্ছে
    const rewrittenManifest = manifest.replace(
      /(#EXTINF:.*\n)([^#\n].*\.(ts|aac|mp4|m4s))/g,
      (match, info, path) => {
        // এখানে segment proxy url বানানো হচ্ছে
        return info + `/segment/${channel}?file=${encodeURIComponent(path.trim())}`;
      }
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(rewrittenManifest);
  } catch (error) {
    console.error(`Error fetching manifest for ${channel}:`, error.message);
    res.status(500).send('Failed to fetch manifest.');
  }
});

// Segment proxy route: সেগমেন্ট ফাইল স্ট্রিমিং করবে
app.get('/segment/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];

  if (!ch) return res.status(404).send('Channel not found.');

  const file = req.query.file;
  if (!file) return res.status(400).send('Segment file missing.');

  // পুরো URL তৈরি করা হচ্ছে
  const segmentUrl = ch.base + decodeURIComponent(file);

  try {
    // Axios দিয়ে স্ট্রিম আকারে সেগমেন্ট রিকোয়েস্ট করা হচ্ছে
    const response = await axios({
      method: 'GET',
      url: segmentUrl,
      responseType: 'stream',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProxyServer/1.0)', // কিছু সার্ভারে UA দরকার হতে পারে
        'Accept': '*/*',
        'Accept-Encoding': 'identity', // কমপ্রেশন অফ রাখতে পারেন
      },
    });

    // উপযুক্ত হেডার সেট করা
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=10');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // ডেটা স্ট্রিম হিসেবে পাস করা হচ্ছে
    response.data.pipe(res);

  } catch (error) {
    console.error(`Error fetching segment [${channel}]:`, error.message);
    res.status(500).end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server started at http://localhost:${PORT}`);
});
