const express = require('express');
const axios = require('axios');
const http = require('http'); // Node.js built-in module for efficient streaming
const https = require('https'); // For HTTPS requests
const url = require('url'); // To handle URL parsing
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// চ্যানেল তালিকা (নাম ছোট হাতেও হতে হবে)
const CHANNELS = {
  // আপনার দেওয়া পূর্বের তালিকাটি এখানে অপরিবর্তিত রাখা হয়েছে, 
  // তবে এর মধ্যে কিছু লিংক হয়তো বর্তমানে কাজ নাও করতে পারে।
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
  // ... অন্যান্য চ্যানেল অপরিবর্তিত ...
  sony: {
    manifest: 'https://live20.bozztv.com/giatvplayout7/giatv-209611/tracks-v1a1/mono.ts.m3u8',
    base: 'https://live20.bozztv.com/giatvplayout7/giatv-209611/tracks-v1a1/',
  },
  anandatv: {
    manifest: 'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/playlist.m3u8',
    base: 'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDDEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/',
  },
  shonggit: {
    manifest: 'https://cdn-4.pishow.tv/live/1143/master.m3u8',
    base: 'https://cdn-4.pishow.tv/live/1143/',
  },
  Sun: {
    manifest: 'https://smart.bengaldigital.live/sun-bangla-paid/tracks-v1a1/mono.m3u8',
    base: 'https://smart.bengaldigital.live/sun-bangla-paid/tracks-v1a1/',
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
  ekushey: {
    manifest: 'https://ekusheyserver.com/hls-live/livepkgr/_definst_/liveevent/livestream2.m3u8',
    base: 'https://ekusheyserver.com/hls-live/livepkgr/_definst_/liveevent/',
  },
  banglatv: {
    manifest: 'https://cdn.ghuddi.live/tvpage/Bangla_TV_BD/playlist.m3u8',
    base: 'https://cdn.ghuddi.live/tvpage/Bangla_TV_BD/',
  },
  somoytv: {
    manifest: 'https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/index.m3u8',
    base: 'https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/',
  },
  channel24: {
    manifest: 'https://ch24cdn.ncare.live/channel24/ch24office/index.m3u8',
    base: 'https://ch24cdn.ncare.live/channel24/ch24office/',
  },
  asianatv: {
    manifest: 'https://mtlivestream.com/hls/asian/ytlive/index.m3u8',
    base: 'https://mtlivestream.com/hls/asian/ytlive/',
  },
  colorsbangla: {
    manifest: 'https://tvsen3.aynaott.com/u3LkNQ7UHhFX/index.m3u8',
    base: 'https://tvsen3.aynaott.com/u3LkNQ7UHhFX/',
  },
  zeebanglacinema: {
    manifest: 'https://smart.bengaldigital.live/Zee-Bangla-Cinema/index.m3u8',
    base: 'https://smart.bengaldigital.live/Zee-Bangla-Cinema/',
  },
  zeebangla: {
    manifest: 'http://eb4b8dcf.kablakaka.ru/iptv/WCKQ3HC3UMGVLG/6636/index.m3u8',
    base: 'http://eb4b8dcf.kablakaka.ru/iptv/WCKQ3HC3UMGVLG/6636/',
  },
  akash8: {
    manifest: 'https://ryvoxtb-server.onrender.com/live/969_1.m3u8',
    base: 'https://ryvoxtb-server.onrender.com/live/',
  },
};


// Global Middleware
app.use(cors());
app.disable('x-powered-by');
app.set('etag', false); // ETag বন্ধ করা হলো যাতে প্রতিটি রিকোয়েস্টে সার্ভারকে হ্যাশ (hash) ক্যালকুলেট করতে না হয়

// ---

## 🌐 মূল রুট এবং চ্যানেল তালিকা

// Root route - চ্যানেল লিস্ট দেখাবে
app.get('/', (req, res) => {
  const list = Object.keys(CHANNELS)
    .map((key) => `<li><a href="/live/${key}" target="_blank">${key.toUpperCase()} Live</a></li>`)
    .join('');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HLS Proxy</title>
        <style>body { font-family: sans-serif; }</style>
    </head>
    <body>
        <h2>📺 Multi-Channel HLS Proxy Server</h2>
        <p>ভিডিও প্লেয়ারে ব্যবহারের জন্য চ্যানেল লিংকে ক্লিক করুন:</p>
        <ul>${list}</ul>
        <p>উদাহরণ: <code>http://localhost:${PORT}/live/tsports</code></p>
    </body>
    </html>
  `);
});

// ---

## 📄 ম্যানিফেস্ট প্রক্সি (`.m3u8`)

// Main route: ম্যানিফেস্ট ফাইল প্রসেসিং
app.get('/live/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];

  if (!ch) return res.status(404).send('Channel not found.');

  try {
    // ম্যানিফেস্ট ফাইল fetch করা
    const { data: manifest } = await axios.get(ch.manifest, { 
        timeout: 7000,
        headers: {
            // অনেক সার্ভারে সঠিক User-Agent এবং Referer ছাড়া অ্যাক্সেস দেয় না
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': ch.manifest // মূল সার্ভারকে বোঝানো যে রিকোয়েস্টটি বৈধ
        }
    });

    // ম্যানিফেস্টে segment path রিরাইট করা
    // HLS ম্যানিফেস্টে .ts, .aac, .mp4, .m4s, .vtt ফাইলের পাথ বদলানো হচ্ছে
    // এখানে 'g' flag এর সাথে 'm' flag ব্যবহার করা হয়েছে যাতে প্রতি লাইনে চেক হয়
    const rewrittenManifest = manifest.replace(
      // রেগুলার এক্সপ্রেশন: #EXTINF বা #EXT-X-KEY বা অন্য কোনো ট্যাগের পরের লাইন, যা # দিয়ে শুরু হয়নি
      /((?:#EXTINF|#EXT-X-KEY|#EXT-X-MAP|#EXT-X-STREAM-INF)[^\n]*\n)(?![#\s])(.*?\.m3u8|\S*\.(ts|aac|mp4|m4s|vtt|webm))(?!\S)/gm,
      (match, info, path) => {
        // যদি পাথটি একটি পূর্ণ URL হয়, তবে সেটিকেও প্রক্সির মাধ্যমে পাঠানো
        const finalPath = path.trim().startsWith('http') ? path.trim() : path.trim();
        
        // এখানে segment proxy url বানানো হচ্ছে
        // এনকোড করা হচ্ছে যাতে ফাইলে স্পেশাল ক্যারেক্টার থাকলে সমস্যা না হয়
        return info + `/segment/${channel}?file=${encodeURIComponent(finalPath)}`;
      }
    );

    // হেডার সেট করা
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    // ক্যাশিং বন্ধ করা, কারণ এটি একটি লাইভ স্ট্রিমিং ম্যানিফেস্ট, যা ঘন ঘন আপডেট হয়
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); 
    res.send(rewrittenManifest);
    
  } catch (error) {
    console.error(`🔴 Error fetching manifest for ${channel}:`, error.message);
    res.status(500).send('Failed to fetch manifest.');
  }
});

// ---

## 🎥 সেগমেন্ট প্রক্সি ও স্ট্রিমিং (গুরুত্বপূর্ণ)

// Segment proxy route: সেগমেন্ট ফাইল স্ট্রিমিং করবে
// **এই অংশটি সার্ভারকে হালকা ও দ্রুত করার জন্য অপ্টিমাইজ করা হয়েছে**
app.get('/segment/:channel', (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];

  if (!ch) return res.status(404).send('Channel not found.');

  const file = req.query.file;
  if (!file) return res.status(400).send('Segment file missing.');

  // পুরো URL তৈরি করা হচ্ছে
  const decodedFile = decodeURIComponent(file);
  const segmentUrl = decodedFile.startsWith('http') ? decodedFile : ch.base + decodedFile;
  
  // URL পার্সিং
  const parsedUrl = url.parse(segmentUrl);
  const isHttps = parsedUrl.protocol === 'https:';
  
  // সঠিক মডিউল নির্বাচন করা (HTTP বা HTTPS)
  const reqModule = isHttps ? https : http;

  // ফরোয়ার্ডিং রিকোয়েস্টের অপশনস
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.path,
    method: 'GET',
    headers: {
      // User-Agent এবং Referer সেট করা যাতে মূল সার্ভার এটিকে ব্রাউজার রিকোয়েস্ট মনে করে
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': ch.base,
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // কম্প্রেশন অফ রাখা হলো
      // ক্লায়েন্টের পাঠানো Range হেডারটি সরাসরি পাস করে দেওয়া হলো
      // এটি ফরওয়ার্ড না করলে seek/jump কাজ করবে না
      ...(req.headers['range'] && { 'Range': req.headers['range'] }), 
    },
  };

  // রিকোয়েস্ট তৈরি করা এবং স্ট্রিমিং শুরু করা
  const proxyReq = reqModule.request(options, (proxyRes) => {
    
    // সেগমেন্টের Content-Type যদি সার্ভার থেকে আসে, সেটি ব্যবহার করা
    if (proxyRes.headers['content-type']) {
        res.setHeader('Content-Type', proxyRes.headers['content-type']);
    } else {
        // না পেলে ডিফল্ট হিসেবে HLS সেগমেন্টের Content-Type দেওয়া
        res.setHeader('Content-Type', 'video/mp2t'); 
    }
    
    // ক্লায়েন্ট-সাইডে দ্রুত ক্যাশিং এর জন্য হেডার সেট করা
    // Max-Age 10 সেকেন্ড দেওয়া হলো যাতে সেগমেন্টগুলো প্লেয়ার দ্রুত লোড করতে পারে
    res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=5');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // মূল সার্ভার থেকে আসা অন্যান্য প্রয়োজনীয় হেডারগুলো পাস করা
    if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    if (proxyRes.headers['content-range']) {
        res.setHeader('Content-Range', proxyRes.headers['content-range']);
    }
    
    // স্ট্যাটাস কোড সেট করা
    res.status(proxyRes.statusCode);

    // **মূল অপ্টিমাইজেশন:** ডেটা স্ট্রিম হিসেবে সরাসরি ক্লায়েন্টকে পাঠানো
    proxyRes.pipe(res);
  });

  // রিকোয়েস্ট টাইমআউট সেট করা (দ্রুত প্রতিক্রিয়া নিশ্চিত করতে)
  proxyReq.setTimeout(10000, () => {
    proxyReq.destroy();
    console.error(`🔴 Segment Request Timeout for ${channel}: ${segmentUrl}`);
    res.status(504).end(); // Gateway Timeout
  });

  // ত্রুটি পরিচালনা (DNS error, connection refused, etc.)
  proxyReq.on('error', (e) => {
    console.error(`🔴 Segment Request Error for ${channel}: ${e.message}`);
    res.status(500).end();
  });

  // ক্লায়েন্ট থেকে আসা কোনো ডেটা থাকলে তা উপেক্ষা করা (যদিও GET রিকোয়েস্টে ডেটা থাকে না)
  req.pipe(proxyReq);
});

// ---

app.listen(PORT, () => {
  console.log(`🚀 Server started at http://localhost:${PORT}`);
});
