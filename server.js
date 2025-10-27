const express = require('express');
const axios = require('axios');
const cors = require('cors'); 

const app = express();
const PORT = 3000;

// ✅ নতুন ও কার্যকরী T-Sports HLS স্ট্রিম লিঙ্ক (ব্যবহারকারীর দেওয়া লিঙ্ক)
const TARGET_MANIFEST_URL = 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8';
// ✅ নতুন স্ট্রিম সার্ভারের বেস URL
const TARGET_BASE_URL = 'https://cdn.bdixtv24.vip/tsports/tracks-v1a1/'; 

// সমস্ত অরিজিন থেকে অ্যাক্সেসের অনুমতি দেওয়া
app.use(cors());

// ১. মেইন ম্যানিফেস্ট ফাইল (.m3u8) লোড ও রিরাইট করার রুট
app.get('/live-tv-proxy', async (req, res) => {
    try {
        const response = await axios.get(TARGET_MANIFEST_URL);
        let manifestContent = response.data;
        
        // Hls.js যাতে সেগমেন্টগুলো প্রক্সি রুট দিয়ে লোড করে, তার জন্য রিরাইট করা হচ্ছে।
        const PROXY_SEGMENT_BASE = '/live-tv-proxy-segment?segment=';
        
        // সমস্ত আপেক্ষিক পাথকে আমাদের নতুন প্রক্সি পাথে পরিবর্তন করা
        // .ts, .m4s সহ সব ধরণের সেগমেন্ট ফাইল ধরা হচ্ছে
        manifestContent = manifestContent.replace(
            /(#EXTINF:.*?\n)([^#\n].*\.(ts|m4s|aac|mp4))/g, 
            (match, extinf, segmentPath) => {
                // সেগমেন্ট পাথের সামনে প্রক্সি বেস এবং মূল পাথ যোগ করা
                return extinf + PROXY_SEGMENT_BASE + encodeURIComponent(segmentPath);
            }
        );
        
        // যদি মাস্টার ম্যানিফেস্টের ভিতরে অন্য কোনো মেনিফেস্টের লিঙ্ক থাকে, সেগুলোকেও প্রক্সি দিয়ে পরিবর্তন করা
        manifestContent = manifestContent.replace(
            /(.*\.m3u8)/g,
            (match, subManifestPath) => {
                // এটি সাব-ম্যানিফেস্ট লোড করার জন্য প্রক্সি URL তৈরি করে
                return PROXY_SEGMENT_BASE + encodeURIComponent(subManifestPath);
            }
        );

        // হেডার সেট করা এবং পরিবর্তিত ফাইল ব্রাউজারে পাঠানো
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*'); 
        res.send(manifestContent);

    } catch (error) {
        console.error("❌ ম্যানিফেস্ট লোড এরর:", error.message);
        const statusCode = error.response ? error.response.status : 'N/A';
        res.status(500).send(`ম্যানিফেস্ট লোড করতে সমস্যা হয়েছে। (স্ট্যাটাস: ${statusCode})`);
    }
});

// ২. সেগমেন্ট (.ts, .m4s, ইত্যাদি) ফাইল লোড করার রুট
app.get('/live-tv-proxy-segment', async (req, res) => {
    const segmentPath = req.query.segment;
    if (!segmentPath) {
        return res.status(400).send('সেগমেন্ট পাথ নেই।');
    }

    // মূল CDN URL-এর সাথে সেগমেন্ট পাথ যুক্ত করে সম্পূর্ণ URL তৈরি করা
    const segmentUrl = TARGET_BASE_URL + segmentPath;
    
    try {
        const response = await axios({
            method: 'get',
            url: segmentUrl,
            responseType: 'stream',
        });

        // বাইনারি ডেটা এবং CORS হেডার ব্রাউজারে ফেরত পাঠানো
        res.setHeader('Content-Type', 'video/mp2t'); 
        res.setHeader('Access-Control-Allow-Origin', '*'); 
        response.data.pipe(res);

    } catch (error) {
        console.error(`❌ সেগমেন্ট লোড এরর (${segmentPath}):`, error.message);
        res.status(500).send('ভিডিও সেগমেন্ট লোড করতে সমস্যা হয়েছে।');
    }
});

app.listen(PORT, () => {
    console.log(`✅ প্রক্সি সার্ভার চালু হয়েছে: http://localhost:${PORT}`);
    console.log(`ওয়েবসাইটে ব্যবহার করার লিঙ্ক: http://localhost:${PORT}/live-tv-proxy`);
});