import { waitForHealthy } from './lib/wait-for-healthy.mjs';

const tests = [
  { name: 'Signup + Login + Token Refresh', file: './tests/01-signup-login.mjs' },
  { name: 'Book CRUD', file: './tests/02-book-crud.mjs' },
  { name: 'Swap Request', file: './tests/03-swap-request.mjs' },
  { name: 'WebSocket Notifications', file: './tests/04-notifications.mjs' },
];

async function main() {
  console.log('=== KirjaSwappi E2E Integration Tests ===\n');

  console.log('[1/2] Waiting for services to be healthy...');
  await waitForHealthy();
  console.log('');

  console.log('[2/2] Running tests...\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const test of tests) {
    process.stdout.write(`  ${test.name}... `);
    try {
      const mod = await import(test.file);
      await mod.run();
      passed++;
      console.log('PASS');
    } catch (err) {
      if (err.message?.startsWith('SKIP')) {
        skipped++;
        console.log(`SKIP: ${err.message}`);
      } else {
        failed++;
        console.log(`FAIL: ${err.message}`);
        if (process.env.DEBUG) {
          console.error(err.stack);
        }
      }
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${skipped} skipped ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
