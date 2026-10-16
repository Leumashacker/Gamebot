// Offline checks for the game/story logic. Run with: npm test
const assert = require('assert');
const brain = require('./brain');
const story = require('./story');
const config = require('./config');

const fresh = () => ({ name: null, game: null, storyNode: null, greeted: false, optedOut: false, played: [] });
const say = (s, t, o = {}) => brain.respond(s, t, o);

// greeting + menu
let s = fresh();
let out = say(s, 'hi', { name: 'Amina', first: true });
assert(out.includes('Amina') && out.includes('1.') && out.includes(config.ownerName), 'greeting');

// guess the number
for (let run = 0; run < 3; run++) {
  s = fresh();
  say(s, '1');
  assert(s.game && s.game.name === 'guess');
  say(s, 'abc'); // invalid input must not crash or use a try
  assert(s.game.tries === 0);
  out = say(s, String(s.game.n));
  assert(out.includes('Yes') && s.game === null, 'guess win');
}

// rock paper scissors ends eventually
s = fresh();
say(s, '2');
for (let i = 0; i < 200 && s.game; i++) say(s, 'rock');
assert(s.game === null, 'rps ends');

// trivia: 5 questions
s = fresh();
say(s, 'trivia');
for (let i = 0; i < 5; i++) out = say(s, 'a');
assert(s.game === null && out.includes('Final score'), 'trivia ends');

// scramble: answer from state
s = fresh();
say(s, '4');
while (s.game) out = say(s, s.game.rounds[s.game.i][0]);
assert(out.includes('3/3'), 'scramble perfect score');

// tic-tac-toe plays to a finish
s = fresh();
say(s, '5');
for (let i = 0; i < 9 && s.game; i++) {
  const free = s.game.board.findIndex((v) => !v);
  say(s, String(free + 1));
}
assert(s.game === null, 'ttt ends');

// story: always pick 1, reach an ending
s = fresh();
out = say(s, '6');
assert(out.includes('Case of the Silent Phone') && !out.includes('{owner}'));
for (let i = 0; i < 10 && s.storyNode; i++) out = say(s, '1');
assert(s.storyNode === null && out.includes('ENDING'), 'story ending');

// every story choice points at a real node, no stray placeholders
for (const [id, n] of Object.entries(story.NODES)) {
  assert(!/\{(?!owner\})/.test(n.text), `bad placeholder in ${id}`);
  for (const [, target] of n.choices || []) assert(story.NODES[target], `${id} → missing ${target}`);
}

// menu / stop mid-game
s = fresh();
say(s, '1');
assert(say(s, 'menu').includes('What shall we do'), 'menu');
assert(s.game === null);
say(s, '3');
say(s, 'stop');
assert(s.optedOut && s.game === null, 'stop');

// unknown text after greeting
s = fresh();
assert(say(s, 'whatever').includes("didn't catch"), 'fallback');

console.log('All tests passed ✅');
