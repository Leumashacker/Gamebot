// Choose-your-own-adventure. Friends reply with 1 or 2.
// {owner} is replaced with the owner's name from config.js.
// To add your own story, edit NODES: each node has `text` and either `choices` or `end: true`.

const NODES = {
  start: {
    text: "🕵️ *The Case of the Silent Phone*\n\nThe group chat is in panic: {owner} has been offline for HOURS. You're the detective. Your clues: a half-eaten mandazi 🍩 on the desk, and faint music coming from downstairs.\n\nWhere do you look first?",
    choices: [['Follow the music', 'stairs'], ['Inspect the desk', 'desk']],
  },
  stairs: {
    text: 'You creep down to the basement. A door marked *STUDIO* glows red. Next to it, a dusty vent is humming mysteriously.',
    choices: [['Open the studio door', 'studio'], ['Peek into the vent', 'vent']],
  },
  desk: {
    text: "The mandazi is still warm! Under the plate is a sticky note: _'Gone to meet the Wi-Fi spirit. Back soon.'_ Charger cables lead toward the window and the kitchen.",
    choices: [['Follow the cables to the window', 'window'], ['Follow them to the kitchen', 'kitchen']],
  },
  studio: {
    text: "You open the door. {owner} is wearing headphones, recording the world's most dramatic song about… Wi-Fi buffering 🎤. Their phone is face-down on silent.",
    choices: [['Grab the second mic and join in', 'e_singer'], ['Tap their shoulder', 'e_messenger']],
  },
  vent: {
    text: "You pull off the vent cover. Inside: three phone chargers, a sleeping cat 🐈, and a spare phone at 1% battery. The cat opens one eye.",
    choices: [['Plug in the phone', 'e_charge'], ['Pet the cat', 'e_cat']],
  },
  window: {
    text: "Outside, {owner}'s phone dangles from a string above the garden, hunting for a single bar of signal 📶. A neighbour watches in amazement.",
    choices: [['Pull the string', 'e_pull'], ['Ask the neighbour', 'e_neighbour']],
  },
  kitchen: {
    text: "{owner} is on a cooking livestream, flour everywhere, phone propped against the sugar jar on Do Not Disturb. The pot starts to bubble over! 🍲",
    choices: [['Save the pot!', 'e_pot'], ['Take a photo first', 'e_photo']],
  },

  e_singer: { end: true, text: 'You belt out the chorus together. The recording goes straight to the group chat and is quoted for weeks.\n\n🎤 *ENDING: The Backup Singer*' },
  e_messenger: { end: true, text: "{owner} jumps, drops the mic, spots a pile of missed messages and gasps, \"I'll reply soon, promise!\"\n\n📱 *ENDING: The Messenger*" },
  e_charge: { end: true, text: "The spare phone wakes up to 312 notifications. The cat nods approvingly.\n\n🐈 *ENDING: The Cat's Hero*" },
  e_cat: { end: true, text: "The cat purrs, the vent rumbles, and a hidden panel opens onto {owner}'s secret snack stash.\n\n🍪 *ENDING: The Snack Discoverer*" },
  e_pull: { end: true, text: "The phone swings into your hands with one bar of signal and a message: \"STOP TOUCHING MY ANTENNA!\" 😂\n\n📡 *ENDING: The Antenna Thief*" },
  e_neighbour: { end: true, text: "\"Oh, they do this all the time,\" says the neighbour. \"The signal is best near the mango tree.\" Mystery solved.\n\n🥭 *ENDING: Local Wisdom*" },
  e_pot: { end: true, text: "You rescue the pot just in time. The livestream chat explodes: \"WHO IS THAT HERO?!\"\n\n🍲 *ENDING: The Kitchen Hero*" },
  e_photo: { end: true, text: 'You snap the photo just as the pot erupts. It becomes the most viral picture in the family group.\n\n📸 *ENDING: The Paparazzo*' },
};

const fill = (t, owner) => t.replace(/\{owner\}/g, owner);

function render(id, owner) {
  const n = NODES[id];
  let out = fill(n.text, owner);
  if (n.end) return out + '\n\nThanks for playing! Send *story* to replay or *menu* for more games.';
  return out + '\n\n' + n.choices.map((c, i) => `${i + 1}️⃣ ${c[0]}`).join('\n');
}

function start(s, owner) {
  s.storyNode = 'start';
  return render('start', owner);
}

// Returns { text, done }
function choose(s, input, owner) {
  const node = NODES[s.storyNode];
  const n = parseInt(input, 10);
  if (!node || !node.choices || !(n >= 1 && n <= node.choices.length)) {
    return { text: `Reply with ${node && node.choices ? node.choices.map((_, i) => i + 1).join(' or ') : '1 or 2'} to choose (or *menu* to quit).` };
  }
  s.storyNode = node.choices[n - 1][1];
  const next = NODES[s.storyNode];
  const text = render(s.storyNode, owner);
  if (next.end) { s.storyNode = null; return { text, done: true }; }
  return { text };
}

module.exports = { start, choose, NODES };
