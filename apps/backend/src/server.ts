import app from './app.js';
import connectDB from './db/database.js';
import { env } from './config/env.js';
import { setupGracefulShutdown } from './utils/index.js';
import { startVerificationEmailWorker } from './services/verification-email.service.js';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import { inspectRequiredIndexes } from './db/required-indexes.js';

const startServer = async () => {
  try {
    await connectDB();
    if (env.NODE_ENV === 'production') {
      // Mongoose and the provisioning command use different MongoDB driver versions.
      const indexes = await inspectRequiredIndexes(mongoose.connection.db as unknown as Db);
      const outstanding = indexes.filter((index) => index.status !== 'ready');
      if (outstanding.length) {
        throw new Error('Required database indexes are missing or incompatible. Run indexes:check, then provision them before starting the backend.');
      }
    }
    const emailWorker = startVerificationEmailWorker();
    const server = app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}...`);
    });
    setupGracefulShutdown(server, emailWorker.stop);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
