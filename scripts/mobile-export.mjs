import { spawnSync } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = path.join(repositoryRoot, 'apps', 'mobile');
const expoCli = path.join(repositoryRoot, 'node_modules', 'expo', 'bin', 'cli');

export function exportMobile(platform, spawnSyncImpl = spawnSync) {
  if (platform !== 'android' && platform !== 'ios') {
    throw new Error('Mobile export platform must be android or ios.');
  }

  const outputDir = path.join('.expo', 'verification', platform);
  const result = spawnSyncImpl(process.execPath, [
    expoCli,
    'export',
    '--platform',
    platform,
    '--output-dir',
    outputDir,
  ], {
    cwd: mobileRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_API_URL: 'https://api.example.invalid',
      NODE_ENV: 'production',
    },
  });

  if (result.error) throw result.error;
  if (result.signal) {
    console.error(`Expo export was terminated by ${result.signal}.`);
    return 1;
  }
  return result.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = exportMobile(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Mobile export failed.');
    process.exitCode = 1;
  }
}
