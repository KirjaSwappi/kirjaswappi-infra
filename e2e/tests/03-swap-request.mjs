import { execSync } from 'node:child_process';
import { post, setToken } from '../lib/api-client.mjs';
import { state as authState } from './01-signup-login.mjs';

export async function run() {
  // Create a second user to be the swap requester
  const email2 = `e2e-user2-${Date.now()}@test.local`;
  const password2 = 'TestPass2!';

  const signup2 = await post('/api/v1/users/signup', {
    firstName: 'Swap',
    lastName: 'Requester',
    email: email2,
    password: password2,
    confirmPassword: password2,
  }, { skipAuth: true });

  if (signup2.status !== 201) {
    throw new Error(`Second user signup failed: ${signup2.status} ${signup2.text}`);
  }

  // Verify email
  const composeFile = process.env.COMPOSE_FILE || '../docker-compose.ci.yml';
  const mongoEval = `db.users.updateOne({email:'${email2}'},{\\$set:{isEmailVerified:true}})`;
  const verifyCmd = `docker compose -f ${composeFile} exec -T mongodb mongosh "mongodb://root:rootpass@localhost:27017/kirjaswappi_e2e?authSource=admin" --quiet --eval "${mongoEval}"`;
  execSync(verifyCmd, { stdio: 'pipe' });

  // Login as second user
  const login2 = await post('/api/v1/users/login', { email: email2, password: password2 }, { skipAuth: true });
  if (login2.status !== 200) {
    throw new Error(`Second user login failed: ${login2.status} ${login2.text}`);
  }
  console.log('    second user ready');

  const user2Token = login2.json.userToken;
  const user2Id = login2.json.id;

  // Create a swap request (user2 requests a swap with user1's book)
  // First we need a book from user1 — get books listed by user1
  setToken(authState.token);

  const { get } = await import('../lib/api-client.mjs');
  const booksRes = await get(`/api/v1/users/${authState.userId}/books`);

  if (booksRes.status !== 200 || !booksRes.json?.content?.length) {
    console.log('    SKIP: no books found for swap test (book-crud may have been skipped)');
    return;
  }

  const bookId = booksRes.json.content[0].id;

  // Send swap request as user2
  setToken(user2Token);
  const swapReq = await post('/api/v1/swap-requests', {
    senderId: user2Id,
    receiverId: authState.userId,
    bookIdToSwapWith: bookId,
    swapType: 'GIVE_AWAY',
    askForGiveaway: true,
  });

  if (swapReq.status !== 201 && swapReq.status !== 200) {
    throw new Error(`Swap request failed: ${swapReq.status} ${swapReq.text?.substring(0, 300)}`);
  }

  console.log(`    swap request created: ${swapReq.json?.id || 'OK'}`);

  // Restore original user token
  setToken(authState.token);
}
