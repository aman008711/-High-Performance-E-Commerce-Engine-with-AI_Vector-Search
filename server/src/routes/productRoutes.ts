import { Router } from 'express';
import { getProducts, getProduct } from '../controllers/productController';

const router = Router();

// Retrieve product listings
router.get('/', getProducts);

// Retrieve details for a single product
router.get('/:id', getProduct);

export default router;
