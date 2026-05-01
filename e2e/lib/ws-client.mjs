import WebSocket from 'ws';

export function connectWs(userId, token) {
  const WS_URL = process.env.WS_BASE_URL || 'ws://localhost:8080';
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws?token=${token}&userId=${userId}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('WebSocket connect timeout')), 10000);
  });
}

export function waitForMessage(ws, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket message timeout')), timeoutMs);
    ws.on('message', (data) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString()));
      } catch {
        resolve(data.toString());
      }
    });
  });
}
