const express = require("express");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { URL } = require("url");

const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 3000;

// CONFIG
const ALLOWED_ORIGIN = "https://ryvox.xo.je"; // আপনার ওয়েবসাইট
const TOKEN_SECRET = "c1a9f4b3d6e7c8f1a2b3c4d5e6f7980a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
const TOKEN_TTL_SEC = 600; // 10 মিনিট

// Channels
const channels = {
  tsports: {
    manifest: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/mono.ts.m3u8",
    base: "https://cdn.bdixtv24.vip/tsports/tracks-v1a1/",
  },
  boishakhi: {
    manifest: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8",
    base: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/",
  },
  anandatv: {
    manifest: "https://app24.jagobd.com.bd/.../anandatv.stream/playlist.m3u8",
    base: "https://app24.jagobd.com.bd/.../anandatv.stream/",
    headers: {
      Referer: "https://www.jagobd.com/",
      Origin: "https://www.jagobd.com/",
      "User-Agent": "Mozilla/5.0",
    },
  },
};

// CORS & rate-limit
app.use(cors({
  origin: function(origin, cb) {
    if (!origin) return cb(null, true);
    if (origin === ALLOWED_ORIGIN) return cb(null, true);
    return cb(new Error("CORS not allowed"), false);
  },
  methods: ["GET"]
}));
app.use(rateLimit({ windowMs: 15000, max: 80 }));

// Token helpers
function base64url(buf){return Buffer.from(buf).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function sign(str){return crypto.createHmac("sha256",TOKEN_SECRET).update(str).digest("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function createToken(channel, ip){const payload={channel,ip:ip||null,exp:Math.floor(Date.now()/1000)+TOKEN_TTL_SEC,jti:crypto.randomBytes(8).toString("hex")};const b=base64url(JSON.stringify(payload));return `${b}.${sign(b)}`;}
function verifyToken(tok){try{const parts=String(tok).split(".");if(parts.length!==2)return null;const [b,sig]=parts;const expected=sign(b);if(expected.length!==sig.length)return null;if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;return JSON.parse(Buffer.from(b,"base64").toString())}catch(e){return null;}}

// Replay protection
const usedJtis=new Map();
setInterval(()=>{const now=Math.floor(Date.now()/1000);for(const [k,exp] of usedJtis) if(exp<now) usedJtis.delete(k)},30000);

// Client IP helper
function getClientIp(req){const xff=req.headers["x-forwarded-for"];if(xff)return xff.split(",")[0].trim();return req.socket.remoteAddress;}

// --- /live/:channel ---
app.get("/live/:channel", async (req,res)=>{
  const {channel}=req.params;
  const ch=channels[channel];
  if(!ch) return res.status(404).send("Channel not found");
  const clientIp=getClientIp(req);
  try{
    const originResp=await axios.get(ch.manifest,{responseType:"text",headers:ch.headers||undefined,timeout:10000});
    const lines=originResp.data.split(/\r?\n/);
    const token=createToken(channel,clientIp);
    const baseHost=`${req.protocol}://${req.get("host")}`;
    const out=lines.map(line=>{if(!line||line.startsWith("#"))return line;const encoded=encodeURIComponent(line.trim());return `${baseHost}/segment/${channel}?file=${encoded}&token=${encodeURIComponent(token)}`}).join("\n");
    res.setHeader("Content-Type","application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
    res.send(out);
  }catch(err){
    console.error("[/live] manifest fetch error:",err.message||err);
    res.status(502).send("Upstream manifest fetch error");
  }
});

// --- /segment/:channel ---
app.get("/segment/:channel", async (req,res)=>{
  const {channel}=req.params;
  const {file,token}=req.query;
  if(!file||!token) return res.status(400).send("Missing file or token");
  const ch=channels[channel];
  if(!ch) return res.status(404).send("Channel not found");
  const payload=verifyToken(token);
  if(!payload) return res.status(403).send("Invalid token");
  const now=Math.floor(Date.now()/1000);
  if(payload.channel!==channel) return res.status(403).send("Channel mismatch");
  if(payload.exp<now) return res.status(403).send("Token expired");
  const clientIp=getClientIp(req);
  if(payload.ip&&payload.ip!==clientIp) return res.status(403).send("IP mismatch");
  if(usedJtis.has(payload.jti)) return res.status(403).send("Token replay detected");
  usedJtis.set(payload.jti,payload.exp);
  let original;
  try{original=decodeURIComponent(String(file))}catch(e){original=String(file)}
  let target;
  try{target=/^https?:\/\//i.test(original)?original:/^\/\//.test(original)?`${req.protocol}:${original}`:new URL(original,ch.base||ch.manifest.replace(/[^\/]+$/,'')).href}catch(err){return res.status(500).send("Invalid segment URL")}
  const headers=Object.assign({Referer:ch.manifest,"User-Agent":req.headers["user-agent"]||"Light-Proxy/1.0"},ch.headers||{});
  try{
    const up=await axios({url:target,method:"GET",responseType:"stream",timeout:20000,headers});
    res.setHeader("Content-Type",up.headers["content-type"]||"video/mp2t");
    res.setHeader("Cache-Control","no-store");
    up.data.pipe(res);
    up.data.on("error",e=>{console.error("[/segment] upstream error",e.message||e);try{res.end()}catch(ex){}})
  }catch(err){console.error("[/segment] fetch error",err.message||err);res.status(502).send("Upstream segment fetch error")}
});

// --- root ---
app.get("/",(req,res)=>res.send(`<h3>LightSecure HLS Proxy</h3><p>Allowed origin: ${ALLOWED_ORIGIN}</p>`));

app.listen(PORT,()=>console.log(`LightSecure HLS Proxy listening on ${PORT}`));
