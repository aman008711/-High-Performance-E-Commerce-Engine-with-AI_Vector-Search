import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { connectDB } from './config/db';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

// Security HTTP headers
app.use(helmet());

// Enable CORS with support for credentials
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Development logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Base API endpoints
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'E-commerce API server is healthy',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// Fallback handlers for routes that do not exist
app.use(notFoundHandler);

// Global Error Handler middleware
app.use(errorHandler);

// Bootstrap Server & DB Connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 [Server] Running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err: Error) => {
      console.error('💥 UNHANDLED REJECTION! Shutting down gracefully...');
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });
  } catch (error) {
    console.error('💥 [Server] Failed to start server:', (error as Error).message);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down immediately...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

startServer();

