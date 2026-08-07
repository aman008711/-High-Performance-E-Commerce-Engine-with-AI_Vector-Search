import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProductsVector,
  searchProductsImage,
  getProductRecommendations,
  getCategoryWiseProducts,
  getDeletedProducts,
  restoreProduct
} from '../controllers/productController';
import { apiRateLimiter, mutationRateLimiter } from '../middleware/rateLimiter';
import { adminAuth } from '../middleware/auth';

const router = Router();

// Apply request rate limiter globally to all catalog routes
router.use(apiRateLimiter);

// AI Vector Semantic Search Endpoint
router.get('/search/vector', searchProductsVector);

// AI Image-Based Product Search Endpoint
router.post('/search/image', searchProductsImage);

// Retrieve category-wise product listings
router.get('/category-wise', getCategoryWiseProducts);

// Retrieve product listings
router.get('/', getProducts);

// Retrieve soft-deleted products for admin
router.get('/admin/deleted', adminAuth, getDeletedProducts);

// Retrieve details for a single product
router.get('/:id', getProduct);

// Retrieve recommendations for a single product
router.get('/:id/recommendations', getProductRecommendations);

// Admin product mutation routes (requires adminAuth token verification, mutation limits, and purges cache)
router.post('/', adminAuth, mutationRateLimiter, createProduct);
router.put('/:id', adminAuth, mutationRateLimiter, updateProduct);
router.delete('/:id', adminAuth, mutationRateLimiter, deleteProduct);
router.patch('/:id/restore', adminAuth, mutationRateLimiter, restoreProduct);

export default router;
