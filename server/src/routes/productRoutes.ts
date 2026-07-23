import { Router } from 'express';
import { 
  getProducts, 
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProductsVector
} from '../controllers/productController';
import { apiRateLimiter, mutationRateLimiter } from '../middleware/rateLimiter';
import { adminAuth } from '../middleware/auth';

const router = Router();

// Apply request rate limiter globally to all catalog routes
router.use(apiRateLimiter);

// AI Vector Semantic Search Endpoint
router.get('/search/vector', searchProductsVector);

// Retrieve product listings
router.get('/', getProducts);

// Retrieve details for a single product
router.get('/:id', getProduct);

// Admin product mutation routes (requires adminAuth token verification, mutation limits, and purges cache)
router.post('/', adminAuth, mutationRateLimiter, createProduct);
router.put('/:id', adminAuth, mutationRateLimiter, updateProduct);
router.delete('/:id', adminAuth, mutationRateLimiter, deleteProduct);

export default router;
