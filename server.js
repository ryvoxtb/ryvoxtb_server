const express = require('express');
const axios = require('axios');
const http = require('http'); 
const https = require('https');
const url = require('url');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// চ্যানেল তালিকা
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
app.set('etag', false); 

// ---
// 🌐 রুট এবং চ্যানেল তালিকা
// ---

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
    const { data: manifest } = await axios.get(ch.manifest, { 
        timeout: 7000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': ch.manifest 
        }
    });

    const rewrittenManifest = manifest.replace(
      // রেগুলার এক্সপ্রেশন: HLS মিডিয়া ফাইল বা সাব-ম্যানিফেস্ট URL
      /((?:#EXTINF|#EXT-X-KEY|#EXT-X-MAP|#EXT-X-STREAM-INF)[^\n]*\n)(?![#\s])(.*?\.m3u8|\S*\.(ts|aac|mp4|m4s|vtt|webm))(?!\S)/gm,
      (match, info, path) => {
        const finalPath = path.trim().startsWith('http') ? path.trim() : path.trim();
        
        return info + `/segment/${channel}?file=${encodeURIComponent(finalPath)}`;
      }
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); 
    res.send(rewrittenManifest);
    
  } catch (error) {
    console.error(`🔴 Error fetching manifest for ${channel}: ${error.message}`);
    res.status(500).send('Failed to fetch manifest.');
  }
});

// ---
// 🎥 সেগমেন্ট প্রক্সি ও স্ট্রিমিং (Low Latency / Lightweight) - রিডাইরেক্ট হ্যান্ডলিং সহ
// ---

// Content-Type ম্যাপিং ফাংশন
function getContentType(filename) {
    if (filename.endsWith('.ts')) return 'video/mp2t';
    if (filename.endsWith('.aac')) return 'audio/aac';
    if (filename.endsWith('.mp4') || filename.endsWith('.m4s')) return 'video/mp4';
    if (filename.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
    if (filename.endsWith('.vtt')) return 'text/vtt';
    return 'application/octet-stream'; // ডিফল্ট
}


function streamSegment(segmentUrl, req, res, channel, redirectCount = 0) {
    const MAX_REDIRECTS = 5;

    if (redirectCount >= MAX_REDIRECTS) {
        console.error(`🔴 Segment Request Error for ${channel}: Too many redirects`);
        return res.status(500).end();
    }
    
    const parsedUrl = url.parse(segmentUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const reqModule = isHttps ? https : http;
    
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': CHANNELS[channel].base,
            'Accept': '*/*',
            'Accept-Encoding': 'identity', 
            ...(req.headers['range'] && { 'Range': req.headers['range'] }),
        },
    };

    const proxyReq = reqModule.request(options, (proxyRes) => {
        
        // **রিডাইরেক্ট হ্যান্ডলিং** (যদি মূল সার্ভার Location হেডার পাঠায়)
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            const newUrl = url.resolve(segmentUrl, proxyRes.headers.location);
            console.log(`➡️ Segment Redirect for ${channel}: to ${newUrl}`);
            return streamSegment(newUrl, req, res, channel, redirectCount + 1);
        }

        // ক্লায়েন্টকে হেডার সেট করা
        res.status(proxyRes.statusCode);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=5');
        
        // **সঠিক কন্টেন্ট-টাইপ সেট করা**
        const contentType = proxyRes.headers['content-type'] || getContentType(parsedUrl.pathname);
        res.setHeader('Content-Type', contentType);
        
        // অন্যান্য প্রয়োজনীয় হেডারগুলো পাস করা
        if (proxyRes.headers['content-length']) {
            res.setHeader('Content-Length', proxyRes.headers['content-length']);
        }
        if (proxyRes.headers['content-range']) {
            res.setHeader('Content-Range', proxyRes.headers['content-range']);
        }
        
        // ডেটা স্ট্রিম হিসেবে ক্লায়েন্টকে পাঠানো
        proxyRes.pipe(res);
    });

    proxyReq.setTimeout(10000, () => {
        proxyReq.destroy();
        console.error(`🔴 Segment Request Timeout for ${channel}: ${segmentUrl}`);
        res.status(504).end(); 
    });

    proxyReq.on('error', (e) => {
        console.error(`🔴 Segment Request Error for ${channel}: ${e.message}`);
        res.status(500).end();
    });

    proxyReq.end();
}


app.get('/segment/:channel', (req, res) => {
  const channel = req.params.channel.toLowerCase();
  const ch = CHANNELS[channel];

  if (!ch) return res.status(404).send('Channel not found.');

  const file = req.query.file;
  if (!file) return res.status(400).send('Segment file missing.');

  const decodedFile = decodeURIComponent(file);
  const segmentUrl = decodedFile.startsWith('http') ? decodedFile : ch.base + decodedFile;

  streamSegment(segmentUrl, req, res, channel);
});

// ---
// 🚀 সার্ভার চালু করা
// ---

app.listen(PORT, () => {
  console.log(`🚀 Server started at http://localhost:${PORT}`);
});
