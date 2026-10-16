const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const store = require('./state');
const brain = require('./brain');

const { state } = store;
store.load();

// Every message the bot sends starts with an invisible character. That's how it tells
// its own messages apart from ones you type yourself.
const BOT = '​';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const digits = (s) => String(s).replace(/\D/g, '');
const isGroupish = (id) => id.endsWith('@g.us') || id.includes('broadcast') || id.endsWith('@newsletter');

const phone = digits(config.phoneNumber || '');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './data/session' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  // With a phone number set, log in with an 8-character code instead of a QR code.
  ...(phone
    ? { pairWithPhoneNumber: { phoneNumber: phone, showNotification: true, intervalMs: 180000 } }
    : {}),
});

const selfId = () => client.info.wid._serialized;

async function sendTo(id, text, typing = true) {
  try {
    if (typing) {
      const chat = await client.getChatById(id);
      await chat.sendStateTyping();
      const base = config.minDelayMs + Math.random() * (config.maxDelayMs - config.minDelayMs);
      await sleep(Math.min(base + text.length * 6, config.maxDelayMs + 2000));
    }
    await client.sendMessage(id, BOT + text);
  } catch (e) {
    console.error('Send failed:', e.message);
  }
}

const notifyOwner = (text) => sendTo(selfId(), text, false);

// ---------- away mode ----------
function startAway(hours) {
  state.away = true;
  state.awaySince = Date.now();
  state.awayUntil = hours > 0 ? Date.now() + hours * 3600 * 1000 : null;
  for (const c of Object.values(state.chats)) {
    c.msgsAway = 0;
    c.preview = null;
    c.played = [];
  }
  store.save();
}

function summary() {
  const active = Object.entries(state.chats).filter(([, c]) => c.msgsAway > 0);
  if (!active.length) return '👋 Welcome back! Nobody texted while you were away.';
  const lines = active.map(([id, c]) => {
    const num = digits(id.split('@')[0]);
    const played = c.played.length ? ` — played ${c.played.join(', ')}` : '';
    const last = (c.preview || '').slice(0, 60);
    return `• ${c.name || 'Unknown'} (+${num}): ${c.msgsAway} message${c.msgsAway === 1 ? '' : 's'}${played}\n   last: "${last}"`;
  });
  return `👋 Welcome back! While you were away:\n\n${lines.join('\n')}`;
}

async function endAway() {
  const text = summary();
  state.away = false;
  state.awayUntil = null;
  store.save();
  await notifyOwner(text);
}

// ---------- owner commands (send them in the "Message yourself" chat) ----------
const HELP = [
  '*Offline Buddy commands*',
  '!away on — friends get games & stories',
  '!away on 3 — same, switches off by itself after 3 hours',
  '!away off — stop, and get a summary of who texted',
  '!status — see current state',
  '!summary — who has texted so far',
  '!block 2547XXXXXXXX — never auto-reply to this number',
  '!unblock 2547XXXXXXXX',
].join('\n');

async function onOwnerCommand(text) {
  const [cmd, ...args] = text.slice(1).trim().split(/\s+/);
  switch ((cmd || '').toLowerCase()) {
    case 'help':
      return notifyOwner(HELP);
    case 'away': {
      const mode = (args[0] || '').toLowerCase();
      if (mode === 'on') {
        const hours = parseFloat(args[1]);
        startAway(Number.isFinite(hours) ? hours : 0);
        return notifyOwner(`😴 Away mode ON${hours > 0 ? ` for ${hours}h` : ''}. Friends who text will get games and a story.`);
      }
      if (mode === 'off') {
        if (!state.away) return notifyOwner('Away mode is already off.');
        return endAway();
      }
      return notifyOwner('Use *!away on* or *!away off*.');
    }
    case 'status': {
      const n = Object.values(state.chats).filter((c) => c.msgsAway > 0).length;
      const until = state.away && state.awayUntil ? ` (auto-off ${new Date(state.awayUntil).toLocaleTimeString()})` : '';
      return notifyOwner(`Away mode: ${state.away ? 'ON' : 'OFF'}${until}\nFriends texted this session: ${n}\nBlocked numbers: ${state.blocked.length}`);
    }
    case 'summary':
      return notifyOwner(summary());
    case 'block': {
      const n = digits(args[0] || '');
      if (!n) return notifyOwner('Usage: !block 2547XXXXXXXX');
      if (!state.blocked.includes(n)) state.blocked.push(n);
      store.save();
      return notifyOwner(`🚫 Won't auto-reply to +${n}.`);
    }
    case 'unblock': {
      const n = digits(args[0] || '');
      state.blocked = state.blocked.filter((x) => x !== n);
      store.save();
      return notifyOwner(`✅ +${n} can get auto-replies again.`);
    }
    default:
      return notifyOwner('Unknown command. Send *!help*.');
  }
}

