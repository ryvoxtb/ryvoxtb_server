const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

// ✅ মূল চ্যানেলের লিঙ্ক
const TARGET_MANIFEST_URL =
  'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/playlist.m3u8';

const TARGET_BASE_URL =
  'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/';

app.use(cors());

/* ------------------------------------------
   🔹 প্রধান ম্যানিফেস্ট (.m3u8)
---------------------------------------------*/
app.get('/live-tv-proxy', async (req, res) => {
  try {
    const response = await axios.get(TARGET_MANIFEST_URL);
    let manifestContent = response.data;

    // 🔁 সেগমেন্ট পাথ রিরাইট করা
    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, segmentPath) => {
        return (
          extinf +
          '/live-tv-proxy-segment?segment=' +
          encodeURIComponent(segmentPath)
        );
      }
    );

    // 🔁 সাব-ম্যানিফেস্ট (.m3u8) রিরাইট করা
    manifestContent = manifestContent.replace(
      /(^|\n)([^#\n]+\.m3u8)/g,
      (match, _, subManifestPath) => {
        return (
          '\n/live-tv-proxy-sub?manifest=' +
          encodeURIComponent(subManifestPath)
        );
      }
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(manifestContent);
  } catch (error) {
    console.error('❌ ম্যানিফেস্ট লোড এরর:', error.message);
    const statusCode = error.response ? error.response.status : 'N/A';
    res.status(500).send(`ম্যানিফেস্ট লোড ব্যর্থ (স্ট্যাটাস: ${statusCode})`);
  }
});

/* ------------------------------------------
   🔹 সাব-ম্যানিফেস্ট হ্যান্ডলিং (.m3u8)
---------------------------------------------*/
app.get('/live-tv-proxy-sub', async (req, res) => {
  const manifestPath = req.query.manifest;
  if (!manifestPath) return res.status(400).send('সাব ম্যানিফেস্ট পাথ নেই।');

  const manifestUrl = manifestPath.startsWith('http')
    ? manifestPath
    : TARGET_BASE_URL + manifestPath;

  try {
    const response = await axios.get(manifestUrl);
    let manifestContent = response.data;

    manifestContent = manifestContent.replace(
      /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g,
      (match, extinf, segmentPath) => {
        return (
          extinf +
          '/live-tv-proxy-segment?segment=' +
          encodeURIComponent(segmentPath)
        );
      }
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
   🔹 সেগমেন্ট (.ts/.m4s) হ্যান্ডলিং
---------------------------------------------*/
app.get('/live-tv-proxy-segment', async (req, res) => {
  const segmentPath = req.query.segment;
  if (!segmentPath) return res.status(400).send('সেগমেন্ট পাথ নেই।');

  const segmentUrl = segmentPath.startsWith('http')
    ? segmentPath
    : TARGET_BASE_URL + segmentPath;

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
    console.error(`❌ সেগমেন্ট এরর (${segmentPath}):`, error.message);
    res.status(500).send('ভিডিও সেগমেন্ট লোড করতে সমস্যা হয়েছে।');
  }
});

/* ------------------------------------------
   🔹 সার্ভার শুরু
---------------------------------------------*/
app.listen(PORT, () => {
  console.log(`✅ প্রক্সি সার্ভার চলছে: http://localhost:${PORT}`);
  console.log(`🔗 ব্যবহার করো: http://localhost:${PORT}/live-tv-proxy`);
});
