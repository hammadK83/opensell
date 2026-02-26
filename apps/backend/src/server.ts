import app from './app';
import connectDB from './db/database';
import { env } from './config/env';
import { setupGracefulShutdown } from './utils/shutdown';

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
