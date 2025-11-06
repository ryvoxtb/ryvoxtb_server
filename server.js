const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// চ্যানেল তালিকা
const CHANNELS = {
  "btv": { name: "BTV", url: "https://www.btvlive.gov.bd/live/37f2df30-3edf-42f3-a2ee-6185002c841c/BD/355ba051-9a60-48aa-adcf-5a6c64da8c5c/index.m3u8" },
  "boishakhi-tv": { name: "Boishakhi TV", url: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8" },
  "t-sports": { name: "T Sports", url: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8" },
  "sony-aath": { name: "Sony AATH", url: "https://live20.bozztv.com/giatvplayout7/giatv-209611/tracks-v1a1/mono.ts.m3u8" },
  "ananda-tv": { name: "Ananda TV", url: "https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/playlist.m3u8" },
  "deepto-tv": { name: "Deepto TV", url: "https://byphdgllyk.gpcdn.net/hls/deeptotv/0_1/index.m3u8?sessId=76637" },
  "shonggit-bangla": { name: "Shonggit Bangla", url: "https://cdn-4.pishow.tv/live/1143/master.m3u8" },
  "sun-bangla": { name: "Sun Bangla", url: "https://smart.bengaldigital.live/sun-bangla-paid/tracks-v1a1/mono.m3u8" },
  "duronto": { name: "Duronto TV", url: "https://tvsen4.aynaott.com/durontotv/tracks-v1a1/mono.ts.m3u8" },
  "enter10-bangla": { name: "Enter10 Bangla", url: "https://live-bangla.akamaized.net/liveabr/playlist.m3u8" },
  "atn-bangla": { name: "ATN Bangla", url: "https://cd198.anystream.uk:8082/hls/atbla85tv/index.m3u8" },
  "ekushey-tv": { name: "Ekushey TV", url: "https://ekusheyserver.com/hls-live/livepkgr/_definst_/liveevent/livestream2.m3u8" },
  "bangla-tv": { name: "Bangla TV", url: "https://cdn.ghuddi.live/tvpage/Bangla_TV_BD/playlist.m3u8" },
  "somoy-tv": { name: "Somoy TV", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/index.m3u8" },
  "channel24": { name: "Channel 24", url: "https://ch24cdn.ncare.live/channel24/ch24office/index.m3u8" },
  "asian-tv": { name: "Asian TV", url: "https://mtlivestream.com/hls/asian/ytlive/index.m3u8" },
  "colors-bangla": { name: "Colors Bangla", url: "https://tvsen3.aynaott.com/u3LkNQ7UHhFX/index.m3u8" },
  "zee-bangla-cinema": { name: "Zee Bangla Cinema", url: "https://smart.bengaldigital.live/Zee-Bangla-Cinema/index.m3u8" },
  "zee-bangla": { name: "Zee Bangla", url: "http://eb4b8dcf.kablakaka.ru/iptv/WCKQ3HC3UMGVLG/6636/index.m3u8" },
  "akash8": { name: "Akash 8", url: "https://cdn-4.pishow.tv/live/969/master.m3u8" },
  "ttvv": { name: "ttvv", url: "https://cdn.televisionbd.com:8880/live/ttvplus/Tim3Plus24/3.m3u8" },
};

// Map segment prefix to channel keys for /:segmentName route
const SEGMENT_PREFIX_MAP = {
  "1143": "shonggit-bangla",
  "969": "akash8",
  "3"; "ttvv",
  // প্রয়োজনে আরো যোগ করো
};

app.use(cors());

// মূল ম্যানিফেস্ট
app.get('/live-tv-proxy', async (req, res) => {
  const channelKey = req.query.channel;
  const channel = CHANNELS[channelKey];

  if (!channel) {
    return res.status(400).send('❌ অনুগ্রহ করে একটি বৈধ channel প্যারামিটার দিন।');
  }

  try {
    const response = await axios.get(channel.url);
    let manifestContent = response.data;

    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, segmentPath) =>
        `${extinf}/live-tv-proxy-segment?channel=${channelKey}&segment=${encodeURIComponent(segmentPath)}`
    );

    manifestContent = manifestContent.replace(
      /(^|\n)([^#\n]+\.m3u8)/g,
      (match, prefix, subManifestPath) =>
        `${prefix}/live-tv-proxy-sub?channel=${channelKey}&manifest=${encodeURIComponent(subManifestPath)}`
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(manifestContent);
  } catch (error) {
    console.error('❌ ম্যানিফেস্ট লোড করতে ব্যর্থ:', error.message);
    res.status(500).send('ম্যানিফেস্ট লোড করতে ব্যর্থ।');
  }
});

// সাব ম্যানিফেস্ট
app.get('/live-tv-proxy-sub', async (req, res) => {
  const { manifest, channel } = req.query;
  const channelInfo = CHANNELS[channel];

  if (!manifest || !channelInfo) {
    return res.status(400).send('❌ চ্যানেল বা ম্যানিফেস্ট প্যারামিটার অনুপস্থিত।');
  }

  const manifestUrl = manifest.startsWith('http')
    ? manifest
    : new URL(manifest, channelInfo.url).href;

  try {
    const response = await axios.get(manifestUrl);
    let manifestContent = response.data;

    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, segmentPath) =>
        `${extinf}/live-tv-proxy-segment?channel=${channel}&segment=${encodeURIComponent(segmentPath)}`
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(manifestContent);
  } catch (error) {
    console.error('❌ সাব ম্যানিফেস্ট লোড করতে ব্যর্থ:', error.message);
    res.status(500).send('সাব ম্যানিফেস্ট লোড করতে ব্যর্থ।');
  }
});

// সেগমেন্ট ফাইল হ্যান্ডলিং
app.get('/live-tv-proxy-segment', async (req, res) => {
  const { segment, channel } = req.query;
  const channelInfo = CHANNELS[channel];

  if (!segment || !channelInfo) {
    return res.status(400).send('❌ চ্যানেল বা সেগমেন্ট প্যারামিটার অনুপস্থিত।');
  }

  const segmentUrl = segment.startsWith('http')
    ? segment
    : new URL(segment, channelInfo.url).href;

  try {
    const response = await axios({
      method: 'get',
      url: segmentUrl,
      responseType: 'stream',
    });

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');

    response.data.pipe(res);
  } catch (error) {
    console.error(`❌ ভিডিও সেগমেন্ট লোড করতে ব্যর্থ (${segmentUrl}):`, error.message);
    res.status(500).send('ভিডিও সেগমেন্ট লোড করতে ব্যর্থ।');
  }
});

// নতুন: সরাসরি /:segmentName এর মাধ্যমে লিংক হ্যান্ডল করা
app.get('/:segmentName', async (req, res) => {
  const segmentName = req.params.segmentName;

  // segmentName এর prefix দিয়ে চ্যানেল খুঁজে বের করো
  // যেমন: '1143_0.m3u8' থেকে '1143'
  const prefix = segmentName.split('_')[0];
  const channelKey = SEGMENT_PREFIX_MAP[prefix];

  if (!channelKey) {
    return res.status(404).send('❌ সেগমেন্ট রিকোয়েস্ট সাপোর্ট করে না।');
  }

  const channelInfo = CHANNELS[channelKey];

  // পুরো URL বানাও
  const segmentUrl = new URL(segmentName, channelInfo.url).href;

  try {
    const response = await axios({
      method: 'get',
      url: segmentUrl,
      responseType: 'stream',
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl'); // যদি ম্যানিফেস্ট হয়
    res.setHeader('Access-Control-Allow-Origin', '*');

    response.data.pipe(res);
  } catch (error) {
    console.error(`❌ সেগমেন্ট লোড ব্যর্থ (${segmentUrl}):`, error.message);
    res.status(500).send('সেগমেন্ট লোড করতে ব্যর্থ।');
  }
});

app.listen(PORT, () => {
  console.log(`✅ মাল্টি-চ্যানেল HLS প্রক্সি সার্ভার চলছে: http://localhost:${PORT}`);
  console.log(`👉 উদাহরণ ইউআরএল: http://localhost:${PORT}/live-tv-proxy?channel=shonggit-bangla`);
  console.log(`👉 অথবা: http://localhost:${PORT}/1143_0.m3u8 (shonggit-bangla এর জন্য)`);
});
