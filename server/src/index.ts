import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { connectDB } from './config/db';
import { isRedisConnected } from './config/redis';
import productRouter from './routes/productRoutes';
import authRouter from './routes/authRoutes';
import checkoutRouter from './routes/checkoutRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import compression from 'compression';
import { initEmbedder } from './config/embedder';

let ioInstance: SocketIOServer | null = null;

export const getIO = (): SocketIOServer | null => {
  return ioInstance;
};

const app = express();

// Compress response payloads
app.use(compression());

// Security HTTP headers
app.use(helmet());

// Enable CORS with support for credentials
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, postman, curl)
      if (!origin) return callback(null, true);
      
      if (env.ALLOWED_ORIGINS.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
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
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'success',
    message: 'E-commerce API server is healthy',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    services: {
      database: dbStatus,
      redis: isRedisConnected() ? 'connected' : 'disconnected',
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/checkout', checkoutRouter);

// Fallback handlers for routes that do not exist
app.use(notFoundHandler);

// Global Error Handler middleware
app.use(errorHandler);

// Bootstrap Server & DB Connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize Local ONNX Embedder Pipeline
    await initEmbedder();

    const server = http.createServer(app);

    ioInstance = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    ioInstance.on('connection', (socket) => {
      console.log(`🔌 [Socket] Client connected: ${socket.id}`);
      socket.on('disconnect', () => {
        console.log(`🔌 [Socket] Client disconnected: ${socket.id}`);
      });
    });

    server.listen(env.PORT, () => {
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

