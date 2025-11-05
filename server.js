const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

// ✅ মাল্টিপল চ্যানেল কনফিগারেশন
const CHANNELS = {
  'ananda-tv': {
    name: 'Ananda TV',
    manifest:
      'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/playlist.m3u8',
    base:
      'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/',
  },
  't-sports': {
    name: 'T Sports',
    manifest:
      'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/tsports.stream/playlist.m3u8',
    base:
      'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/tsports.stream/',
  },
  // ✅ নতুন চ্যানেল এখানে যুক্ত করো
  // 'channel-i': {
  //   name: 'Channel i',
  //   manifest: 'https://example.com/channeli/playlist.m3u8',
  //   base: 'https://example.com/channeli/',
  // },
};

app.use(cors());

/* ------------------------------------------
   🔹 মেইন ম্যানিফেস্ট (চ্যানেল অনুযায়ী)
---------------------------------------------*/
app.get('/live-tv-proxy', async (req, res) => {
  const channelKey = req.query.channel;
  const channel = CHANNELS[channelKey];

  if (!channel)
    return res
      .status(400)
      .send('❌ অনুগ্রহ করে একটি বৈধ channel প্যারামিটার দিন।');

  try {
    const response = await axios.get(channel.manifest);
    let manifestContent = response.data;

    // 🔁 সেগমেন্ট পাথ রিরাইট
    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, segmentPath) =>
        `${extinf}/live-tv-proxy-segment?channel=${channelKey}&segment=${encodeURIComponent(
          segmentPath
        )}`
    );

    // 🔁 সাব-ম্যানিফেস্ট (.m3u8) রিরাইট
    manifestContent = manifestContent.replace(
      /(^|\n)([^#\n]+\.m3u8)/g,
      (match, _, subManifestPath) =>
        `\n/live-tv-proxy-sub?channel=${channelKey}&manifest=${encodeURIComponent(
          subManifestPath
        )}`
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(manifestContent);
  } catch (error) {
    console.error('❌ ম্যানিফেস্ট এরর:', error.message);
    res.status(500).send('ম্যানিফেস্ট লোড করতে ব্যর্থ।');
  }
});

/* ------------------------------------------
   🔹 সাব ম্যানিফেস্ট
---------------------------------------------*/
app.get('/live-tv-proxy-sub', async (req, res) => {
  const { manifest, channel } = req.query;
  const channelInfo = CHANNELS[channel];
  if (!manifest || !channelInfo)
    return res.status(400).send('চ্যানেল বা ম্যানিফেস্ট প্যারামিটার অনুপস্থিত।');

  const manifestUrl = manifest.startsWith('http')
    ? manifest
    : channelInfo.base + manifest;

  try {
    const response = await axios.get(manifestUrl);
    let manifestContent = response.data;

    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, segmentPath) =>
        `${extinf}/live-tv-proxy-segment?channel=${channel}&segment=${encodeURIComponent(
          segmentPath
        )}`
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(manifestContent);
  } catch (error) {
    console.error('❌ সাব ম্যানিফেস্ট এরর:', error.message);
    res.status(500).send('সাব ম্যানিফেস্ট লোড করতে সমস্যা হয়েছে।');
  }
});

/* ------------------------------------------
   🔹 সেগমেন্ট হ্যান্ডলিং
---------------------------------------------*/
app.get('/live-tv-proxy-segment', async (req, res) => {
  const { segment, channel } = req.query;
  const channelInfo = CHANNELS[channel];

  if (!segment || !channelInfo)
    return res.status(400).send('চ্যানেল বা সেগমেন্ট অনুপস্থিত।');

  const segmentUrl = segment.startsWith('http')
    ? segment
    : channelInfo.base + segment;

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
    console.error(`❌ সেগমেন্ট এরর (${segmentUrl}):`, error.message);
    res.status(500).send('ভিডিও সেগমেন্ট লোড ব্যর্থ।');
  }
});

app.listen(PORT, () => {
  console.log(`✅ মাল্টি-চ্যানেল প্রক্সি চলছে: http://localhost:${PORT}`);
  console.log(`🔗 ব্যবহার করো যেমন:`);
  console.log(`👉 Ananda TV: http://localhost:${PORT}/live-tv-proxy?channel=ananda-tv`);
  console.log(`👉 T Sports: http://localhost:${PORT}/live-tv-proxy?channel=t-sports`);
});
