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
import analyticsRouter from './routes/analyticsRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

let ioInstance: SocketIOServer | null = null;

export const getIO = (): SocketIOServer | null => {
  return ioInstance;
};

export const app = express();

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

// Body parsing middleware (Increased to 50mb to support base64 image uploads for AI visual search)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.use('/api/analytics', analyticsRouter);

// Fallback handlers for routes that do not exist
app.use(notFoundHandler);

// Global Error Handler middleware
app.use(errorHandler);

// Bootstrap Server & DB Connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

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
      
      // Pre-warm AI models in the background to avoid request-time latency spikes
      import('./config/embedder').then(async ({ getEmbedder, getClassifier }) => {
        console.log('🔄 [AI Models] Pre-warming models in the background...');
        await getEmbedder().catch(err => console.error('Failed to pre-warm embedder:', err));
        await getClassifier().catch(err => console.error('Failed to pre-warm classifier:', err));
        console.log('💚 [AI Models] All model pipelines pre-warmed successfully.');
      }).catch(err => {
        console.error('Failed to import embedder config:', err);
      });
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

if (require.main === module) {
  startServer();
}

