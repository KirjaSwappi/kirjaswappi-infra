import { execSync } from 'node:child_process';
import { get, post, put, setToken } from '../lib/api-client.mjs';
import { state as authState } from './01-signup-login.mjs';
import { state as bookState } from './02-book-crud.mjs';

export const state = {};

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
  state.user2Token = user2Token;
  state.user2Id = user2Id;

  // Get bookId from test 02 state, or look it up
  let bookId = bookState.bookId;
  if (!bookId) {
    setToken(authState.token);
    const booksRes = await get(`/api/v1/users/${authState.userId}/books`);
    const books = booksRes.json?._embedded?.books || [];
    if (booksRes.status !== 200 || books.length === 0) {
      console.log('    SKIP: no books found for swap test');
      return;
    }
    bookId = books[0].id;
  }

  // Debug: verify book ownership before swap request
  setToken(authState.token);
  const bookCheck = await get(`/api/v1/books/${bookId}`);
  console.log(`    book owner: ${bookCheck.json?.ownerId || bookCheck.json?.owner?.id || 'unknown'}, receiver (user1): ${authState.userId}`);

  // Debug: check user's books field directly in MongoDB
  const checkBooksEval = `JSON.stringify(db.users.findOne({_id:ObjectId('${authState.userId}')}, {books:1}))`;
  const checkBooksCmd = `docker compose -f ${composeFile} exec -T mongodb mongosh "mongodb://root:rootpass@localhost:27017/kirjaswappi_e2e?authSource=admin" --quiet --eval "${checkBooksEval}"`;
  try {
    const userDoc = execSync(checkBooksCmd, { stdio: 'pipe' }).toString().trim();
    console.log(`    user doc books field: ${userDoc.substring(0, 200)}`);
  } catch (err) {
    console.log(`    could not query user doc: ${err.message?.substring(0, 100)}`);
  }

  // Send swap request as user2
  setToken(user2Token);
  const swapReq = await post('/api/v1/swap-requests', {
    senderId: user2Id,
    receiverId: authState.userId,
    bookIdToSwapWith: bookId,
    swapType: 'GiveAway',
    askForGiveaway: true,
    note: 'Hi, I would love this book!',
  });

  if (swapReq.status !== 201 && swapReq.status !== 200) {
    throw new Error(`Swap request failed: ${swapReq.status} ${swapReq.text?.substring(0, 300)}`);
  }

  const swapRequestId = swapReq.json?.id;
  state.swapRequestId = swapRequestId;
  console.log(`    swap request created: ${swapRequestId}`);

  // Verify initial status is Pending
  if (swapReq.json?.swapStatus !== 'Pending') {
    throw new Error(`Expected Pending status, got: ${swapReq.json?.swapStatus}`);
  }
  console.log('    status: Pending');

  // Accept swap as user1 (book owner)
  setToken(authState.token);
  const acceptRes = await put(`/api/v1/swap-requests/${swapRequestId}/status`, {
    status: 'Accepted',
  });

  if (acceptRes.status !== 200) {
    throw new Error(`Accept swap failed: ${acceptRes.status} ${acceptRes.text?.substring(0, 200)}`);
  }
  console.log('    status: Accepted');

  // Complete swap as user1
  const completeRes = await put(`/api/v1/swap-requests/${swapRequestId}/status`, {
    status: 'Completed',
  });

  if (completeRes.status !== 200) {
    throw new Error(`Complete swap failed: ${completeRes.status} ${completeRes.text?.substring(0, 200)}`);
  }
  console.log('    status: Completed');

  // Restore original user token
  setToken(authState.token);
}
