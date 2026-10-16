const express = require('express');
const app = express();
app.get('/', (req,res)=>res.send('Bot alive - send !help to yourself after linking'));
app.listen(10000);

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');
const store = require('./state');
const brain = require('./brain');

store.load();
const BOT = '\u200b';
const digits = (s) => String(s).replace(/\D/g, '');
const isGroupish = (id) => id.endsWith('@g.us') || id.includes('broadcast');
let sock;
const phone = digits(config.phoneNumber || process.env.PHONE_NUMBER || '254728879825');

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  sock = makeWASocket({ auth: state, logger: pino({level:'silent'}), browser: ['Offline Buddy','Chrome','1.0'] });
  sock.ev.on('creds.update', saveCreds);

  if(!state.creds.registered){
    setTimeout(async ()=>{
      try{
        if(!sock.authState.creds.registered){
          let code = await sock.requestPairingCode(phone);
          console.log(`\n===== PAIRING CODE FOR +${phone} =====`);
          console.log(code);
          console.log(`====================================\nGo to WhatsApp > Linked Devices > Link with phone number > Enter: ${code}\n`);
        }
      }catch(e){ console.log('Pairing error:', e.message); }
    }, 5000);
  }

  sock.ev.on('connection.update', (u)=>{
    if(u.connection==='open') console.log('✅ CONNECTED! Now open WhatsApp and send !help to yourself');
    if(u.connection==='close'){
      const shouldReconnect = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if(shouldReconnect) startBot();
      else console.log('Logged out, delete /auth folder and redeploy');
    }
  });

  sock.ev.on('messages.upsert', async ({messages})=>{
    const msg = messages[0]; if(!msg?.message) return;
    const from = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if(body.startsWith(BOT)) return;
    if(msg.key.fromMe){
      if(body.trim().startsWith('!')){
        const text = body.trim();
        // Owner commands
        if(text.toLowerCase().startsWith('!away on')){ 
          const h = parseFloat(text.split(' ')[2]); 
          store.state.away=true; store.state.awaySince=Date.now(); store.state.awayUntil=h>0?Date.now()+h*3600*1000:null; store.save(); 
          await sock.sendMessage(sock.user.id, {text:BOT+`😴 Away ON${h>0?` for ${h}h`:''}`});
        } else if(text.toLowerCase().startsWith('!away off')){ 
          store.state.away=false; store.save(); 
          await sock.sendMessage(sock.user.id, {text:BOT+'Away OFF'});
        } else if(text.startsWith('!help')){
          await sock.sendMessage(sock.user.id, {text:BOT+'!away on / !away on 3 / !away off / !status'});
        }
      }
      if(!isGroupish(from)){
        store.chat(from).pausedUntil = Date.now() + config.pauseOnOwnReplyMs; store.save();
      }
      return;
    }
    // friends
    if(!store.state.away) return;
    if(isGroupish(from)) return;
    const num = digits(from.split('@')[0]);
    if(store.state.blocked.includes(num)) return;
    const s = store.chat(from);
    s.msgsAway++; s.preview = body.slice(0,60);
    s.sentTimes = s.sentTimes.filter(t=>Date.now()-t<3600*1000);
    if(s.sentTimes.length>=config.maxRepliesPerHour){ store.save(); return; }
    const out = brain.respond(s, body, {name: msg.pushName, first: !s.greeted});
    s.greeted=true; s.lastSeen=Date.now(); if(out) s.sentTimes.push(Date.now()); store.save();
    if(out){ await new Promise(r=>setTimeout(r, 1200)); await sock.sendMessage(from, {text: BOT+out}); }
  });
}
startBot();
