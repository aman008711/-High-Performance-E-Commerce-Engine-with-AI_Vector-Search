import { Router } from 'express';
import { 
  getProducts, 
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/productController';

const router = Router();

// Retrieve product listings
router.get('/', getProducts);

// Retrieve details for a single product
router.get('/:id', getProduct);

// Admin product mutation routes (purges cached records lists/keys on database write)
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
