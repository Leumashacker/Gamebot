const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'state.json');

const state = {
  away: false,
  awayUntil: null,
  awaySince: null,
  blocked: [],
  chats: {},
};

function load() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    if (fs.existsSync(FILE)) Object.assign(state, JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch (e) {
    console.error('Could not load saved state, starting fresh:', e.message);
  }
}

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
    } catch (e) {
      console.error('Could not save state:', e.message);
    }
  }, 300);
}

// One record per friend chat.
function chat(id) {
  if (!state.chats[id]) {
    state.chats[id] = {
      name: null,
      game: null,        // active game state, or null
      storyNode: null,   // current story node id, or null
      greeted: false,
      optedOut: false,
      pausedUntil: 0,
      lastSeen: 0,
      sentTimes: [],     // timestamps of recent bot replies (rate limit)
      msgsAway: 0,       // messages received during the current away session
      preview: null,     // last thing they said
      played: [],        // what they played during the current away session
    };
  }
  return state.chats[id];
}

module.exports = { state, load, save, chat };
