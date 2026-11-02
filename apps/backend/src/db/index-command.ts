import { MongoClient } from 'mongodb';
import { inspectRequiredIndexes, provisionRequiredIndexes } from './required-indexes.js';

const mode = process.argv[2];
if (mode !== '--check' && mode !== '--apply') {
  console.error('Usage: npm run indexes:check|indexes:apply --workspace=@opensell/backend');
  process.exit(2);
}

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;
if (!uri || !dbName) {
  console.error('MONGO_URI and DB_NAME must be set for index inspection or provisioning.');
  process.exit(2);
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  const status = mode === '--apply' ? await provisionRequiredIndexes(db) : await inspectRequiredIndexes(db);
  for (const item of status) console.log(`${item.status}: ${item.collection}.${item.name}`);
  if (status.some((item) => item.status !== 'ready')) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Index command failed.');
  process.exitCode = 1;
} finally {
  await client.close();
}
