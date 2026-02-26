import mongoose from 'mongoose';
import { Server } from 'http';

export const setupGracefulShutdown = (server: Server) => {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Closing server...`);

    // Stop accepting new requests
    server.close(async () => {
      console.log('Server closed.');

      // Close DB connection
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');

      process.exit(0);
    });

    // Force exit if shutdown takes too long
    setTimeout(() => {
      console.error('Shutdown timed out, forcing exit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};
