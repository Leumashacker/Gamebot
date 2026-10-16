const express = require('express');
const app = express();
app.get('/', (req,res)=>res.send('Bot alive - Offline Buddy'));
app.listen(10000, ()=>console.log('Keepalive server on 10000'));

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');
const store = require('./state');
const brain = require('./brain');

store.load();
const { state } = store;

const BOT = '\u200b'; // invisible char to detect own messages
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const digits = (s) => String(s).replace(/\D/g, '');
const isGroupish = (id) => id.endsWith('@g.us') || id.includes('broadcast') || id.endsWith('@newsletter');

let sock;
let phone = digits(config.phoneNumber || '');

async function startBot(){
  const { state: authState, saveCreds } = await useMultiFileAuthState('./auth');
  
  sock = makeWASocket({
    auth: authState,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // Pairing code logic
  if (!authState.creds.registered && phone) {
    await sleep(3000);
    try {
      const code = await sock.requestPairingCode(phone);
      console.log('\n==============================');
      console.log(`  Your pairing code: ${code}`);
      console.log('==============================');
      console.log('WhatsApp > Settings > Linked Devices > Link device > Link with phone number');
      console.log(`Enter code: ${code}\n`);
    } catch(e){ console.error('Pairing error:', e.message); }
  }

  sock.ev.on('connection.update', async (u)=>{
    const { connection, lastDisconnect } = u;
    if(connection === 'open'){
      console.log('✅ Bot connected! Send !help to yourself on WhatsApp');
    }
    if(connection === 'close'){
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Disconnected, reconnecting:', shouldReconnect);
      if(shouldReconnect) startBot();
    }
  });

  sock.ev.on('messages.upsert', async (m)=>{
    const msg = m.messages[0];
    if(!msg || !msg.message) return;
    const from = msg.key.remoteJid;
    const fromMe = msg.key.fromMe;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    if(body.startsWith(BOT)) return; // our own

    // Owner commands - when you message yourself
    if(fromMe && from === sock.user.id){
      // Actually self-chat in Baileys is you messaging yourself, we handle owner commands via messages to self that start with !
      // For simplicity, use any message fromMe that is to your own JID? We'll check if body starts with !
      if(body.trim().startsWith('!')){
        await onOwnerCommand(body.trim());
      }
      return;
    }

    // If you replied to a friend, pause that chat
    if(fromMe){
      if(state.away && !isGroupish(from)){
        store.chat(from).pausedUntil = Date.now() + config.pauseOnOwnReplyMs;
        store.save();
      }
      return;
    }

    await onIncoming(from, body, msg);
  });
}

// ----- your original logic adapted -----
function startAway(hours){
  state.away = true; state.awaySince = Date.now();
  state.awayUntil = hours>0 ? Date.now()+hours*3600*1000 : null;
  for(const c of Object.values(state.chats)){ c.msgsAway=0; c.preview=null; c.played=[]; }
  store.save();
}
function summary(){
  const active = Object.entries(state.chats).filter(([,c])=>c.msgsAway>0);
  if(!active.length) return '👋 Welcome back! Nobody texted while you were away.';
  const lines = active.map(([id,c])=>{
    const num = digits(id.split('@')[0]);
    const played = c.played.length ? ` — played ${c.played.join(', ')}` : '';
    const last = (c.preview||'').slice(0,60);
    return `• ${c.name||'Unknown'} (+${num}): ${c.msgsAway} msgs${played}\n   last: "${last}"`;
  });
  return `👋 Welcome back! While you were away:\n\n${lines.join('\n')}`;
}
async function endAway(){
  const text = summary();
  state.away=false; state.awayUntil=null; store.save();
  await notifyOwner(text);
}
async function sendTo(id, text){
  try{
    await sock.presenceSubscribe(id).catch(()=>{});
    await sock.sendPresenceUpdate('composing', id);
    await sleep(1000 + Math.min(text.length*15, 2000));
    await sock.sendMessage(id, { text: BOT+text });
    await sock.sendPresenceUpdate('paused', id);
  }catch(e){ console.error('Send failed', e.message); }
}
const notifyOwner = (text) => sendTo(sock.user.id, text);

const HELP = `*Offline Buddy commands*\n!away on — friends get games & stories\n!away on 3 — off after 3h\n!away off — stop + summary\n!status — see state\n!summary — who texted\n!block 2547XXXXXXXX\n!unblock 2547XXXXXXXX`;

async function onOwnerCommand(text){
  const [cmd,...args] = text.slice(1).trim().split(/\s+/);
  switch((cmd||'').toLowerCase()){
    case 'help': return notifyOwner(HELP);
    case 'away': {
      const mode=(args[0]||'').toLowerCase();
      if(mode==='on'){ const hours=parseFloat(args[1]); startAway(Number.isFinite(hours)?hours:0); return notifyOwner(`😴 Away ON${hours>0?` for ${hours}h`:''}.`); }
      if(mode==='off'){ if(!state.away) return notifyOwner('Away already off.'); return endAway(); }
      return notifyOwner('Use !away on or !away off');
    }
    case 'status': {
      const n=Object.values(state.chats).filter(c=>c.msgsAway>0).length;
      return notifyOwner(`Away: ${state.away?'ON':'OFF'}\nFriends texted: ${n}\nBlocked: ${state.blocked.length}`);
    }
    case 'summary': return notifyOwner(summary());
    case 'block': { const n=digits(args[0]||''); if(!n) return notifyOwner('Usage: !block 2547XXXXXXXX'); if(!state.blocked.includes(n)) state.blocked.push(n); store.save(); return notifyOwner(`🚫 Blocked +${n}`); }
    case 'unblock': { const n=digits(args[0]||''); state.blocked=state.blocked.filter(x=>x!==n); store.save(); return notifyOwner(`✅ Unblocked +${n}`); }
    default: return notifyOwner('Unknown. Send !help');
  }
}

async function onIncoming(from, body, raw){
  if(state.away && state.awayUntil && Date.now()>state.awayUntil) await endAway();
  if(!state.away) return;
  if(isGroupish(from)) return;
  const number = digits(from.split('@')[0]);
  if(state.blocked.includes(number)) return;
  if(config.allowedNumbers.length && !config.allowedNumbers.map(digits).includes(number)) return;

  const s = store.chat(from);
  const now=Date.now();
  const text=body||'';
  s.msgsAway++; s.preview=text||'[media]';
  if(s.optedOut){ if(/^(start|menu|play)$/i.test(text.trim())) s.optedOut=false; else { store.save(); return; } }
  if(now < s.pausedUntil){ store.save(); return; }
  s.sentTimes=s.sentTimes.filter(t=>now-t<3600*1000);
  if(s.sentTimes.length>=config.maxRepliesPerHour){ store.save(); return; }
  const first=!s.greeted||now-s.lastSeen>config.greetAfterMs;
  const name = raw.pushName;
  const out = brain.respond(s, text, { name, first });
  s.greeted=true; s.lastSeen=now; if(out) s.sentTimes.push(now); store.save();
  if(out) await sendTo(from, out);
}

startBot();
