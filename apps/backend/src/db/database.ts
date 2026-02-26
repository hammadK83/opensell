import mongoose from 'mongoose';
import { env } from '../config/env'; // Import your validated env

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      dbName: env.DB_NAME,
      autoIndex: env.NODE_ENV !== 'production',
    });
    console.log(`MongoDB Connected to: ${conn.connection.name}`);
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// Listen for connection events
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  console.error(`MongoDB connection error: ${err}`);
});

export default connectDB;
