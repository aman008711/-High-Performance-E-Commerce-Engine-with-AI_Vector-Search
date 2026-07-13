import mongoose from 'mongoose';
import { env } from './env';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

export const connectDB = async (): Promise<void> => {
  let attempt = 0;

  const tryConnect = async (): Promise<void> => {
    try {
      console.log(`🔌 [Database] Connecting to MongoDB (Attempt ${attempt + 1}/${MAX_RETRIES})...`);
      
      await mongoose.connect(env.MONGO_URI, {
        autoIndex: true, // Auto-build indexes in development; fits local schema needs
      });

      console.log('✅ [Database] MongoDB connected successfully');
    } catch (error) {
      attempt++;
      console.error(`❌ [Database] Connection failed: ${(error as Error).message}`);
      
      if (attempt < MAX_RETRIES) {
        console.log(`🔌 [Database] Retrying connection in ${RETRY_INTERVAL_MS / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
        return tryConnect();
      } else {
        console.error('💥 [Database] Maximum connection retries reached. Shutting down...');
        process.exit(1);
      }
    }
  };

  // Mongoose lifecycle listeners
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [Database] MongoDB disconnected! Attempting auto-reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ [Database] MongoDB reconnected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`❌ [Database] Mongoose connection error: ${err.message}`);
  });

  await tryConnect();
};
