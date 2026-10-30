import app from './app.js';
import connectDB from './db/database.js';
import { env } from './config/env.js';
import { setupGracefulShutdown } from './utils/index.js';
import { startVerificationEmailWorker } from './services/verification-email.service.js';
import { AuthRateLimit } from './models/auth-rate-limit.model.js';

const startServer = async () => {
  try {
    await connectDB();
    await AuthRateLimit.createIndexes();
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
