import { Router } from 'express';
import { 
  getProducts, 
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/productController';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { adminAuth } from '../middleware/auth';

const router = Router();

// Apply request rate limiter globally to all catalog routes
router.use(apiRateLimiter);

// Retrieve product listings
router.get('/', getProducts);

// Retrieve details for a single product
router.get('/:id', getProduct);

// Admin product mutation routes (requires adminAuth token verification and purges cache)
router.post('/', adminAuth, createProduct);
router.put('/:id', adminAuth, updateProduct);
router.delete('/:id', adminAuth, deleteProduct);

export default router;
