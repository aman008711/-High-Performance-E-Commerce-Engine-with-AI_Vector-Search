import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If it's our custom application error
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Handle mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: err.message,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Generic internal server error
  console.error('[Error Details]:', err);
  
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong on our end. Please try again later.',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Middleware to capture 404 (Not Found) routes
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
  });
};
