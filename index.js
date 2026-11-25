const mineflayer = require('mineflayer');
const config = require('./settings.json');
const express = require('express');
const http = require('http');
const https = require('https');

// ============================================================
// EXPRESS SERVER - Status Dashboard
// ============================================================
const app = express();
const PORT = process.env.PORT || 5000;

let botState = {
  connected: false,
  startTime: Date.now(),
  reconnectAttempts: 0,
  coords: null
};

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>${config.name} Status</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;justify:center;align-items:center;height:100vh;margin:0;text-align:center;}.card{background:#1e293b;padding:30px;border-radius:15px;box-shadow:0 0 20px rgba(45,212,191,0.2);width:320px;border:1px solid #334155;}h1{color:#2dd4bf;font-size:20px;}.stat{margin:10px 0;font-size:14px;}.val{color:#2dd4bf;font-weight:bold;}</style></head><body><div class="card"><h1>${config.name}</h1><div class="stat">Status: <span class="val" id="st">Loading...</span></div><div class="stat">Uptime: <span class="val" id="up">0s</span></div><div class="stat">Server: <span class="val">${config.server.ip}</span></div><p style="font-size:10px;color:#64748b;">Ultra Light Mode (RAM < 250MB)</p></div><script>setInterval(async()=>{try{const r=await fetch('/health');const d=await r.json();document.getElementById('st').innerText=d.status;document.getElementById('up').innerText=Math.floor(d.uptime)+'s';}catch(e){}},2000);</script></body></html>`);
});

app.get('/health', (req, res) => {
  res.json({
    status: botState.connected ? 'Connected' : 'Disconnected',
    uptime: (Date.now() - botState.startTime) / 1000,
    coords: botState.coords
  });
});

app.get('/ping', (req, res) => res.send('pong'));
app.listen(PORT, '0.0.0.0', () => console.log(`[Web] Port ${PORT}`));

// Keep Render alive
setInterval(() => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const protocol = url.startsWith('https') ? https : http;
  protocol.get(`${url}/ping`, () => {}).on('error', () => {});
}, 5 * 60 * 1000);

// ============================================================
// BOT LOGIC (Super Light)
// ============================================================
let bot = null;
let activeIntervals = [];

function clearTimers() {
  activeIntervals.forEach(clearInterval);
  activeIntervals = [];
}

function createBot() {
  if (bot) {
    try { bot.quit(); } catch (e) {}
    bot.removeAllListeners();
  }
  clearTimers();

  console.log(`[Bot] Connecting to ${config.server.ip}...`);
  
  bot = mineflayer.createBot({
    host: config.server.ip,
    port: config.server.port,
    username: config['bot-account'].username,
    version: "1.21.1", // ponytail: Reverted to 1.21.1 per user request
    viewDistance: 0, // ponytail: Saves huge RAM by not loading chunks
    checkTimeoutInterval: 60000,
    hideErrors: true
  });

  bot.on('spawn', () => {
    botState.connected = true;
    botState.reconnectAttempts = 0;
    console.log(`[Bot] Online (Version: ${bot.version})`);
    
    // Simple AFK - Jump & Random Look
    activeIntervals.push(setInterval(() => {
      if (bot.entity) {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 200);
        bot.look(Math.random() * 6.2, (Math.random() - 0.5) * 0.5);
      }
    }, 15000));

    // Auto Creative (from original request)
    setTimeout(() => bot.chat('/gamemode creative'), 3000);
    
    // Keep track of coords for dashboard
    activeIntervals.push(setInterval(() => {
      if (bot.entity) botState.coords = bot.entity.position;
    }, 5000));
  });

  bot.on('end', (reason) => {
    console.log(`[Bot] Disconnected: ${reason}`);
    botState.connected = false;
    setTimeout(createBot, 5000);
  });

  bot.on('error', (err) => {
    console.log(`[Bot Error] ${err.message}`);
  });
}

// Immortal Mode
process.on('uncaughtException', (e) => {
  console.error('[System] Exception:', e.message);
  setTimeout(createBot, 5000);
});

createBot();
