const express = require('express');
const multer = require('multer');
// Import FormData for constructing multipart requests.  This package
// must be installed with `npm install form-data`.
const FormData = require('form-data');
// Import node-fetch for making HTTP requests.  Install with
// `npm install node-fetch`.  If your Node version supports the global
// fetch API, you can omit this require.  node-fetch v3 is an ESM
// module, so when using CommonJS (require) its default export is
// exposed via the `.default` property.  Destructure `.default` to get
// the fetch function.
const fetch = require('node-fetch').default;
// In modern Node (>=18) fetch is globally available.  If using older
// versions, install node-fetch and import it here.

// Replace these with your real bot token and the chat ID of the group
// where messages about orders should be sent.  Never commit real
// tokens to version control.
const BOT_TOKEN = '8404834947:AAGALC15eABwthOSqBfR7F33mIwRgOZEhhI';
const CHAT_ID   = '-1002703949173';

const app = express();
const upload = multer();

// Serve static files (HTML, JS, CSS) from the project root so that the
// front‑end is available at the root URL.  This allows Express to
// deliver index.html and associated assets when someone visits `/`.
const path = require('path');
app.use(express.static(path.join(__dirname)));
// Explicitly handle the root URL by sending the index.html file.  Without
// this, visiting `/` would show “Cannot GET /”.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Allow cross-origin requests so that a static site served from a
// different port (e.g. http-server on port 8080) can send data to this
// API without CORS issues.  In production, restrict the origin as
// appropriate for your domain.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Accept form submissions at /api/order.  The form is expected to be a
// multipart/form-data request containing optional fields such as
// description, stars, price, username, recipientUsername, recipientId,
// buyerId and a file named 'screenshot'.  We don’t use the uploaded
// screenshot here but parsing it ensures that Multer processes the
// payload correctly.
app.post('/api/order', upload.single('screenshot'), async (req, res) => {
  const {
    description = '',
    stars = '',
    price = '',
    username = '',
    recipientUsername = '',
    recipientId = '',
    buyerId = ''
  } = req.body || {};

  // Determine what item is being purchased
  const item = stars ? `${stars} ⭐` : (description || 'товар');
  const amount = price ? Number(price).toLocaleString('ru-RU') + ' сум' : '';
  const purchaseTime = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });

  // Compose the message for Telegram
  let msg = '🛍️ Новая покупка\n\n';
  msg += `⏰ Время покупки: ${purchaseTime}\n`;
  msg += `🎁 Товар: ${item}\n`;
  if (description) msg += `📄 Описание: ${description}\n`;
  msg += `👤 Покупатель: @${username}`;
  if (buyerId) msg += ` (ID: ${buyerId})`;
  msg += '\n';
  if (recipientUsername) {
    msg += `🎯 Получатель: @${recipientUsername}`;
    if (recipientId) msg += ` (ID: ${recipientId})`;
    msg += '\n';
  }
  if (amount) msg += `💰 Сумма: ${amount}\n`;

  let sent = false;
  // If we have a screenshot, send it as a photo with caption.  Telegram
  // requires multipart/form-data for file uploads.
  if (req.file && BOT_TOKEN && CHAT_ID) {
    try {
      const form = new FormData();
      form.append('chat_id', CHAT_ID);
      form.append('caption', msg);
      // Provide filename and contentType so Telegram knows what type of
      // file is being uploaded.  Fallback to a generic name if
      // originalname is missing.
      form.append('photo', req.file.buffer, {
        filename: req.file.originalname || 'screenshot.png',
        contentType: req.file.mimetype || 'application/octet-stream'
      });
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });
      sent = true;
    } catch (err) {
      console.error('Failed to send photo to Telegram:', err);
    }
  }
  // Fallback: if sending the photo failed or no file was provided, send
  // a plain text message.
  if (!sent && BOT_TOKEN && CHAT_ID) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(msg)}`;
    try {
      await fetch(url);
    } catch (err) {
      console.error('Failed to send message to Telegram:', err);
    }
  }
  res.json({ success: true });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Order API server listening on port ${PORT}`);
});