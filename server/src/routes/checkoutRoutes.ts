import { Router } from 'express';
import { calculateCart, placeOrder } from '../controllers/checkoutController';
import { apiRateLimiter, mutationRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply request rate limiter globally to all checkout routes
router.use(apiRateLimiter);

// Calculate dynamic cart totals and apply coupon discounts
router.post('/calculate', calculateCart);

// Finalize order checkout with ACID transactional inventory decrements (uses mutations rate limiter)
router.post('/place-order', mutationRateLimiter, placeOrder);

export default router;