// ---------- incoming messages from friends ----------
async function onIncoming(msg) {
  if (state.away && state.awayUntil && Date.now() > state.awayUntil) await endAway();
  if (!state.away) return;
  if (msg.fromMe || msg.isStatus || isGroupish(msg.from)) return;

  const number = digits(msg.from.split('@')[0]);
  if (state.blocked.includes(number)) return;
  if (config.allowedNumbers.length && !config.allowedNumbers.map(digits).includes(number)) return;

  const s = store.chat(msg.from);
  const now = Date.now();
  const text = msg.type === 'chat' ? msg.body : '';

  s.msgsAway++;
  s.preview = msg.type === 'chat' ? msg.body : `[${msg.type}]`;

  if (s.optedOut) {
    if (/^(start|menu|play)$/i.test(text.trim())) s.optedOut = false;
    else { store.save(); return; }
  }
  if (now < s.pausedUntil) { store.save(); return; } // you replied yourself recently

  s.sentTimes = s.sentTimes.filter((t) => now - t < 3600 * 1000);
  if (s.sentTimes.length >= config.maxRepliesPerHour) { store.save(); return; }

  const first = !s.greeted || now - s.lastSeen > config.greetAfterMs;
  const name = msg._data && msg._data.notifyName;
  const out = brain.respond(s, text, { name, first });

  s.greeted = true;
  s.lastSeen = now;
  if (out) s.sentTimes.push(now);
  store.save();
  if (out) await sendTo(msg.from, out);
}

// Handle each friend's messages one at a time so replies stay in order.
const queues = new Map();
client.on('message', (msg) => {
  const prev = queues.get(msg.from) || Promise.resolve();
  const next = prev.then(() => onIncoming(msg)).catch((e) => console.error('Handler error:', e));
  queues.set(msg.from, next);
});

// ---------- your own messages ----------
client.on('message_create', async (msg) => {
  try {
    if (!msg.fromMe) return;
    const body = msg.body || '';
    if (body.startsWith(BOT)) return; // sent by the bot itself
    const isSelfChat = msg.to === selfId() || msg.to === msg.from;
    if (isSelfChat) {
      if (body.trim().startsWith('!')) await onOwnerCommand(body.trim());
      return;
    }
    // You typed something to a friend: stay quiet in that chat for a while.
    if (state.away && !isGroupish(msg.to)) {
      store.chat(msg.to).pausedUntil = Date.now() + config.pauseOnOwnReplyMs;
      store.save();
    }
  } catch (e) {
    console.error('message_create error:', e);
  }
});

client.on('code', (code) => {
  console.log('\n==============================');
  console.log(`  Your WhatsApp pairing code: ${code}`);
  console.log('==============================');
  console.log('On your phone: WhatsApp → Settings → Linked devices → Link a device');
  console.log('→ "Link with phone number instead" → type the code above.\n');
  console.log('(A new code is generated every few minutes until you link.)\n');
});

client.on('qr', (qr) => {
  console.log('\nScan this QR code in WhatsApp → Settings → Linked devices → Link a device:\n');
  qrcode.generate(qr, { small: true });
});
client.on('authenticated', () => console.log('Authenticated.'));
client.on('auth_failure', (m) => { console.error('Auth failed:', m); process.exit(1); });
client.on('ready', () => {
  console.log('Bot is ready. Open the "Message yourself" chat and send !help');
});
client.on('disconnected', (reason) => {
  console.error('Disconnected:', reason);
  process.exit(1); // let pm2 / systemd restart us
});

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));

client.initialize();
