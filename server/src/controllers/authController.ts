import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { BadRequestError, NotFoundError } from '../utils/errors';

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new BadRequestError('Username and password are required');
    }

    const user = await User.findOne({ username });
    if (!user) {
      throw new NotFoundError('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    // Sign JWT token (expires in 24 hours)
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'supersecretjwtkey',
      { expiresIn: '24h' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
