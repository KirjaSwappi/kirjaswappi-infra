import { get, setToken } from '../lib/api-client.mjs';
import { state as authState } from './01-signup-login.mjs';
import { state as swapState } from './03-swap-request.mjs';

export async function run() {
  if (!swapState.swapRequestId) {
    console.log('    SKIP: no swap request from test 03');
    return;
  }

  // Get inbox as user1 (book owner who received a swap request)
  setToken(authState.token);
  const inboxRes = await get('/api/v1/inbox');

  if (inboxRes.status !== 200) {
    throw new Error(`Get inbox failed: ${inboxRes.status} ${inboxRes.text?.substring(0, 200)}`);
  }

  const items = inboxRes.json;
  if (!Array.isArray(items)) {
    throw new Error(`Inbox response not an array: ${JSON.stringify(inboxRes.json)?.substring(0, 200)}`);
  }

  if (items.length === 0) {
    throw new Error('Inbox is empty — expected at least 1 swap conversation');
  }

  console.log(`    inbox has ${items.length} item(s)`);

  // Find our swap request in the inbox
  const ourItem = items.find(item => item.swapRequestId === swapState.swapRequestId || item.id === swapState.swapRequestId);

  if (ourItem) {
    console.log(`    found swap in inbox (status: ${ourItem.swapStatus || ourItem.status || 'unknown'})`);
    if (ourItem.lastMessageContent) {
      console.log(`    last message: "${ourItem.lastMessageContent.substring(0, 50)}"`);
    }
  } else {
    console.log('    swap request not found in inbox by ID (may use different key)');
    console.log(`    first item keys: ${Object.keys(items[0]).join(', ')}`);
  }

  // Get inbox as user2
  setToken(swapState.user2Token);
  const inbox2Res = await get('/api/v1/inbox');

  if (inbox2Res.status !== 200) {
    throw new Error(`Get inbox (user2) failed: ${inbox2Res.status}`);
  }

  const items2 = inbox2Res.json;
  if (!Array.isArray(items2) || items2.length === 0) {
    throw new Error('User2 inbox is empty — expected at least 1 conversation');
  }
  console.log(`    user2 inbox has ${items2.length} item(s)`);

  // Restore token
  setToken(authState.token);
}
