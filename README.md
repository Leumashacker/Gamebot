# Offline Buddy — a WhatsApp bot that entertains your friends while you're away

When you switch on **away mode**, anyone who texts you gets a friendly greeting and a menu:

1. 🔢 Guess the Number
2. ✊ Rock Paper Scissors
3. 🧠 Trivia (5 questions)
4. 🔤 Word Scramble
5. ❌⭕ Tic-Tac-Toe
6. 📖 Mystery Story (choose-your-own-adventure)

Each friend has their own game progress. When you're back, `!away off` sends you a summary of who texted and what they played.

It runs on **your own number** through WhatsApp Web (via [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)).

## Setup

You need Node.js 18+ and a computer (or server) that stays on while you're away.

```bash
npm install
OWNER_NAME="Your Name" PHONE_NUMBER=254712345678 npm start
```

Use your own WhatsApp number with country code, digits only. After a few seconds the terminal prints an **8-character pairing code**. On your phone open WhatsApp → Settings → Linked devices → Link a device → **Link with phone number instead**, and type the code. You only do this once; the session is saved in `data/session`.

If you leave `PHONE_NUMBER` out, the bot shows a QR code to scan instead.

## Controlling it

Open your **"Message yourself"** chat in WhatsApp and send:

| Command | What it does |
|---|---|
| `!away on` | Start entertaining friends |
| `!away on 3` | Same, but switches itself off after 3 hours |
| `!away off` | Stop, and send you a summary |
| `!status` | Current state |
| `!summary` | Who has texted so far |
| `!block 2547XXXXXXXX` | Never auto-reply to this number |
| `!unblock 2547XXXXXXXX` | Undo that |
| `!help` | List of commands |

Friends can send **menu** to return to the menu, or **stop** to mute the bot.

## How it behaves

- Replies only in one-to-one chats (never groups, statuses or broadcasts) and only while away mode is on.
- If you reply to a friend yourself, the bot stays quiet in that chat for 30 minutes.
- Replies come after a short "typing…" delay and are capped at 40 per friend per hour.
- Your own messages are untouched; bot messages start with an invisible character so it can tell them apart.

## Customising

- `config.js` — your name, a list of allowed numbers (empty = everyone), delays, rate limits.
- `story.js` — edit the `NODES` object to write your own story. Use `{owner}` for your name.
- `games.js` — add questions to the trivia `BANK` or words to `WORDS`.

Run `npm test` to check the game and story logic without connecting to WhatsApp.

## Keeping it running

The bot only works while the process is running.

```bash
npm install -g pm2
OWNER_NAME="Your Name" pm2 start bot.js --name offline-buddy
pm2 save
```

A cheap VPS works well. Chromium needs about 500 MB of RAM.

## ⚠️ Risk to know about

whatsapp-web.js is **not an official WhatsApp product**. WhatsApp's terms don't allow automated clients, and accounts that behave like bots can be restricted or banned. To lower the risk:

- keep the reply cap and typing delays in `config.js`;
- only use it with friends who message you first (it never starts conversations);
- consider setting `allowedNumbers` to a short list of close friends;
- avoid running it all day, every day. Use `!away on 3` for specific windows.

If you want zero ban risk, the official WhatsApp Business Cloud API needs a separate business number.

## Files

```
bot.js     WhatsApp connection, away mode, owner commands
brain.js   Decides what to reply (no WhatsApp code, so it's testable)
games.js   The five games
story.js   The adventure story
state.js   Saves progress to data/state.json
config.js  Settings
test.js    Offline tests
```
