// Simple webhook to capture your PSID when you message the page
import express, { Request, Response } from 'express';

const app = express();

app.use(express.json());

// Webhook verification (Facebook requires this)
app.get('/webhook', (req: Request, res: Response) => {
  const VERIFY_TOKEN = 'TFT_TRADING_WEBHOOK';
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Capture incoming messages and extract PSID
app.post('/webhook', (req: Request, res: Response) => {
  const body = req.body as any;

  if (body.object === 'page') {
    body.entry.forEach((entry: any) => {
      const messaging = entry.messaging;
      if (messaging) {
        messaging.forEach((event: any) => {
          const senderId = event.sender.id;
          const message = event.message;

          console.log('\n🎯 NEW MESSAGE RECEIVED!');
          console.log('📋 Sender PSID:', senderId);
          console.log('💬 Message:', message?.text || 'No text');
          console.log('⏰ Time:', new Date().toLocaleString());
          console.log('\n🔧 Use this PSID as FACEBOOK_RECIPIENT_ID:', senderId);
          console.log('=' + '='.repeat(50));
        });
      }
    });
  }

  res.status(200).send('EVENT_RECEIVED');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎯 PSID Capture Webhook running on port ${PORT}`);
  console.log(`📱 Setup: Message your Facebook Page to capture PSID`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
});