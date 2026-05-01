import { get, post, patch, setToken } from '../lib/api-client.mjs';
import { state as authState } from './01-signup-login.mjs';
import { state as swapState } from './03-swap-request.mjs';

export async function run() {
  const swapRequestId = swapState.swapRequestId;
  if (!swapRequestId) {
    console.log('    SKIP: no swap request from test 03');
    return;
  }

  // Send message as user2 (swap requester)
  setToken(swapState.user2Token);
  const msgForm = new FormData();
  msgForm.append('message', 'Hi! When can I pick up the book?');

  const send1 = await post(`/api/v1/swap-requests/${swapRequestId}/chat`, msgForm);
  if (send1.status !== 201 && send1.status !== 200) {
    throw new Error(`Send message failed: ${send1.status} ${send1.text?.substring(0, 200)}`);
  }
  console.log('    user2 sent message');

  // Send reply as user1 (book owner)
  setToken(authState.token);
  const replyForm = new FormData();
  replyForm.append('message', 'Tomorrow afternoon works for me!');

  const send2 = await post(`/api/v1/swap-requests/${swapRequestId}/chat`, replyForm);
  if (send2.status !== 201 && send2.status !== 200) {
    throw new Error(`Send reply failed: ${send2.status} ${send2.text?.substring(0, 200)}`);
  }
  console.log('    user1 sent reply');

  // Get chat history as user1
  const chatRes = await get(`/api/v1/swap-requests/${swapRequestId}/chat`);
  if (chatRes.status !== 200) {
    throw new Error(`Get chat failed: ${chatRes.status} ${chatRes.text?.substring(0, 200)}`);
  }

  const messages = chatRes.json;
  if (!Array.isArray(messages) || messages.length < 2) {
    throw new Error(`Expected at least 2 messages, got ${messages?.length}`);
  }
  console.log(`    chat history OK (${messages.length} messages)`);

  // Verify message content and ownMessage flag
  const user2Msg = messages.find(m => m.message === 'Hi! When can I pick up the book?');
  const user1Msg = messages.find(m => m.message === 'Tomorrow afternoon works for me!');

  if (!user2Msg) throw new Error('User2 message not found in chat history');
  if (!user1Msg) throw new Error('User1 message not found in chat history');

  // When viewed as user1: user1's message has ownMessage=true
  if (user1Msg.ownMessage !== true) {
    throw new Error(`Expected user1 msg ownMessage=true, got ${user1Msg.ownMessage}`);
  }
  if (user2Msg.ownMessage !== false) {
    throw new Error(`Expected user2 msg ownMessage=false, got ${user2Msg.ownMessage}`);
  }
  console.log('    ownMessage flags correct');

  // Mark as read (as user2)
  setToken(swapState.user2Token);
  const readRes = await patch(`/api/v1/swap-requests/${swapRequestId}/chat/read`);
  if (readRes.status !== 200 && readRes.status !== 204) {
    throw new Error(`Mark read failed: ${readRes.status} ${readRes.text?.substring(0, 200)}`);
  }
  console.log('    mark as read OK');

  // Restore original token
  setToken(authState.token);
}
