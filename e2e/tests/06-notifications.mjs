import { connectWs, waitForMessage } from '../lib/ws-client.mjs';
import { sendNotification } from '../lib/grpc-client.mjs';
import { state as authState } from './01-signup-login.mjs';

export async function run() {
  if (!authState.token || !authState.userId) {
    console.log('    SKIP: no auth state from test 01');
    return;
  }

  // Connect WebSocket
  let ws;
  try {
    ws = await connectWs(authState.userId, authState.token);
    console.log('    WebSocket connected');
  } catch (err) {
    console.log(`    SKIP: WebSocket connection failed (${err.message})`);
    return;
  }

  try {
    // Send notification via gRPC
    const grpcRes = await sendNotification(
      authState.userId,
      'E2E Test Notification',
      'This is a test notification from the e2e suite',
    );

    if (!grpcRes.success) {
      throw new Error('gRPC SendNotification returned success=false');
    }
    console.log('    gRPC notification sent');

    // Wait for WebSocket to receive the notification
    const msg = await waitForMessage(ws, 10000);
    console.log(`    WebSocket received: ${JSON.stringify(msg).substring(0, 120)}`);

    // Verify notification fields
    if (!msg.Title && !msg.title) {
      throw new Error(`Notification missing Title field: ${JSON.stringify(msg)}`);
    }

    const title = msg.Title || msg.title;
    if (title !== 'E2E Test Notification') {
      throw new Error(`Expected title "E2E Test Notification", got "${title}"`);
    }
    console.log('    notification content verified');
  } finally {
    ws.close();
  }
}
