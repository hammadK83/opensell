import type { Db, Document, IndexDescription } from 'mongodb';

type RequiredIndex = {
  collection: string;
  key: Record<string, 1 | -1>;
  options: { name: string; unique?: true; sparse?: true; expireAfterSeconds?: 0 };
};

// Keep this list aligned with the indexes declared by the backend models.
export const requiredIndexes: readonly RequiredIndex[] = [
  { collection: 'users', key: { email: 1 }, options: { name: 'email_1', unique: true } },
  { collection: 'users', key: { 'verificationEmailJob.nextAttemptAt': 1 }, options: { name: 'verificationEmailJob.nextAttemptAt_1', sparse: true } },
  { collection: 'refreshtokens', key: { expiresAt: 1 }, options: { name: 'expiresAt_1', expireAfterSeconds: 0 } },
  { collection: 'refreshtokens', key: { refreshToken: 1 }, options: { name: 'refreshToken_1', unique: true } },
  { collection: 'refreshtokens', key: { previousTokenHash: 1 }, options: { name: 'previousTokenHash_1', sparse: true } },
  { collection: 'consumedrefreshtokens', key: { expiresAt: 1 }, options: { name: 'expiresAt_1', expireAfterSeconds: 0 } },
  { collection: 'authratelimits', key: { expiresAt: 1 }, options: { name: 'expiresAt_1', expireAfterSeconds: 0 } },
  { collection: 'products', key: { createdAt: -1, _id: -1 }, options: { name: 'createdAt_-1__id_-1' } },
  { collection: 'products', key: { sellerId: 1, createdAt: -1, _id: -1 }, options: { name: 'sellerId_1_createdAt_-1__id_-1' } },
];

export type IndexStatus = { collection: string; name: string; status: 'ready' | 'missing' | 'conflict' };

function sameKey(left: Document, right: Document): boolean {
  return JSON.stringify(Object.entries(left)) === JSON.stringify(Object.entries(right));
}

function sameOptions(actual: IndexDescription, expected: RequiredIndex): boolean {
  const options = expected.options;
  return Boolean(actual.unique) === Boolean(options.unique)
    && Boolean(actual.sparse) === Boolean(options.sparse)
    && actual.expireAfterSeconds === options.expireAfterSeconds
    && actual.partialFilterExpression === undefined
    && actual.collation === undefined
    && actual.hidden !== true;
}

export async function inspectRequiredIndexes(db: Db): Promise<IndexStatus[]> {
  const existingCollections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  const byCollection = new Map<string, IndexDescription[]>();
  for (const spec of requiredIndexes) {
    if (!byCollection.has(spec.collection)) {
      byCollection.set(spec.collection, existingCollections.has(spec.collection)
        ? await db.collection(spec.collection).listIndexes().toArray() : []);
    }
  }
  return requiredIndexes.map((spec) => {
    const existing = byCollection.get(spec.collection) ?? [];
    const sameFields = existing.filter((item) => sameKey(item.key, spec.key));
    const status = sameFields.some((item) => sameOptions(item, spec)) ? 'ready'
      : sameFields.length || existing.some((item) => item.name === spec.options.name) ? 'conflict' : 'missing';
    return { collection: spec.collection, name: spec.options.name, status };
  });
}

export async function provisionRequiredIndexes(db: Db): Promise<IndexStatus[]> {
  const before = await inspectRequiredIndexes(db);
  const conflicts = before.filter((item) => item.status === 'conflict');
  if (conflicts.length) {
    throw new Error(`Incompatible indexes: ${conflicts.map((item) => `${item.collection}.${item.name}`).join(', ')}. Inspect and resolve manually; no indexes were changed.`);
  }
  if (before.some((item) => item.collection === 'users' && item.name === 'email_1' && item.status === 'missing')) {
    const duplicates = await db.collection('users').aggregate([
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ]).toArray();
    if (duplicates.length) {
      throw new Error('Duplicate user emails prevent the unique email index. Resolve duplicates manually; no indexes were changed.');
    }
  }
  for (const spec of requiredIndexes) {
    if (before.find((item) => item.collection === spec.collection && item.name === spec.options.name)?.status !== 'missing') continue;
    try {
      await db.collection(spec.collection).createIndex(spec.key, spec.options);
    } catch (error) {
      const current = await inspectRequiredIndexes(db);
      if (current.find((item) => item.collection === spec.collection && item.name === spec.options.name)?.status === 'ready') continue;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new Error(`Duplicate data prevents ${spec.collection}.${spec.options.name}. Resolve duplicates manually; existing data was not changed.`, { cause: error });
      }
      throw new Error(`Could not create ${spec.collection}.${spec.options.name}. Inspect the existing index and data; no indexes were dropped.`, { cause: error });
    }
  }
  return inspectRequiredIndexes(db);
}
