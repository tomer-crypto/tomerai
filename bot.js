require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// Tomer Ai - למכור הדרכה ללקוחות
const VERIFY_TOKEN = 'zyyt1paembsg7itrnclo4';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = '0547002300';
const APP_SECRET = process.env.APP_SECRET;

// מעקב אחר משתמשים שכבר קיבלו הודעת פתיחה
const userSessions = new Set();

function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(req.rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  try {
    if (!verifySignature(req)) return res.sendStatus(403);
    const body = req.body;
    console.log('Received webhook:', JSON.stringify(body, null, 2));
    
    const changes = body.entry?.[0]?.changes?.[0];
    const messages = changes?.value?.messages || [];

    for (const msg of messages) {
      const from = msg.from;
      const text = (msg.text?.body || '').toLowerCase();
      const buttonReply = msg.interactive?.button_reply?.title;
      
      console.log(`Message from ${from}: text="${text}", button="${buttonReply}"`);
      
      // בדיקה אם זה משתמש חדש
      if (!userSessions.has(from)) {
        console.log(`New user: ${from}`);
        userSessions.add(from);
        await sendInteractiveButtons(from);
      } else if (text || buttonReply) {
        // משתמש קיים - תגובה לפי מילות מפתח
        let foundMatch = false;
        if ((text && text.includes('שלום')) || (buttonReply && buttonReply.includes('שלום'))) {
          console.log('Found match for template: שלום');
          foundMatch = true;
          await sendText(from, '🚀 בניית בוט זה קל! יש לי מדריכים חינמיים שיעזרו לך להתחיל. רוצה לראות?');
        }
        if ((text && text.includes('עזרה')) || (buttonReply && buttonReply.includes('עזרה'))) {
          console.log('Found match for template: עזרה');
          foundMatch = true;
          await sendText(from, '💡 אני כאן לעזור! במה נתקעת? ספר לי על הבעיה ואנסה לכוון אותך.');
        }
        if ((text && text.includes('משאבים')) || (buttonReply && buttonReply.includes('משאבים'))) {
          console.log('Found match for template: משאבים');
          foundMatch = true;
          await sendText(from, '📚 יש לי חומרים חינמיים: מדריכים, דוגמאות, וכלים. מה מעניין אותך?');
        }
        
        // אם לא נמצאה התאמה - שלח תגובת ברירת מחדל
        if (!foundMatch) {
          console.log(`No match found for: "${text || buttonReply}"`);
          await sendText(from, 'לא הבנתי 🤔\n\nנסה לשלוח אחת ממילות המפתח שלי, או כתוב "עזרה" לקבלת רשימה.');
        }
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('Webhook error:', e);
    res.sendStatus(500);
  }
});

async function sendInteractiveButtons(to) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  await axios.post(url, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: '👋 היי! ברוך הבא!\n\nלמכור הדרכה ללקוחות\n\nאיך אני יכול לעזור לך היום?'
      },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'btn1', title: '🚀 איך מתחילים?' } },
          { type: 'reply', reply: { id: 'btn2', title: '📚 מדריכים' } },
          { type: 'reply', reply: { id: 'btn3', title: '💡 עזרה' } }
        ]
      }
    }
  }, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
}

async function sendText(to, body) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  await axios.post(url, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body }
  }, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
}

app.listen(process.env.PORT || 3000, () => console.log('Tomer Ai Bot running'));