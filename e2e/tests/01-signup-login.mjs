import { execSync } from 'node:child_process';
import { post, setToken } from '../lib/api-client.mjs';

export const state = {};

export async function run() {
  const email = `e2e-${Date.now()}@test.local`;
  const password = 'TestPass1!';

  // 1. Signup
  const signup = await post('/api/v1/users/signup', {
    firstName: 'E2E',
    lastName: 'Tester',
    email,
    password,
    confirmPassword: password,
  }, { skipAuth: true });

  if (signup.status !== 201) {
    throw new Error(`Signup failed: ${signup.status} ${signup.text}`);
  }
  console.log('    signup OK');

  // 2. Bypass OTP: mark email as verified directly in MongoDB
  const mongoCmd = `mongosh "mongodb://root:rootpass@localhost:27017/kirjaswappi_e2e?authSource=admin" --quiet --eval "db.users.updateOne({email:'${email}'},{\\$set:{emailVerified:true}})"`;
  try {
    execSync(mongoCmd, { stdio: 'pipe' });
  } catch {
    // If mongosh isn't on host, try via docker
    execSync(
      `docker compose -f docker-compose.ci.yml exec -T mongodb mongosh "mongodb://root:rootpass@localhost:27017/kirjaswappi_e2e?authSource=admin" --quiet --eval "db.users.updateOne({email:'${email}'},{\\$set:{emailVerified:true}})"`,
      { stdio: 'pipe' }
    );
  }
  console.log('    email verified (MongoDB bypass)');

  // 3. Login
  const login = await post('/api/v1/users/login', { email, password }, { skipAuth: true });

  if (login.status !== 200) {
    throw new Error(`Login failed: ${login.status} ${login.text}`);
  }

  const { userToken, userRefreshToken } = login.json;
  if (!userToken || !userRefreshToken) {
    throw new Error(`Login response missing tokens: ${JSON.stringify(login.json)}`);
  }
  setToken(userToken);
  state.token = userToken;
  state.refreshToken = userRefreshToken;
  state.userId = login.json.id;
  state.email = email;
  console.log('    login OK');

  // 4. Token refresh
  const refresh = await post('/api/v1/users/refresh-token', {
    userRefreshToken,
  }, { skipAuth: true });

  if (refresh.status !== 200) {
    throw new Error(`Refresh failed: ${refresh.status} ${refresh.text}`);
  }

  const newToken = refresh.json.userToken;
  if (!newToken) {
    throw new Error(`Refresh response missing token: ${JSON.stringify(refresh.json)}`);
  }
  setToken(newToken);
  state.token = newToken;
  state.refreshToken = refresh.json.userRefreshToken || state.refreshToken;
  console.log('    token refresh OK');
}
