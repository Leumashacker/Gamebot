const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

let latestCode = "Waiting... Generating...";
let phoneNumber = (process.env.PHONE_NUMBER || "254728879825").replace(/[^0-9]/g, "");

app.get('/', (req,res)=>res.send('Bot is running. Go to /code to see pairing code'));
app.get('/code', (req,res)=>{
  res.send(`<html><body style="font-family:sans-serif;text-align:center;padding-top:50px">
    <h1>Your WhatsApp Pairing Code</h1>
    <h2 style="font-size:60px;letter-spacing:5px">${latestCode}</h2>
    <p>For +${phoneNumber}</p>
    <p>This refreshes every 25 seconds. Enter it in WhatsApp > Linked Devices > Link with phone number</p>
    <p>Last update: ${new Date().toLocaleTimeString()}</p>
    <script>setTimeout(()=>location.reload(), 10000)</script>
  </body></html>`);
});

app.listen(PORT, ()=>console.log('Web server on', PORT));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Offline Buddy','Chrome','1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  const getCode = async () => {
    if (sock.authState.creds.registered) return;
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      latestCode = code;
      console.log(`\n===== NEW PAIRING CODE FOR +${phoneNumber} =====`);
      console.log(code);
      console.log(`===== Also visible at /code on your Render URL =====`);
      console.log(`===== Expires in 30 sec, new one coming in 25 sec =====\n`);
    } catch(e){ console.log('Error getting code:', e.message); }
  };

  if (!sock.authState.creds.registered) {
    await getCode();
    setInterval(getCode, 25000); // Fresh code every 25 sec = you get 5+ min window
  }

  sock.ev.on('connection.update', (u)=>{
    if(u.connection==='open') console.log('✅ CONNECTED!');
    if(u.connection==='close') {
      if(u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    }
  });

  // your game handlers here - keep your old brain.js logic
  // sock.ev.on('messages.upsert', ...)
}

startBot();
