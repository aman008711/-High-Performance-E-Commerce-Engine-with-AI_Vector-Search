import { Router } from 'express';
import { getSearchAnalytics, clearSearchLogs } from '../controllers/analyticsController';
import { adminAuth } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply general rate limiting
router.use(apiRateLimiter);

// Get search analytics (public read for dashboard)
router.get('/search-stats', getSearchAnalytics);

// Clear search logs (requires admin authorization)
router.delete('/search-stats', adminAuth, clearSearchLogs);

export default router;
