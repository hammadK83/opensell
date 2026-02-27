import app from './app.js';
import connectDB from './db/database.js';
import { env } from './config/env.js';
import { setupGracefulShutdown } from './utils/shutdown.js';

const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}...`);
    });
    setupGracefulShutdown(server);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
