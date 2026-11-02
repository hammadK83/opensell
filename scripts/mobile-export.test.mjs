import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { exportMobile } from './mobile-export.mjs';

test('mobile export verification propagates a failing child process', () => {
  const result = exportMobile('android', (executable, _args, options) => spawnSync(
    executable,
    ['-e', 'process.exit(23)'],
    { ...options, stdio: 'ignore' },
  ));
  assert.equal(result, 23);
});

test('mobile export rejects non-native platforms', () => {
  assert.throws(() => exportMobile('web', () => assert.fail('should not spawn Expo')));
});
