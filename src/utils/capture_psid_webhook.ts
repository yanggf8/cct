/**
 * Facebook PSID Capture Webhook Server
 * Node.js Express server for capturing Facebook Page Scoped IDs
 */

import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const app = express();
app.use(express.json());

const VERIFY_TOKEN = 'TFT_TRADING_WEBHOOK_2024';
const PORT = process.env.PORT || 8080;

/**
 * Facebook webhook verification endpoint
 */
app.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * Facebook webhook endpoint for capturing messages and PSIDs
 */
app.post('/webhook', (req: Request, res: Response) => {
  const body = req.body;

  console.log('\n📥 Webhook received:', JSON.stringify(body, null, 2));

  if (body.object === 'page') {
    body.entry?.forEach((entry: any) => {
      entry.messaging?.forEach((event: any) => {
        const senderId = event.sender?.id;
        const message = event.message;
        const timestamp = event.timestamp;

        if (senderId && message) {
          console.log('\n🎯 MESSAGE CAPTURED!');
          console.log('=' + '='.repeat(50));
          console.log('📋 Sender PSID:', senderId);
          console.log('💬 Message Text:', message.text || 'No text');
          console.log('⏰ Timestamp:', new Date(timestamp).toLocaleString());
          console.log('🔧 USE THIS AS FACEBOOK_RECIPIENT_ID:', senderId);
          console.log('=' + '='.repeat(50));

          // Save PSID to a file for easy access
          const psidFilePath = path.join(process.cwd(), 'captured_psid.txt');
          fs.writeFileSync(psidFilePath, senderId, 'utf8');
          console.log('💾 PSID saved to captured_psid.txt');
        }
      });
    });
  }

  res.status(200).send('EVENT_RECEIVED');
});

/**
 * Start the webhook server
 */
app.listen(PORT, () => {
  console.log('🚀 Facebook Webhook Server running on port', PORT);
  console.log('🔗 Webhook URL: http://localhost:' + PORT + '/webhook');
  console.log('🔑 Verify Token:', VERIFY_TOKEN);
  console.log('\n📱 Next Steps:');
  console.log('1. Expose this server publicly (use ngrok: "npx ngrok http 8080")');
  console.log('2. Set up Facebook webhook with the ngrok URL');
  console.log('3. Send a message to your Facebook page');
  console.log('4. Your PSID will be captured and displayed here');
});

export default app;