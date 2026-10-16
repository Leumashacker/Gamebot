// Edit these to taste.
module.exports = {
  // Name friends will see in the bot's greeting and in the story.
  // You can also run:  OWNER_NAME="Thaci" npm start
  ownerName: process.env.OWNER_NAME || 'Thaci',

  // YOUR WhatsApp number with country code, digits only (e.g. '254712345678').
  // When set, you link the bot by typing an 8-character code on your phone — no QR scan needed.
  // You can also run:  PHONE_NUMBER=254712345678 npm start
  phoneNumber: process.env.PHONE_NUMBER || '254728879825',

  // Leave empty to entertain everyone who texts you.
  // Or list numbers (country code, digits only) to restrict the bot to them, e.g. ['254712345678'].
  allowedNumbers: [],

  // Human-like typing delay before each reply (milliseconds).
  minDelayMs: 1200,
  maxDelayMs: 3500,

  // Safety valve: max bot replies per friend per hour (lowers ban risk, stops loops).
  maxRepliesPerHour: 40,

  // If you reply to a friend yourself, the bot stays quiet in that chat for this long.
  pauseOnOwnReplyMs: 30 * 60 * 1000,

  // Re-send the greeting if a friend comes back after this much silence.
  greetAfterMs: 6 * 60 * 60 * 1000,
};
