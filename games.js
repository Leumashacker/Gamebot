// Mini-games. Each game has start(s) and play(s, input).
// `s` is the friend's session object; the game keeps its state in s.game.
// play() returns { text, done? }.

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

// ---------- Guess the number ----------
const guess = {
  title: '🔢 Guess the Number',
  start(s) {
    s.game = { name: 'guess', n: 1 + rnd(100), tries: 0 };
    return "🔢 *Guess the Number*\nI'm thinking of a number from 1 to 100. You have 7 tries. Go!";
  },
  play(s, input) {
    const g = s.game;
    const n = parseInt(input, 10);
    if (Number.isNaN(n)) return { text: 'Send me a number between 1 and 100 (or *menu* to quit).' };
    g.tries++;
    if (n === g.n) {
      return { text: `🎉 Yes! It was ${g.n}. You got it in ${g.tries} ${g.tries === 1 ? 'try' : 'tries'}!`, done: true };
    }
    if (g.tries >= 7) return { text: `😅 Out of tries! It was ${g.n}.`, done: true };
    return { text: `${n < g.n ? '📈 Higher' : '📉 Lower'}! (${7 - g.tries} tries left)` };
  },
};

// ---------- Rock paper scissors ----------
const rps = {
  title: '✊ Rock Paper Scissors',
  start(s) {
    s.game = { name: 'rps', you: 0, bot: 0 };
    return '✊✋✌️ *Rock Paper Scissors* – first to 3 wins!\nSend *rock*, *paper* or *scissors* (or r / p / s).';
  },
  play(s, input) {
    const map = { r: 'rock', rock: 'rock', p: 'paper', paper: 'paper', s: 'scissors', scissors: 'scissors' };
    const you = map[input.toLowerCase()];
    if (!you) return { text: 'Send rock, paper or scissors (r / p / s).' };
    const bot = pick(['rock', 'paper', 'scissors']);
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const emoji = { rock: '✊', paper: '✋', scissors: '✌️' };
    const g = s.game;
    let line;
    if (you === bot) line = '🤝 Draw';
    else if (beats[you] === bot) { g.you++; line = '✅ You win this round'; }
    else { g.bot++; line = '❌ I win this round'; }
    const text = `You ${emoji[you]} vs Me ${emoji[bot]}\n${line}\nScore: You ${g.you} – ${g.bot} Me`;
    if (g.you >= 3) return { text: text + '\n\n🏆 You won the match!', done: true };
    if (g.bot >= 3) return { text: text + '\n\n🤖 I won the match!', done: true };
    return { text };
  },
};

// ---------- Trivia ----------
const BANK = [
  { q: 'What is the capital of Kenya?', o: ['Mombasa', 'Nairobi', 'Kisumu', 'Nakuru'], a: 1 },
  { q: 'Which planet is known as the Red Planet?', o: ['Venus', 'Jupiter', 'Mars', 'Mercury'], a: 2 },
  { q: 'What is the highest mountain in Africa?', o: ['Mount Kenya', 'Kilimanjaro', 'Mount Elgon', 'Atlas'], a: 1 },
  { q: 'How many continents are there?', o: ['5', '6', '7', '8'], a: 2 },
  { q: 'Which is the largest ocean?', o: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], a: 3 },
  { q: 'In what year did Kenya gain independence?', o: ['1960', '1963', '1965', '1970'], a: 1 },
  { q: 'What is the chemical symbol for gold?', o: ['Au', 'Ag', 'Gd', 'Go'], a: 0 },
  { q: 'Who painted the Mona Lisa?', o: ['Michelangelo', 'Van Gogh', 'Leonardo da Vinci', 'Picasso'], a: 2 },
  { q: 'How many players per side are on the pitch in football (soccer)?', o: ['9', '10', '11', '12'], a: 2 },
  { q: 'What is the fastest land animal?', o: ['Lion', 'Cheetah', 'Leopard', 'Gazelle'], a: 1 },
];
const LETTERS = ['A', 'B', 'C', 'D'];

function triviaQuestion(g) {
  const q = BANK[g.qs[g.i]];
  const opts = q.o.map((o, i) => `${LETTERS[i]}) ${o}`).join('\n');
  return `*Question ${g.i + 1}/${g.qs.length}*\n${q.q}\n${opts}`;
}

const trivia = {
  title: '🧠 Trivia (5 questions)',
  start(s) {
    s.game = { name: 'trivia', qs: shuffle(BANK.map((_, i) => i)).slice(0, 5), i: 0, score: 0 };
    return '🧠 *Trivia time!* Answer with A, B, C or D.\n\n' + triviaQuestion(s.game);
  },
  play(s, input) {
    const g = s.game;
    const t = input.trim().toLowerCase();
    let idx = LETTERS.findIndex((l) => l.toLowerCase() === t);
    if (idx === -1 && /^[1-4]$/.test(t)) idx = parseInt(t, 10) - 1;
    if (idx === -1) return { text: 'Answer with A, B, C or D (or *menu* to quit).' };
    const q = BANK[g.qs[g.i]];
    let msg;
    if (idx === q.a) { g.score++; msg = '✅ Correct!'; }
    else msg = `❌ Nope — it was ${LETTERS[q.a]}) ${q.o[q.a]}`;
    g.i++;
    if (g.i >= g.qs.length) {
      const verdict = g.score >= 4 ? '🏆 Genius!' : g.score >= 2 ? '👏 Not bad!' : '😅 Better luck next time!';
      return { text: `${msg}\n\nFinal score: *${g.score}/${g.qs.length}* ${verdict}`, done: true };
    }
    return { text: `${msg}\n\n${triviaQuestion(g)}` };
  },
};

