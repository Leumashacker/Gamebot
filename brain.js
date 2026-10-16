// The "brain": turns a friend's message into the bot's reply.
// No WhatsApp code in here, so it can be tested on its own (npm test).

const config = require('./config');
const games = require('./games');
const story = require('./story');

const MENU = [
  ['guess', games.guess.title],
  ['rps', games.rps.title],
  ['trivia', games.trivia.title],
  ['scramble', games.scramble.title],
  ['ttt', games.ttt.title],
  ['story', '📖 Mystery Story'],
];

const KEYWORDS = {
  guess: 'guess',
  rock: 'rps',
  rps: 'rps',
  trivia: 'trivia',
  quiz: 'trivia',
  scramble: 'scramble',
  tictactoe: 'ttt',
  'tic-tac-toe': 'ttt',
  ttt: 'ttt',
  story: 'story',
};

function menuText() {
  return (
    '*What shall we do?* Send a number:\n\n' +
    MENU.map((m, i) => `${i + 1}. ${m[1]}`).join('\n') +
    '\n\nSend *menu* any time to come back here, or *stop* to mute me.'
  );
}

function greeting(name) {
  return (
    `Hey${name ? ' ' + name : ''}! 👋 ${config.ownerName} is offline right now, but I'm their bot buddy ` +
    `and I'll keep you company until they're back. They'll see your message later!\n\n` +
    menuText()
  );
}

function pickActivity(cmd) {
  if (/^\d+$/.test(cmd)) {
    const n = parseInt(cmd, 10);
    return n >= 1 && n <= MENU.length ? MENU[n - 1][0] : null;
  }
  for (const [kw, key] of Object.entries(KEYWORDS)) {
    const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(cmd)) return key;
  }
  return null;
}

// s    = the friend's session object (see state.js)
// opts = { name, first }  first = true when this is their first message in a while
function respond(s, raw, opts = {}) {
  const text = (raw || '').trim();
  const cmd = text.toLowerCase();
  if (opts.name && !s.name) s.name = opts.name;

  if (cmd === 'stop' || cmd === 'unsubscribe') {
    s.optedOut = true;
    s.game = null;
    s.storyNode = null;
    return "No problem, I'll go quiet. 🙏 Send *start* whenever you want to play again.";
  }

  if (['menu', 'quit', 'exit', 'back'].includes(cmd)) {
    s.game = null;
    s.storyNode = null;
    return menuText();
  }

  if (s.game && !games[s.game.name]) s.game = null; // stale state guard
  if (s.game) {
    const r = games[s.game.name].play(s, text);
    let out = r.text;
    if (r.done) {
      s.game = null;
      out += '\n\nPlay again? Send *menu* to pick a game.';
    }
    return out;
  }

  if (s.storyNode) return story.choose(s, text, config.ownerName).text;

  const key = pickActivity(cmd);
  if (key) {
    const title = key === 'story' ? 'Mystery Story' : games[key].title;
    if (!s.played.includes(title)) s.played.push(title);
    return key === 'story' ? story.start(s, config.ownerName) : games[key].start(s);
  }

  if (opts.first) return greeting(s.name);
  return "I didn't catch that 🙂\n\n" + menuText();
}

module.exports = { respond, menuText, greeting };
