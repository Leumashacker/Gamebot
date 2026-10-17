const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, DisconnectReason } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== 1. RESTORE SESSION FROM ENV (from your pair site) =====
function restoreSession(){
  try{
    const sessionId = process.env.SESSION_ID;
    if(!sessionId) return false;
    if(!fs.existsSync('./auth')) fs.mkdirSync('./auth', {recursive:true});
    const credsJson = Buffer.from(sessionId, 'base64').toString('utf8');
    fs.writeFileSync('./auth/creds.json', credsJson);
    console.log('✅ Session restored from SESSION_ID env');
    return true;
  }catch(e){
    console.log('Failed to restore session:', e.message);
    return false;
  }
}
restoreSession();

app.get('/', (req,res)=>res.send('Gamebot Online ✅ Connected via SESSION_ID'));
app.listen(PORT, ()=>console.log('Web on', PORT));

// ===== 2. START BOT =====
async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'}))
    },
    logger: pino({level:'silent'}),
    browser: ['Ubuntu','Chrome','22.04.4']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update)=>{
    const { connection, lastDisconnect } = update;
    if(connection === 'open'){
      console.log('✅ CONNECTED! Gamebot is live');
    }
    if(connection === 'close'){
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed, reconnecting:', shouldReconnect);
      if(shouldReconnect) startBot();
    }
  });

  // ===== 3. YOUR GAME LOGIC HERE =====
  sock.ev.on('messages.upsert', async ({messages})=>{
    const msg = messages[0];
    if(!msg.message) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const from = msg.key.remoteJid;

    if(text.toLowerCase() === '!help'){
      await sock.sendMessage(from, { text: '🎮 Gamebot Commands:\n!help - this\n!ping - check bot\n!game - start game' });
    }
    if(text.toLowerCase() === '!ping'){
      await sock.sendMessage(from, { text: '🏓 Pong! Bot is online ✅' });
    }
    // add your other game commands here
  });
}

startBot();