// ---------- Word scramble ----------
const WORDS = [
  ['elephant', '🐘 a very big African animal'],
  ['nairobi', '🏙️ a capital city'],
  ['football', '⚽ a popular sport'],
  ['chocolate', '🍫 a sweet treat'],
  ['internet', '🌐 you are using it right now'],
  ['sunshine', '☀️ bright and warm'],
  ['mandazi', '🍩 a tasty East African snack'],
  ['whatsapp', '💬 this very app'],
];

function scrambleWord(w) {
  let s;
  do { s = shuffle(w.split('')).join(''); } while (s === w);
  return s;
}

function scramblePrompt(g) {
  const [w, hint] = g.rounds[g.i];
  if (!g.shown || g.shown.i !== g.i) g.shown = { i: g.i, text: scrambleWord(w) };
  return `*Word ${g.i + 1}/${g.rounds.length}:* ${g.shown.text.toUpperCase()}\nHint: ${hint}\n(send *skip* to pass)`;
}

const scramble = {
  title: '🔤 Word Scramble',
  start(s) {
    s.game = { name: 'scramble', rounds: shuffle(WORDS).slice(0, 3), i: 0, score: 0, tries: 0 };
    return '🔤 *Word Scramble!* Unscramble the letters.\n\n' + scramblePrompt(s.game);
  },
  play(s, input) {
    const g = s.game;
    const t = input.trim().toLowerCase();
    const answer = g.rounds[g.i][0];
    let msg = null;
    if (t === 'skip') { msg = `⏭️ Skipped — it was *${answer}*`; }
    else if (t === answer) { g.score++; msg = '✅ Correct!'; }
    else {
      g.tries++;
      if (g.tries < 3) return { text: `❌ Not quite (${3 - g.tries} ${3 - g.tries === 1 ? 'try' : 'tries'} left). Try again!` };
      msg = `❌ Out of tries — it was *${answer}*`;
    }
    g.i++;
    g.tries = 0;
    if (g.i >= g.rounds.length) {
      return { text: `${msg}\n\nFinal score: *${g.score}/${g.rounds.length}* 🎉`, done: true };
    }
    return { text: `${msg}\n\n${scramblePrompt(g)}` };
  },
};

// ---------- Tic-tac-toe ----------
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const NUMS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function winner(b) {
  for (const [x, y, z] of LINES) if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x];
  return b.every(Boolean) ? 'draw' : null;
}

function render(b) {
  return [0, 3, 6]
    .map((r) => [0, 1, 2].map((c) => {
      const v = b[r + c];
      return v === 'X' ? '❌' : v === 'O' ? '⭕' : NUMS[r + c];
    }).join(''))
    .join('\n');
}

function botMove(b) {
  const free = b.map((v, i) => (v ? null : i)).filter((i) => i !== null);
  const winningMove = (p) => {
    for (const i of free) {
      const c = [...b];
      c[i] = p;
      if (winner(c) === p) return i;
    }
    return null;
  };
  let m = winningMove('O');
  if (m === null) m = winningMove('X');
  if (m === null && free.includes(4)) m = 4;
  if (m === null) m = pick(free);
  return m;
}

const ttt = {
  title: '❌⭕ Tic-Tac-Toe',
  start(s) {
    s.game = { name: 'ttt', board: Array(9).fill(null) };
    return `❌⭕ *Tic-Tac-Toe* — you're ❌, I'm ⭕. Send a number 1-9.\n\n${render(s.game.board)}`;
  },
  play(s, input) {
    const b = s.game.board;
    const n = parseInt(input, 10);
    if (!(n >= 1 && n <= 9)) return { text: 'Send a number from 1 to 9 (or *menu* to quit).' };
    if (b[n - 1]) return { text: 'That square is taken — pick another one!' };
    b[n - 1] = 'X';
    let w = winner(b);
    if (!w) { b[botMove(b)] = 'O'; w = winner(b); }
    const board = render(b);
    if (w === 'X') return { text: `${board}\n\n🏆 You win!`, done: true };
    if (w === 'O') return { text: `${board}\n\n🤖 I win this one!`, done: true };
    if (w === 'draw') return { text: `${board}\n\n🤝 It's a draw!`, done: true };
    return { text: board };
  },
};

module.exports = { guess, rps, trivia, scramble, ttt };
