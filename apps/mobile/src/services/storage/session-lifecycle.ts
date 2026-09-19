import { tokenStorage } from './token.storage';

let generation = 0;
let storageQueue: Promise<void> = Promise.resolve();

export class StaleSessionError extends Error {
  constructor() {
    super('The session changed while this request was running.');
    this.name = 'StaleSessionError';
  }
}

export const getSessionGeneration = () => generation;

export function invalidateSession() {
  generation += 1;
}

export function assertCurrentSession(expected: number) {
  if (expected !== generation) throw new StaleSessionError();
}

function queueStorage<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation);
  storageQueue = result.then(() => {}, () => {});
  return result;
}

export function saveSessionTokens(accessToken: string, refreshToken: string, expected: number) {
  return queueStorage(async () => {
    assertCurrentSession(expected);
    try {
      await tokenStorage.setTokens(accessToken, refreshToken);
    } finally {
      // Native writes cannot be cancelled. Clear stale writes before a newer
      // session can save its credentials through this same queue.
      if (expected !== generation) await tokenStorage.clearTokens();
    }
    assertCurrentSession(expected);
  });
}

export function clearSessionTokens(expected: number) {
  return queueStorage(async () => {
    assertCurrentSession(expected);
    await tokenStorage.clearTokens();
    assertCurrentSession(expected);
  });
}
