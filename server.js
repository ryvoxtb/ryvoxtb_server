const express = require('express');
const axios = require('axios');
const http = require('http'); // HTTP requests এর জন্য
const https = require('https'); // HTTPS requests এর জন্য
const url = require('url'); // URL হ্যান্ডলিং এর জন্য
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
  btv: {
    manifest: 'https://www.btvlive.gov.bd/live/37f2df30-3edf-42f3-a2ee-6185002c841c/BD/355ba051-9a60-48aa-adcf-5a6c64da8c5c/index.m3u8',
    base: 'https://www.btvlive.gov.bd/live/37f2df30-3edf-42f3-a2ee-6185002c841c/BD/355ba051-9a60-48aa-adcf-5a6c64da8c5c/',
  },
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
app.set('etag', false); // সার্ভারকে হালকা রাখতে ETag ডিসেবল করা হলো

// ---
// 🌐 রুট এবং চ্যানেল তালিকা
// ---

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
// 📄 ম্যানিফেস্ট প্রক্সি (HLS Playlist .m3u8)
// ---

app.get('/live/:channel', async (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];

  if (!ch) return res.status(404).send('Channel not found.');

  try {
    // ম্যানিফেস্ট ফাইল fetch করা
    const { data: manifest } = await axios.get(ch.manifest, { 
        timeout: 7000,
        headers: {
            // User-Agent এবং Referer সেট করা
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': ch.manifest 
        }
    });

    // ম্যানিফেস্টে segment path রিরাইট করা
    const rewrittenManifest = manifest.replace(
      // রেগুলার এক্সপ্রেশন: #EXTINF বা অন্য কোনো ট্যাগের পরের লাইন, যা # দিয়ে শুরু হয়নি
      /((?:#EXTINF|#EXT-X-KEY|#EXT-X-MAP|#EXT-X-STREAM-INF)[^\n]*\n)(?![#\s])(.*?\.m3u8|\S*\.(ts|aac|mp4|m4s|vtt|webm))(?!\S)/gm,
      (match, info, path) => {
        const finalPath = path.trim().startsWith('http') ? path.trim() : path.trim();
        
        // সেগমেন্ট প্রক্সি URL তৈরি করা
        return info + `/segment/${channel}?file=${encodeURIComponent(finalPath)}`;
      }
    );

    // হেডার সেট করা
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); 
    res.send(rewrittenManifest);
    
  } catch (error) {
    // টেমপ্লেট স্ট্রিং এর মাধ্যমে সঠিক এরর লোগিং
    console.error(`🔴 Error fetching manifest for ${channel}: ${error.message}`);
    res.status(500).send('Failed to fetch manifest.');
  }
});

// ---
// 🎥 সেগমেন্ট প্রক্সি ও স্ট্রিমিং (Low Latency / Lightweight)
// ---

app.get('/segment/:channel', (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];

  if (!ch) return res.status(404).send('Channel not found.');

  const file = req.query.file;
  if (!file) return res.status(400).send('Segment file missing.');

  // সম্পূর্ণ URL তৈরি করা
  const decodedFile = decodeURIComponent(file);
  const segmentUrl = decodedFile.startsWith('http') ? decodedFile : ch.base + decodedFile;
  
  const parsedUrl = url.parse(segmentUrl);
  const isHttps = parsedUrl.protocol === 'https:';
  
  // HTTP বা HTTPS মডিউল নির্বাচন
  const reqModule = isHttps ? https : http;

  // ফরোয়ার্ডিং রিকোয়েস্টের অপশনস
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.path,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': ch.base,
      'Accept': '*/*',
      'Accept-Encoding': 'identity', 
      ...(req.headers['range'] && { 'Range': req.headers['range'] }), // Seek/Jump এর জন্য Range হেডার পাস করা
    },
  };

  // রিকোয়েস্ট তৈরি করা এবং স্ট্রিমিং শুরু করা
  const proxyReq = reqModule.request(options, (proxyRes) => {
    
    // হেডার সেট করা
    if (proxyRes.headers['content-type']) {
        res.setHeader('Content-Type', proxyRes.headers['content-type']);
    } else {
        res.setHeader('Content-Type', 'video/mp2t'); 
    }
    
    // দ্রুত ক্যাশিং এর জন্য হেডার সেট করা (ভিডিও স্মুথ রাখতে)
    res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=5');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Content-Length এবং Content-Range হেডারগুলো পাস করা
    if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    if (proxyRes.headers['content-range']) {
        res.setHeader('Content-Range', proxyRes.headers['content-range']);
    }
    
    res.status(proxyRes.statusCode);

    // ডেটা স্ট্রিম হিসেবে সরাসরি ক্লায়েন্টকে পাঠানো
    proxyRes.pipe(res);
  });

  // রিকোয়েস্ট টাইমআউট সেট করা
  proxyReq.setTimeout(10000, () => {
    proxyReq.destroy();
    console.error(`🔴 Segment Request Timeout for ${channel}: ${segmentUrl}`);
    res.status(504).end(); 
  });

  // ত্রুটি পরিচালনা
  proxyReq.on('error', (e) => {
    console.error(`🔴 Segment Request Error for ${channel}: ${e.message}`);
    res.status(500).end();
  });

  proxyReq.end(); // রিকোয়েস্টটি শেষ করা হচ্ছে
});

// ---
// 🚀 সার্ভার চালু করা
// ---

app.listen(PORT, () => {
  console.log(`🚀 Server started at http://localhost:${PORT}`);
});
