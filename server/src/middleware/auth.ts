import { Request, Response, NextFunction } from 'express';

export const adminAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const adminToken = req.headers['x-admin-token'];

  if (!adminToken || adminToken !== 'supersecretadmintoken') {
    res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Admin privileges required',
    });
    return;
  }
  next();
};
