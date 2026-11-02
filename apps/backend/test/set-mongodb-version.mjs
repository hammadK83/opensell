// Keep MongoMemoryServer's binary stable in local runs and CI.
import process from 'node:process';

process.env.MONGOMS_VERSION ??= '8.2.6';
