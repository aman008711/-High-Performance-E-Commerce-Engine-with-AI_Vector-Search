import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { io } from 'socket.io-client';
import { api, ApiProduct, SearchAnalyticsResponse } from './services/api';
import {
  Activity,
  Layers,
  Database,
  Terminal,
  Cpu,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  ShoppingCart,
  Camera,
  X
} from 'lucide-react';
const getLogTagClass = (status: string): string => {
  const s = status.toLowerCase();
  if (s.includes('hit')) return 'hit';
  if (s.includes('miss')) return 'miss';
  if (s.includes('bypass')) return 'bypass';
  if (s.includes('evict')) return 'evict';
  return 'miss';
};
const CATEGORIES = [
  "Men's Clothing",
  "Women's Clothing",
  "Shoes",
  "Electronics",
  "Mobiles",
  "Laptops",
  "Watches",
  "Beauty",
  "Home & Kitchen",
  "Grocery",
  "Sports",
  "Books",
  "Toys",
  "Furniture",
  "Accessories"
];

// Typo Tolerance Dictionary words
const DICTIONARY_WORDS = [
  "t-shirt", "shirt", "jeans", "jacket", "hoodie", "dress", "top", "skirt",
  "sweater", "shoes", "sneakers", "boots", "loafers", "headphones", "keyboard",
  "speaker", "monitor", "webcam", "phone", "mobile", "smartphone", "laptop",
  "watch", "beauty", "cream", "shampoo", "perfume", "blender", "kettle", "pan",
  "cookware", "coffee", "salt", "pepper", "tea", "yoga", "dumbbell", "tent",
  "book", "toy", "lego", "drone", "furniture", "chair", "table", "desk",
  "sunglasses", "belt", "backpack", "beanie"
];

// Helper to compute Levenshtein distance
const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return matrix[a.length][b.length];
};

// Typo suggestion logic
const getTypoSuggestion = (searchStr: string): string | null => {
  if (!searchStr || searchStr.length < 3) return null;
  const words = searchStr.toLowerCase().split(/\s+/);
  let suggestionsMade = false;
  const correctedWords = words.map(w => {
    if (DICTIONARY_WORDS.includes(w) || w.length < 4) return w;

    let bestWord: string | null = null;
    let bestDistance = 999;

    for (const dictWord of DICTIONARY_WORDS) {
      const distance = getLevenshteinDistance(w, dictWord);
      const maxAllowed = w.length > 6 ? 2 : 1;
      if (distance <= maxAllowed && distance < bestDistance) {
        bestDistance = distance;
        bestWord = dictWord;
      }
    }

    if (bestWord) {
      suggestionsMade = true;
      return bestWord;
    }
    return w;
  });

  return suggestionsMade ? correctedWords.join(' ') : null;
};

// Keyword Highlighting Helper
const highlightKeywords = (text: string, searchStr: string): React.ReactNode => {
  if (!searchStr) return text;
  const words = searchStr.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return text;

  const escWords = words.map(w => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const patterns = escWords.map(w => w.endsWith('s') && w.length > 3 ? `${w}|${w.slice(0, -1)}` : w);
  const regex = new RegExp(`\\b(${patterns.join('|')})\\b`, 'gi');

  const parts = text.split(regex);
  if (parts.length <= 1) return text;

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} style={{ backgroundColor: 'rgba(139, 92, 246, 0.22)', color: 'var(--primary)', padding: '0 2px', borderRadius: '2px', fontWeight: 600 }}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

const getLoremFlickrUrl = (name: string, category: string, width = 500, height = 400): string => {
  const cat = (category || '').toLowerCase();
  const title = (name || '').toLowerCase();

  let keyword = 'product';
  if (cat.includes('shoe')) keyword = 'shoes';
  else if (cat.includes('phone') || cat.includes('mobile')) keyword = 'smartphone,phone';
  else if (cat.includes('laptop')) keyword = 'laptop,computer';
  else if (cat.includes('watch')) keyword = 'watch';
  else if (cat.includes('clothing') || cat.includes('apparel') || cat.includes('shirt') || cat.includes('sweater') || cat.includes('dress') || cat.includes('jeans') || cat.includes('hoodie')) {
    if (title.includes('shirt') || title.includes('tee')) keyword = 'tshirt';
    else if (title.includes('sweater') || title.includes('knit')) keyword = 'sweater';
    else if (title.includes('dress')) keyword = 'dress';
    else if (title.includes('jeans')) keyword = 'jeans';
    else if (title.includes('hoodie')) keyword = 'hoodie';
    else keyword = 'clothing';
  }
  else if (cat.includes('electronics')) {
    if (title.includes('headphone') || title.includes('airpods') || title.includes('earbuds')) keyword = 'headphones';
    else if (title.includes('keyboard')) keyword = 'keyboard';
    else if (title.includes('speaker')) keyword = 'speaker';
    else if (title.includes('monitor')) keyword = 'monitor';
    else keyword = 'electronics';
  }
  else if (cat.includes('beauty') || cat.includes('care') || cat.includes('cream')) keyword = 'cosmetics';
  else if (cat.includes('kitchen') || cat.includes('home')) {
    if (title.includes('vacuum') || title.includes('dyson')) keyword = 'vacuum';
    else keyword = 'home,kitchen';
  }
  else if (cat.includes('toy') || cat.includes('lego')) keyword = 'toys';
  else if (cat.includes('grocery') || cat.includes('food') || cat.includes('coffee')) keyword = 'coffee,grocery';
  else if (cat.includes('furniture') || cat.includes('chair')) keyword = 'furniture';

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const lock = Math.abs(hash) % 1000;

  return `https://loremflickr.com/${width}/${height}/${keyword}?lock=${lock}`;
};

function App() {
  const searchRef = useRef(0);
  const searchDebounceTimerRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'catalog' | 'admin' | 'logs'>('dashboard');
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<'Online' | 'Offline' | 'Checking'>('Checking');
  const [dbStatus, setDbStatus] = useState<'Connected' | 'Disconnected' | 'Checking'>('Checking');
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Authentication & Security states
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // AI Semantic Vector Search state toggle (true by default to show AI Telemetry)
  const [isVectorSearch, setIsVectorSearch] = useState<boolean>(true);

  // Form CRUD bindings
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formStock, setFormStock] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formTags, setFormTags] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Products and Telemetry telemetry states
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [searchTelemetry, setSearchTelemetry] = useState<any>(null);

  // AI Image Search States
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isImageSearching, setIsImageSearching] = useState<boolean>(false);
  const [imagePrediction, setImagePrediction] = useState<{ label: string; score: number } | null>(null);

  const [categoryWiseProducts, setCategoryWiseProducts] = useState<Array<{ category: string; count: number; products: ApiProduct[] }>>([]);
  const [categoryWiseLoading, setCategoryWiseLoading] = useState<boolean>(false);
  const [isCategoryWiseMode, setIsCategoryWiseMode] = useState<boolean>(false);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(CATEGORIES);

  const [searchAnalytics, setSearchAnalytics] = useState<SearchAnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);

  const [avgLatency, setAvgLatency] = useState<number>(12.4);
  const [cacheHitRate, setCacheHitRate] = useState<number>(94.8);
  const [logs, setLogs] = useState<Array<{ method: string; path: string; status: string; latency: string; speed: 'fast' | 'slow' }>>([
    { method: 'GET', path: '/api/health', status: 'BYPASS', latency: '4.5ms', speed: 'fast' }
  ]);

  // Shopping Cart States
  const [cart, setCart] = useState<Array<{ product: ApiProduct; quantity: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [couponInput, setCouponInput] = useState<string>('');
  const [couponSuccess, setCouponSuccess] = useState<string>('');
  const [couponError, setCouponError] = useState<string>('');
  const [calculating, setCalculating] = useState<boolean>(false);
  const [checkingOut, setCheckingOut] = useState<boolean>(false);
  const [totals, setTotals] = useState({
    subtotal: 0,
    discountPercent: 0,
    discountApplied: 0,
    total: 0
  });

  // Particles states for cart animations
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; tx: number; ty: number }>>([]);
  const [cartBadgePop, setCartBadgePop] = useState<boolean>(false);

  // Theme states
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (next === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
      return next;
    });
  };

  // Recommendations States
  const [recommendations, setRecommendations] = useState<ApiProduct[]>([]);

  // Fetch product recommendations based on last added item
  useEffect(() => {
    if (cart.length === 0) {
      setRecommendations([]);
      return;
    }

    const fetchRecommendations = async () => {
      try {
        const lastCartItem = cart[cart.length - 1];
        const response = await api.getProductRecommendations(lastCartItem.product._id);

        // Exclude items already in the cart
        const cartIds = cart.map(item => item.product._id);
        const filteredRecs = (response.data || []).filter((p: ApiProduct) => !cartIds.includes(p._id));
        setRecommendations(filteredRecs);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
      }
    };

    // Debounce recommendation fetch slightly to avoid spamming calls
    const timer = setTimeout(fetchRecommendations, 300);
    return () => clearTimeout(timer);
  }, [cart]);

  // Real-time WebSocket stock updates
  useEffect(() => {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const socket = io(isDev ? 'http://localhost:5000' : window.location.origin, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('📡 [Socket] Connected to server');
    });

    socket.on('inventoryUpdate', (updates: Array<{ productId: string; newStock: number }>) => {
      console.log('📡 [Socket] Received stock updates:', updates);
      setProducts(prevProducts => {
        return prevProducts.map(product => {
          const match = updates.find(u => u.productId === product._id);
          if (match) {
            return {
              ...product,
              stock: match.newStock
            };
          }
          return product;
        });
      });
    });

    socket.on('disconnect', () => {
      console.log('📡 [Socket] Disconnected from server');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Calculate totals client-side as fallback before backend calculation is fetched
  useEffect(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    setTotals(prev => ({
      ...prev,
      subtotal,
      total: Math.max(0, subtotal - prev.discountApplied)
    }));
  }, [cart]);

  // Sync totals with backend in the background when cart item quantities update
  useEffect(() => {
    if (cart.length === 0) return;
    if (!couponInput) return;

    const syncTotals = async () => {
      try {
        const itemsPayload = cart.map(item => ({
          productId: item.product._id,
          quantity: item.quantity
        }));
        const response = await api.calculateCart(itemsPayload, couponInput);
        setTotals({
          subtotal: response.data.subtotal,
          discountPercent: response.data.discountPercent,
          discountApplied: response.data.discountApplied,
          total: response.data.total
        });
      } catch (error) {
        console.error('Failed to sync calculations in background:', error);
      }
    };

    const timer = setTimeout(syncTotals, 300);
    return () => clearTimeout(timer);
  }, [cart, couponInput]);

  const addToCart = (product: ApiProduct, e?: React.MouseEvent) => {
    if (e) {
      const clickX = e.clientX;
      const clickY = e.clientY;
      const cartBtn = document.querySelector('.cart-trigger-btn');
      let tx = window.innerWidth - 100 - clickX;
      let ty = 20 - clickY;
      if (cartBtn) {
        const rect = cartBtn.getBoundingClientRect();
        tx = rect.left + rect.width / 2 - clickX;
        ty = rect.top + rect.height / 2 - clickY;
      }

      const particleId = Date.now() + Math.random();
      setParticles(prev => [...prev, { id: particleId, x: clickX, y: clickY, tx, ty }]);

      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== particleId));
        setCartBadgePop(true);
        setTimeout(() => setCartBadgePop(false), 350);
      }, 700);
    }

    setCart(prev => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item =>
          item.product._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product._id !== productId));
    setCouponSuccess('');
    setCouponError('');
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.product._id === productId) {
        const targetQty = Math.min(quantity, item.product.stock);
        return { ...item, quantity: targetQty };
      }
      return item;
    }));
  };

  const applyCoupon = async () => {
    if (!couponInput) return;
    setCalculating(true);
    setCouponError('');
    setCouponSuccess('');

    try {
      const itemsPayload = cart.map(item => ({
        productId: item.product._id,
        quantity: item.quantity
      }));

      const response = await api.calculateCart(itemsPayload, couponInput);

      // Update totals
      setTotals({
        subtotal: response.data.subtotal,
        discountPercent: response.data.discountPercent,
        discountApplied: response.data.discountApplied,
        total: response.data.total
      });

      // Update telemetry
      const newLog = {
        method: 'POST',
        path: '/api/checkout/calculate',
        status: response.cacheStatus,
        latency: `${response.latency}ms`,
        speed: (response.latency < 50 ? 'fast' : 'slow') as 'fast' | 'slow'
      };
      setLogs(prev => [newLog, ...prev.slice(0, 19)]);
      setAvgLatency(prev => parseFloat(((prev * 0.9) + (response.latency * 0.1)).toFixed(1)));
      if (response.cacheStatus === 'HIT') {
        setCacheHitRate(prev => parseFloat(((prev * 0.95) + 5).toFixed(1)));
      } else if (response.cacheStatus === 'MISS') {
        setCacheHitRate(prev => parseFloat(((prev * 0.95)).toFixed(1)));
      }

      setCouponSuccess(`Coupon "${response.data.discountCode}" applied successfully! (${response.data.discountPercent}% off)`);
    } catch (err: any) {
      setCouponError(err.message || 'Failed to apply coupon');
    } finally {
      setCalculating(false);
    }
  };

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      const itemsPayload = cart.map(item => ({
        productId: item.product._id,
        quantity: item.quantity
      }));

      const response = await api.placeOrder(itemsPayload, couponInput || undefined);

      // Update telemetry
      const newLog = {
        method: 'POST',
        path: '/api/checkout/place-order',
        status: response.cacheStatus,
        latency: `${response.latency}ms`,
        speed: (response.latency < 50 ? 'fast' : 'slow') as 'fast' | 'slow'
      };
      setLogs(prev => [newLog, ...prev.slice(0, 19)]);
      setAvgLatency(prev => parseFloat(((prev * 0.9) + (response.latency * 0.1)).toFixed(1)));

      alert(`Order Placed Successfully! Order ID: ${response.data._id}`);

      setCart([]);
      setTotals({ subtotal: 0, discountPercent: 0, discountApplied: 0, total: 0 });
      setCouponInput('');
      setCouponSuccess('');
      setIsCartOpen(false);

      // Re-fetch products to show updated stock level values on the catalog UI page!
      await fetchProducts();
    } catch (err: any) {
      alert('Checkout Failed: ' + (err.message || err));
    } finally {
      setCheckingOut(false);
    }
  };

  // Populate drawer form inputs when edit targets update
  useEffect(() => {
    if (editingProduct) {
      setFormName(editingProduct.name || '');
      setFormCategory(editingProduct.category || dynamicCategories[0] || CATEGORIES[0]);
      setFormPrice(editingProduct.price ? editingProduct.price.toString() : '');
      setFormStock(editingProduct.stock !== undefined ? editingProduct.stock.toString() : '');
      setFormDescription(editingProduct.description || '');
      setFormImageUrl(editingProduct.imageUrl || '');
      setFormTags(editingProduct.tags ? editingProduct.tags.join(', ') : '');
    }
  }, [editingProduct]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSubmitting(true);

    const parsedPrice = parseFloat(formPrice) || 0;
    const parsedStock = parseInt(formStock) || 0;
    const parsedTags = formTags.split(',').map(t => t.trim()).filter(Boolean);

    const payload = {
      name: formName,
      description: formDescription,
      price: parsedPrice,
      stock: parsedStock,
      category: formCategory,
      tags: parsedTags,
      imageUrl: formImageUrl || getLoremFlickrUrl(formName, formCategory)
    };

    try {
      if (editingProduct._id) {
        await api.updateProduct(editingProduct._id, payload);
      } else {
        await api.createProduct(payload);
      }

      // Close drawer & trigger immediate fetch (invalidates server cache)
      setEditingProduct(null);
      await fetchProducts();
    } catch (err) {
      alert('Failed to save product: ' + err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await api.login(loginUsername, loginPassword);
      const { token } = response.data;
      localStorage.setItem('adminToken', token);
      setAuthToken(token);
      setLoginUsername('');
      setLoginPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please check credentials.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAuthToken(null);
  };

  // Poll system health metrics
  useEffect(() => {
    const checkSystemHealth = async () => {
      try {
        const response = await api.getHealth();
        if (response.data.status === 'success') {
          setApiStatus('Online');
          setDbStatus(response.data.services.database === 'connected' ? 'Connected' : 'Disconnected');
        } else {
          setApiStatus('Offline');
          setDbStatus('Disconnected');
        }
      } catch (err) {
        setApiStatus('Offline');
        setDbStatus('Disconnected');
      }
    };

    checkSystemHealth();
    const intervalId = setInterval(checkSystemHealth, 15000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleAdminLogout = () => {
      setAuthToken(null);
    };
    window.addEventListener('admin-logout', handleAdminLogout);
    return () => window.removeEventListener('admin-logout', handleAdminLogout);
  }, []);

  const fetchSearchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await api.getSearchAnalytics();
      if (response.data) {
        setSearchAnalytics(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch search analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleClearSearchLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all search logs? This cannot be undone.')) {
      return;
    }
    try {
      await api.clearSearchLogs();
      fetchSearchAnalytics();
    } catch (err: any) {
      alert(err.message || 'Failed to clear search logs');
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchSearchAnalytics();
      const intervalId = setInterval(fetchSearchAnalytics, 3000);
      return () => clearInterval(intervalId);
    }
  }, [activeTab]);

  // Search input debouncer effect (waits 750ms of typing silence before querying)
  useEffect(() => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    searchDebounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 750);

    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, [searchTerm]);



  // Fetch products from backend with client-side fallback if route is not implemented yet
  const fetchProducts = async (searchId?: number) => {
    setLoading(true);
    try {
      let fetchPromise;
      if (imagePreview) {
        fetchPromise = api.searchProductsImage(imagePreview, selectedCategory || undefined, {
          page: currentPage,
          limit: 12,
          sortBy,
          sortOrder
        }, imageFileName || undefined);
      } else {
        fetchPromise = debouncedSearchTerm
          ? api.searchProductsVector({
            page: currentPage,
            limit: 12,
            category: selectedCategory || undefined,
            search: debouncedSearchTerm,
            sortBy,
            sortOrder
          })
          : api.getProducts({
            page: currentPage,
            limit: 12,
            category: selectedCategory || undefined,
            search: undefined,
            sortBy,
            sortOrder
          });
      }

      const response = await fetchPromise;
      if (searchId !== undefined && searchId !== searchRef.current) return;

      if (imagePreview && response.data && 'prediction' in response.data) {
        const payloadData = response.data as any;
        setProducts(payloadData.products);
        setTotalProducts(payloadData.total);
        setTotalPages(payloadData.pages);
        setSearchTelemetry(payloadData.telemetry);
        setImagePrediction(payloadData.prediction);
      } else {
        setProducts(response.data.products);
        setTotalProducts(response.data.total);
        setTotalPages(response.data.pages);
        if (response.data && 'telemetry' in response.data) {
          setSearchTelemetry((response.data as any).telemetry);
        } else {
          setSearchTelemetry(null);
        }
      }

      const basePath = imagePreview ? '/api/products/search/image' : (debouncedSearchTerm ? '/api/products/search/vector' : '/api/products');
      const pathStr = `${basePath}?page=${currentPage}&limit=12` +
        (selectedCategory ? `&category=${selectedCategory}` : '') +
        (debouncedSearchTerm && !imagePreview ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : '') +
        `&sortBy=${sortBy}&sortOrder=${sortOrder}`;

      const newLog = {
        method: imagePreview ? 'POST' : 'GET',
        path: pathStr,
        status: response.cacheStatus,
        latency: `${response.latency}ms`,
        speed: (response.latency < 50 ? 'fast' : 'slow') as 'fast' | 'slow'
      };

      setLogs(prev => [newLog, ...prev.slice(0, 19)]);
      setAvgLatency(prev => parseFloat(((prev * 0.9) + (response.latency * 0.1)).toFixed(1)));

      if (response.cacheStatus === 'HIT') {
        setCacheHitRate(prev => parseFloat(((prev * 0.95) + 5).toFixed(1)));
      } else if (response.cacheStatus === 'MISS') {
        setCacheHitRate(prev => parseFloat(((prev * 0.95)).toFixed(1)));
      }

    } catch (error) {
      if (imagePreview) {
        alert("Image search is currently unavailable. Please check that the server is running and the model is downloaded.");
        setImagePreview(null);
        setImagePrediction(null);
        setLoading(false);
        return;
      }

      // Endpoint is 404 (Route not built on server until Day 10). Perform local client-side data mirroring.
      const fallbackData = getMockProducts(debouncedSearchTerm, selectedCategory, currentPage, sortBy, sortOrder);

      // Inject standard latency delay (600ms) to demonstrate loading skeletons
      await new Promise(resolve => setTimeout(resolve, 600));
      if (searchId !== undefined && searchId !== searchRef.current) return;

      setProducts(fallbackData.list);
      setTotalProducts(fallbackData.total);
      setTotalPages(fallbackData.pages);

      const pathStr = `/api/products?page=${currentPage}&limit=12` +
        (selectedCategory ? `&category=${selectedCategory}` : '') +
        (debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : '') +
        `&sortBy=${sortBy}&sortOrder=${sortOrder}`;

      const simulatedLatency = Math.floor(Math.random() * 45) + 65; // Simulated DB round trip: 65-110ms
      const newLog = {
        method: 'GET',
        path: pathStr,
        status: 'CACHE MISS', // Since Redis connection starts on Week 2, default to cache misses
        latency: `${simulatedLatency}ms`,
        speed: 'slow' as const
      };

      setLogs(prev => [newLog, ...prev.slice(0, 19)]);
      setAvgLatency(prev => parseFloat(((prev * 0.9) + (simulatedLatency * 0.1)).toFixed(1)));
      setCacheHitRate(prev => parseFloat((prev * 0.95).toFixed(1)));
    } finally {
      if (searchId === undefined || searchId === searchRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchCategoryWiseProducts = async () => {
    setCategoryWiseLoading(true);
    try {
      const response = await api.getCategoryWiseProducts();
      setCategoryWiseProducts(response.data);

      const cats = response.data.map(item => item.category);
      if (cats.length > 0) {
        setDynamicCategories(cats);
      }

      const newLog = {
        method: 'GET',
        path: '/api/products/category-wise',
        status: response.cacheStatus,
        latency: `${response.latency}ms`,
        speed: (response.latency < 50 ? 'fast' : 'slow') as 'fast' | 'slow'
      };

      setLogs(prev => [newLog, ...prev.slice(0, 19)]);
      setAvgLatency(prev => parseFloat(((prev * 0.9) + (response.latency * 0.1)).toFixed(1)));

      if (response.cacheStatus === 'HIT') {
        setCacheHitRate(prev => parseFloat(((prev * 0.95) + 5).toFixed(1)));
      } else if (response.cacheStatus === 'MISS') {
        setCacheHitRate(prev => parseFloat(((prev * 0.95)).toFixed(1)));
      }
    } catch (err) {
      console.error('Failed to fetch category wise products:', err);
    } finally {
      setCategoryWiseLoading(false);
    }
  };

  // Run category-wise fetch on mount and standard fetch when filters update
  useEffect(() => {
    fetchCategoryWiseProducts();
  }, []);

  // Re-run search whenever page, category, search mode, debounced keyword, image, or sorting updates
  useEffect(() => {
    const searchId = ++searchRef.current;
    fetchProducts(searchId);
  }, [currentPage, selectedCategory, debouncedSearchTerm, isVectorSearch, sortBy, sortOrder, imagePreview, imageFileName]);


  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }
  };

  const handleImageSearchUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFileName(file.name);
    setIsImageSearching(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImagePreview(base64String);
      setIsImageSearching(false);
      setSearchTerm(''); // Clear text search when uploading image
      setCurrentPage(1);
    };
    reader.onerror = () => {
      alert("Failed to read image file.");
      setIsImageSearching(false);
    };
    reader.readAsDataURL(file);
  };

  const clearImageSearch = () => {
    setImagePreview(null);
    setImageFileName('');
    setImagePrediction(null);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleSortChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const [field, order] = e.target.value.split(':');
    setSortBy(field);
    setSortOrder(order);
    setCurrentPage(1);
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setIsCategoryWiseMode(false);
    setActiveTab('catalog');
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setDeletingId(id);
      try {
        await api.deleteProduct(id);
        await fetchProducts();
      } catch (err) {
        alert('Failed to delete product: ' + err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Local static mock product generator matching seed schemas for client side fallbacks
  // Local static mock product generator matching seed schemas for client side fallbacks
  const getMockProducts = (search: string, cat: string, page: number, sortBy = 'createdAt', sortOrder = 'desc') => {
    const baseProducts = [
      { name: 'UltraHD Smart OLED TV', cat: 'Electronics', price: 649.99, img: 'https://picsum.photos/seed/elec1/500/400' },
      { name: 'Soundcore Pro Wireless Headset', cat: 'Electronics', price: 119.99, img: 'https://picsum.photos/seed/elec2/500/400' },
      { name: 'Developer Mechanical Keyboard Red Switch', cat: 'Electronics', price: 89.99, img: 'https://picsum.photos/seed/elec3/500/400' },
      { name: 'Runner AeroSneaker Pro Speed', cat: 'Sports & Outdoors', price: 145.00, img: 'https://picsum.photos/seed/sport1/500/400' },
      { name: 'Stainless Steel Damascus Chef Knife Set', cat: 'Home & Kitchen', price: 79.50, img: 'https://picsum.photos/seed/home1/500/400' },
      { name: 'Premium Bamboo Bread Board', cat: 'Home & Kitchen', price: 24.99, img: 'https://picsum.photos/seed/home2/500/400' },
      { name: 'Waterproof Geodesic Camping Tent (4-Person)', cat: 'Sports & Outdoors', price: 189.99, img: 'https://picsum.photos/seed/sport2/500/400' },
      { name: 'Organic Cold-Pressed Argan Hair Serum', cat: 'Beauty & Personal Care', price: 29.00, img: 'https://picsum.photos/seed/beauty1/500/400' },
      { name: 'Hyaluronic Hydrating Face Cream', cat: 'Beauty & Personal Care', price: 38.50, img: 'https://picsum.photos/seed/beauty2/500/400' },
      { name: 'Premium Cotton Comfort Fitted Shirt', cat: 'Apparel & Fashion', price: 49.99, img: 'https://picsum.photos/seed/wear1/500/400' },
      { name: 'Heavyweight Sherpa Denim Jacket', cat: 'Apparel & Fashion', price: 95.00, img: 'https://picsum.photos/seed/wear2/500/400' },
      { name: 'The Art of Clean Coding Architecture', cat: 'Books', price: 19.95, img: 'https://picsum.photos/seed/book1/500/400' },
      { name: 'Introduction to Algorithms 4th Edition', cat: 'Books', price: 89.99, img: 'https://picsum.photos/seed/book2/500/400' },
      { name: 'Car Dashboard Magnetic Mount', cat: 'Automotive', price: 15.99, img: 'https://picsum.photos/seed/car1/500/400' },
      { name: 'Premium Microfiber Polishing Towels', cat: 'Automotive', price: 18.50, img: 'https://picsum.photos/seed/car2/500/400' },
      { name: 'Wooden Balance Game Stacking Blocks', cat: 'Toys & Games', price: 14.99, img: 'https://picsum.photos/seed/toy1/500/400' },
    ];

    // Multiply objects to create a mock base of 5000 products
    let items: ApiProduct[] = [];
    for (let i = 0; i < 312; i++) {
      baseProducts.forEach((item, idx) => {
        items.push({
          _id: `mock_prod_${i}_${idx}`,
          name: `${item.name} #${i + 1}`,
          description: `A high performance, premium quality item categorized in ${item.cat.toLowerCase()}. Specially loaded into memory for cache-aside latency checks and DB query load tests.`,
          price: parseFloat((item.price + (i * 0.05)).toFixed(2)),
          stock: Math.max(0, 200 - (i % 40) * 4),
          category: item.cat,
          tags: [item.cat.toLowerCase(), 'mock-seed', 'benchmark'],
          imageUrl: item.img,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as ApiProduct);
      });
    }

    // Filters
    if (cat) {
      items = items.filter(item => item.category === cat);
    }
    if (search) {
      const queryStr = search.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(queryStr) ||
        item.description.toLowerCase().includes(queryStr)
      );
    }

    // Sort mock products
    if (sortBy === 'price') {
      items.sort((a, b) => sortOrder === 'asc' ? a.price - b.price : b.price - a.price);
    } else if (sortBy === 'name') {
      items.sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    }

    const total = items.length;
    const limit = 12;
    const pages = Math.max(1, Math.ceil(total / limit));
    const startIdx = (page - 1) * limit;
    const list = items.slice(startIdx, startIdx + limit);

    return { list, total, pages };
  };

  const CHART_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#14b8a6', // Teal
    '#84cc16', // Lime
  ];

  const totalCategoryProducts = categoryWiseProducts.reduce((sum, c) => sum + c.count, 0);

  let cumulativeAngle = -Math.PI / 2;
  const chartSegments = categoryWiseProducts.map((catGroup, index) => {
    const percentage = totalCategoryProducts > 0 ? (catGroup.count / totalCategoryProducts) : 0;
    const angleDelta = percentage * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angleDelta;
    cumulativeAngle = endAngle;

    const radius = 80;
    const innerRadius = 55;

    const x1 = Math.cos(startAngle) * radius;
    const y1 = Math.sin(startAngle) * radius;
    const x2 = Math.cos(endAngle) * radius;
    const y2 = Math.sin(endAngle) * radius;

    const ix1 = Math.cos(startAngle) * innerRadius;
    const iy1 = Math.sin(startAngle) * innerRadius;
    const ix2 = Math.cos(endAngle) * innerRadius;
    const iy2 = Math.sin(endAngle) * innerRadius;

    const largeArcFlag = percentage > 0.5 ? 1 : 0;

    const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1} Z`.trim();

    return {
      category: catGroup.category,
      count: catGroup.count,
      percentage: (percentage * 100).toFixed(1),
      pathData,
      color: CHART_COLORS[index % CHART_COLORS.length],
      rawPercentage: percentage * 100
    };
  });

  const statsList = [
    { label: 'Total Catalog Products', value: totalProducts ? totalProducts.toLocaleString() : '5,000', desc: 'Active records count', icon: Database, color: 'var(--secondary-light)' },
    { label: 'Cache Hit Rate', value: `${cacheHitRate}%`, desc: 'Redis cache optimization ratio', icon: Cpu, color: 'var(--primary-light)' },
    { label: 'Average Query Latency', value: `${avgLatency} ms`, desc: 'Targeting sub-50ms operations', icon: Activity, color: 'var(--success)' },
    { label: 'Redis Connection State', value: apiStatus === 'Online' ? 'Active' : 'Standby', desc: 'Cache key invalidations live', icon: SlidersHorizontal, color: 'var(--warning)' }
  ];

  return (
    <div className="app-layout">
      {apiStatus === 'Offline' && (
        <div className="floating-alert">
          <span className="alert-pulse"></span>
          <span>Connection Lost: Local API Server Offline</span>
        </div>
      )}
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="brand-section">
            <Activity size={24} color="var(--primary-light)" />
            <span className="brand-name">AeroCache</span>
            <span className="brand-badge">v1.0.0</span>
          </div>

          <ul className="nav-links">
            <li
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <Activity size={18} />
              Dashboard
            </li>
            <li
              className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
              onClick={() => { setActiveTab('catalog'); setCurrentPage(1); }}
            >
              <Layers size={18} />
              Product Catalog
            </li>
            <li
              className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => { setActiveTab('admin'); setCurrentPage(1); }}
            >
              <SlidersHorizontal size={18} />
              Admin Portal
            </li>
            <li
              className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <Terminal size={18} />
              Telemetry Logs
            </li>
          </ul>
        </div>

        {/* System Connection Status Panel */}
        <div className="connection-status-panel">
          <h4 className="panel-title">System Status</h4>

          <div className="status-row">
            <span className="status-label">API Server</span>
            <span className="status-indicator">
              <span className={`dot ${apiStatus === 'Online' ? 'green' : apiStatus === 'Offline' ? 'red' : 'yellow'}`}></span>
              {apiStatus}
            </span>
          </div>

          <div className="status-row">
            <span className="status-label">MongoDB</span>
            <span className="status-indicator">
              <span className={`dot ${dbStatus === 'Connected' ? 'green' : dbStatus === 'Disconnected' ? 'red' : 'yellow'}`}></span>
              {dbStatus === 'Connected' ? 'Connected' : dbStatus === 'Disconnected' ? 'Disconnected' : 'Checking'}
            </span>
          </div>

          <div className="status-row">
            <span className="status-label">Redis Cache</span>
            <span className="status-indicator">
              <span className="dot yellow"></span>
              Standby
            </span>
          </div>
        </div>

        {/* Glassmorphic Theme Toggler */}
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {theme === 'dark' ? 'Cyber Dark' : 'Glass Light'}
            </span>
            <button
              onClick={toggleTheme}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '30px',
                padding: '0.35rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-area">
        {/* Header */}
        <header className="header">
          <h2 className="page-title">
            {activeTab === 'dashboard' && 'Dashboard Overview'}
            {activeTab === 'catalog' && 'Product Inventory'}
            {activeTab === 'admin' && 'Products Management Grid'}
            {activeTab === 'logs' && 'System Telemetry Logs'}
          </h2>

          <div className="telemetry-row" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="telemetry-item">
              <span className="telemetry-val text-glow" style={{ color: 'var(--success)' }}>{avgLatency} ms</span>
              <span className="telemetry-lbl">Avg Response Time</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-val" style={{ color: 'var(--primary-light)' }}>{cacheHitRate}%</span>
              <span className="telemetry-lbl">Cache Hit Ratio</span>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.5rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                color: 'var(--text-main)',
                position: 'relative',
                transition: 'all 0.2s',
              }}
              className={`cart-trigger-btn ${cartBadgePop ? 'cart-badge-pop' : ''}`}
            >
              <ShoppingCart size={15} color="var(--primary-light)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cart</span>
              {cart.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    backgroundColor: 'var(--danger)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    boxShadow: '0 0 6px var(--danger)',
                  }}
                >
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Active Content Frame */}
        <div className="content-frame">
          {activeTab === 'dashboard' && (
            <div className="fade-in">
              {/* Telemetry Widgets Grid */}
              <div className="dashboard-grid">
                {statsList.map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div className="widget-card" key={idx}>
                      <div className="widget-header">
                        <span>{stat.label}</span>
                        <Icon size={18} color={stat.color} />
                      </div>
                      <div className="widget-value">{stat.value}</div>
                      <div className="widget-description">{stat.desc}</div>
                    </div>
                  );
                })}
              </div>


              {/* Category Distribution Donut Chart Panel */}
              <div className="section-panel" style={{ marginBottom: '2rem' }}>
                <div className="panel-header-section">
                  <h3>Catalog Category Distribution</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Interactive analysis of products across top classifications
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
                  {/* Left Column: Interactive Donut Chart */}
                  <div style={{ position: 'relative', width: '220px', height: '220px', flexShrink: 0 }}>
                    <svg viewBox="-100 -100 200 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      {chartSegments.map((segment, idx) => {
                        const isHovered = hoveredSlice === idx;
                        return (
                          <path
                            key={idx}
                            d={segment.pathData}
                            fill={segment.color}
                            style={{
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              cursor: 'pointer',
                              transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                              filter: isHovered ? `drop-shadow(0 0 8px ${segment.color}88)` : 'none',
                              opacity: hoveredSlice !== null && !isHovered ? 0.65 : 1
                            }}
                            onMouseEnter={() => setHoveredSlice(idx)}
                            onMouseLeave={() => setHoveredSlice(null)}
                            onClick={() => handleCategoryClick(segment.category)}
                          />
                        );
                      })}
                    </svg>

                    {/* Donut Center Tooltip Information */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      width: '100px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      {hoveredSlice !== null ? (
                        <>
                          <span style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '90px'
                          }} title={chartSegments[hoveredSlice].category}>
                            {chartSegments[hoveredSlice].category}
                          </span>
                          <span style={{
                            fontSize: '1.05rem',
                            fontWeight: 800,
                            color: chartSegments[hoveredSlice].color,
                            marginTop: '2px',
                            textShadow: `0 0 6px ${chartSegments[hoveredSlice].color}44`
                          }}>
                            {chartSegments[hoveredSlice].percentage}%
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {chartSegments[hoveredSlice].count} items
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Catalog
                          </span>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                            {totalCategoryProducts}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                            items
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Premium Legend Grid */}
                  <div style={{ flex: 1, minWidth: '240px', display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
                    {chartSegments.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data loaded. Try catalog navigation first.</div>
                    ) : (
                      chartSegments.map((segment, idx) => {
                        const isHovered = hoveredSlice === idx;
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                              border: isHovered ? '1px solid var(--border-color)' : '1px solid transparent',
                              transition: 'all 0.2s',
                              cursor: 'pointer',
                              transform: isHovered ? 'translateX(5px)' : 'translateX(0)'
                            }}
                            onMouseEnter={() => setHoveredSlice(idx)}
                            onMouseLeave={() => setHoveredSlice(null)}
                            onClick={() => handleCategoryClick(segment.category)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: segment.color,
                                boxShadow: isHovered ? `0 0 8px ${segment.color}` : 'none',
                                display: 'inline-block',
                                flexShrink: 0
                              }} />
                              <span style={{
                                fontSize: '0.85rem',
                                color: isHovered ? 'var(--text-main)' : 'var(--text-muted)',
                                fontWeight: isHovered ? 600 : 500
                              }}>
                                {segment.category}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>
                                {segment.count} products
                              </span>
                              <span style={{
                                fontWeight: 700,
                                color: isHovered ? segment.color : 'var(--text-main)',
                                minWidth: '40px',
                                textAlign: 'right'
                              }}>
                                {segment.percentage}%
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* AI Search Analytics & Trends Panel */}
              <div className="section-panel" style={{ marginBottom: '2rem' }}>
                <div className="panel-header-section">
                  <div>
                    <h3>AI Search Analytics & Trends</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Analyzing search behaviors, query modes, and market gaps
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={fetchSearchAnalytics}
                      disabled={loadingAnalytics}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.4rem 0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      <RefreshCw size={12} className={loadingAnalytics ? 'spin-anim' : ''} />
                      Refresh
                    </button>
                    {authToken && (
                      <button
                        onClick={handleClearSearchLogs}
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid var(--danger)',
                          color: 'var(--danger)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Clear Logs
                      </button>
                    )}
                  </div>
                </div>

                {searchAnalytics ? (
                  <>
                    {/* Key Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
                      <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total AI Searches</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--primary-light)' }}>
                          {searchAnalytics.totalSearches.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unanswered Queries (0 Results)</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--danger)' }}>
                          {searchAnalytics.unansweredCount.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Search Success Rate</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--success)' }}>
                          {searchAnalytics.totalSearches > 0
                            ? `${(((searchAnalytics.totalSearches - searchAnalytics.unansweredCount) / searchAnalytics.totalSearches) * 100).toFixed(1)}%`
                            : '100%'}
                        </div>
                      </div>
                    </div>

                    {/* Search Type Proportions */}
                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span>Search Type Distribution</span>
                        <span>
                          Text: {searchAnalytics.typeDistribution.text} |
                          Semantic: {searchAnalytics.typeDistribution.vector} |
                          Visual: {searchAnalytics.typeDistribution.image}
                        </span>
                      </div>
                      <div className="distribution-bar">
                        {(() => {
                          const total = searchAnalytics.totalSearches || 1;
                          const textPct = (searchAnalytics.typeDistribution.text / total) * 100;
                          const vectorPct = (searchAnalytics.typeDistribution.vector / total) * 100;
                          const imagePct = (searchAnalytics.typeDistribution.image / total) * 100;
                          return (
                            <>
                              <div className="distribution-segment text" style={{ width: `${textPct}%` }} title={`Text: ${textPct.toFixed(1)}%`} />
                              <div className="distribution-segment vector" style={{ width: `${vectorPct}%` }} title={`Semantic/Vector: ${vectorPct.toFixed(1)}%`} />
                              <div className="distribution-segment image" style={{ width: `${imagePct}%` }} title={`Visual/Image: ${imagePct.toFixed(1)}%`} />
                            </>
                          );
                        })()}
                      </div>
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }} />
                          Keyword/Text Search
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                          AI Semantic Search
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                          AI Visual Search
                        </span>
                      </div>
                    </div>

                    {/* Trend Line/Bar Chart (SVG) */}
                    <div className="trends-chart-wrapper">
                      <div style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>Search Volume Trends</div>
                      {searchAnalytics.trends.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No trend data available</div>
                      ) : (
                        (() => {
                          const maxVal = Math.max(...searchAnalytics.trends.map(t => t.count), 1);
                          const chartHeight = 120;
                          const chartWidth = 700;
                          const paddingX = 40;
                          const paddingY = 20;

                          // Generate coordinates for the polyline
                          const points = searchAnalytics.trends.map((item, idx) => {
                            const x = paddingX + (idx / (searchAnalytics.trends.length - 1)) * (chartWidth - paddingX * 2);
                            const y = chartHeight - paddingY - (item.count / maxVal) * (chartHeight - paddingY * 2);
                            return `${x},${y}`;
                          }).join(' ');

                          return (
                            <div style={{ width: '100%', overflowX: 'auto' }}>
                              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', minWidth: '600px', height: '140px', overflow: 'visible' }}>
                                {/* Horizontal grid lines */}
                                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                  const y = chartHeight - paddingY - ratio * (chartHeight - paddingY * 2);
                                  const val = Math.round(ratio * maxVal);
                                  return (
                                    <g key={i} opacity="0.15">
                                      <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="4,4" />
                                      <text x={paddingX - 10} y={y + 4} textAnchor="end" fontSize="9" fill="var(--text-muted)">{val}</text>
                                    </g>
                                  );
                                })}

                                {/* Line path */}
                                <polyline
                                  fill="none"
                                  stroke="var(--primary-light)"
                                  strokeWidth="2.5"
                                  points={points}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />

                                {/* Interactive Data Points */}
                                {searchAnalytics.trends.map((item, idx) => {
                                  const x = paddingX + (idx / (searchAnalytics.trends.length - 1)) * (chartWidth - paddingX * 2);
                                  const y = chartHeight - paddingY - (item.count / maxVal) * (chartHeight - paddingY * 2);
                                  // Short date like "08-05"
                                  const dateLabel = item.date.substring(5);
                                  return (
                                    <g key={idx}>
                                      <circle
                                        cx={x}
                                        cy={y}
                                        r="4"
                                        fill="var(--primary)"
                                        stroke="#fff"
                                        strokeWidth="1.5"
                                        style={{ cursor: 'pointer' }}
                                      />
                                      <text
                                        x={x}
                                        y={chartHeight - 4}
                                        textAnchor="middle"
                                        fontSize="9"
                                        fill="var(--text-muted)"
                                        fontWeight="500"
                                      >
                                        {idx % 2 === 0 ? dateLabel : ''}
                                      </text>
                                      <title>{`${item.date}: ${item.count} searches`}</title>
                                    </g>
                                  );
                                })}
                              </svg>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Two Column Grid for Top Searches & Unanswered Queries */}
                    <div className="analytics-subgrid">
                      {/* Top Searched Queries */}
                      <div className="analytics-table-container">
                        <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>🔥 Top Search Queries</span>
                        </h4>
                        {searchAnalytics.topQueries.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>No search queries recorded yet.</div>
                        ) : (
                          <table className="analytics-table">
                            <thead>
                              <tr>
                                <th>Query</th>
                                <th>Type</th>
                                <th style={{ textAlign: 'right' }}>Volume</th>
                              </tr>
                            </thead>
                            <tbody>
                              {searchAnalytics.topQueries.map((item, idx) => (
                                <tr key={idx}>
                                  <td style={{ fontWeight: 600 }}>"{item.query}"</td>
                                  <td>
                                    <span className={`tag-searchtype ${item.type}`}>
                                      {item.type}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <span className="badge-count">{item.count}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Unanswered / Zero-Result Queries */}
                      <div className="analytics-table-container">
                        <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>⚠️ Unanswered Queries (0 Results)</span>
                        </h4>
                        {searchAnalytics.unansweredQueries.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>No unanswered queries! Excellent inventory coverage.</div>
                        ) : (
                          <table className="analytics-table">
                            <thead>
                              <tr>
                                <th>Query</th>
                                <th>Last Searched</th>
                                <th style={{ textAlign: 'right' }}>Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {searchAnalytics.unansweredQueries.map((item, idx) => {
                                const dateObj = new Date(item.lastSearched);
                                const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
                                return (
                                  <tr key={idx}>
                                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>"{item.query}"</td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formattedDate}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <span className="badge-count badge-unanswered">{item.count}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.25rem' }} className="fade-in">
                    {/* Key Stats Cards Skeleton */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <div className="shimmer-card" key={idx} style={{ height: '90px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <div className="shimmer-item" style={{ height: '14px', width: '60%' }}></div>
                          <div className="shimmer-item" style={{ height: '24px', width: '40%' }}></div>
                        </div>
                      ))}
                    </div>
                    {/* Search Distribution & Chart Skeleton */}
                    <div className="shimmer-card" style={{ height: '200px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="shimmer-item" style={{ height: '20px', width: '30%' }}></div>
                      <div className="shimmer-item" style={{ height: '8px', width: '100%' }}></div>
                      <div className="shimmer-item" style={{ height: '100px', width: '100%' }}></div>
                    </div>
                    {/* Tables Skeleton */}
                    <div className="analytics-subgrid">
                      {Array.from({ length: 2 }).map((_, idx) => (
                        <div className="shimmer-card" key={idx} style={{ height: '260px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div className="shimmer-item" style={{ height: '20px', width: '50%' }}></div>
                          {Array.from({ length: 4 }).map((_, rIdx) => (
                            <div key={rIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '0.25rem' }}>
                              <div className="shimmer-item" style={{ height: '16px', width: '60%' }}></div>
                              <div className="shimmer-item" style={{ height: '16px', width: '15%' }}></div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cache Response Latency Comparison Panel */}
              <div className="section-panel" style={{ marginBottom: '2rem' }}>
                <div className="panel-header-section">
                  <h3>Cache Response Latency Comparison</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Visualizing speed improvements of Cache-Aside patterns
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
                  {/* Cache Hit Row */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="dot green" style={{ width: '6px', height: '6px', animation: 'none' }}></span>
                        Redis Cache Hit
                      </span>
                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>&lt; 15 ms</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '12%', height: '100%', background: 'linear-gradient(90deg, var(--success) 0%, #059669 100%)', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  {/* Cache Miss Row */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="dot yellow" style={{ width: '6px', height: '6px', animation: 'none' }}></span>
                        MongoDB Database Query (Cold Read / Miss)
                      </span>
                      <span style={{ color: 'var(--warning)', fontWeight: 700 }}>~80 ms</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '80%', height: '100%', background: 'linear-gradient(90deg, var(--warning) 0%, #d97706 100%)', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🚀 Cache Hits deliver a <strong>~5.3x speed increase</strong>.</span>
                  <span style={{ color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => fetchProducts()}>
                    Recalculate metrics
                  </span>
                </div>
              </div>

              {/* Console log list preview */}
              <div className="section-panel">
                <div className="panel-header-section">
                  <h3>Recent Cache Activity</h3>
                  <button
                    onClick={() => fetchProducts()}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.4rem 0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={12} />
                    Refresh logs
                  </button>
                </div>

                <div className="log-list">
                  {logs.slice(0, 4).map((log, idx) => (
                    <div className="log-entry" key={idx}>
                      <span className={`log-method ${log.method.toLowerCase()}`}>{log.method}</span>
                      <span className="log-path">{log.path}</span>
                      <span className={`log-tag ${getLogTagClass(log.status)}`}>{log.status}</span>
                      <span className={`log-latency ${log.speed}`}>{log.latency}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'catalog' && (
            <div className="section-panel fade-in">
              {/* Filter Controls Header */}
              <div className="panel-header-section" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={imagePreview ? "📷 [Image Search Active]" : searchTerm}
                      onChange={handleSearch}
                      onKeyDown={handleSearchKeyDown}
                      disabled={!!imagePreview}
                      placeholder={imagePreview ? "Visual search query active..." : "Search product catalog..."}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.5rem 2.8rem 0.5rem 2.2rem',
                        fontSize: '0.9rem',
                        outline: 'none',
                        color: imagePreview ? 'var(--primary-light)' : 'var(--text-main)',
                        fontWeight: imagePreview ? 600 : 'normal'
                      }}
                    />

                    {/* Visual Camera Search Trigger */}
                    <div style={{ position: 'absolute', right: '12px', top: '9px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isImageSearching ? (
                        <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--primary-light)' }} />
                      ) : imagePreview ? (
                        <button
                          onClick={clearImageSearch}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                          title="Clear Image Search"
                        >
                          <X size={14} style={{ color: 'var(--danger)' }} />
                        </button>
                      ) : (
                        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Search by Image">
                          <Camera size={14} className="hover-primary" style={{ color: 'var(--text-muted)', transition: 'color 0.2s' }} />
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleImageSearchUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1.5rem 0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      color: 'var(--text-main)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">All Categories</option>
                    {dynamicCategories.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <select
                    value={`${sortBy}:${sortOrder}`}
                    onChange={handleSortChange}
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1.5rem 0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      color: 'var(--text-main)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="createdAt:desc">Newest Products</option>
                    <option value="price:asc">Price: Low to High</option>
                    <option value="price:desc">Price: High to Low</option>
                    <option value="name:asc">Product Name: A-Z</option>
                    <option value="name:desc">Product Name: Z-A</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isVectorSearch}
                      onChange={(e) => { setIsVectorSearch(e.target.checked); }}
                    />
                    Show AI Search Telemetry
                  </label>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {totalProducts ? `${totalProducts} products` : 'No products'}
                  </span>
                </div>
              </div>

              {/* Layout Mode Selector (Only show if search is empty) */}
              {!searchTerm && (
                <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 1.5rem 1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <button
                    onClick={() => setIsCategoryWiseMode(false)}
                    style={{
                      padding: '0.35rem 0.9rem',
                      borderRadius: '20px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: !isCategoryWiseMode ? 'var(--primary)' : 'var(--bg-surface)',
                      color: !isCategoryWiseMode ? '#fff' : 'var(--text-main)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: !isCategoryWiseMode ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    All Products (Grid)
                  </button>
                  <button
                    onClick={() => { setIsCategoryWiseMode(true); fetchCategoryWiseProducts(); }}
                    style={{
                      padding: '0.35rem 0.9rem',
                      borderRadius: '20px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isCategoryWiseMode ? 'var(--primary)' : 'var(--bg-surface)',
                      color: isCategoryWiseMode ? '#fff' : 'var(--text-main)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: isCategoryWiseMode ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Category-Wise (Carousel)
                  </button>
                </div>
              )}


              {/* Did you mean Suggestion */}
              {searchTerm && getTypoSuggestion(searchTerm) && (
                <div style={{ padding: '0.2rem 1.5rem 0.8rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  Did you mean:{' '}
                  <span
                    onClick={() => { setSearchTerm(getTypoSuggestion(searchTerm) || ''); setIsVectorSearch(true); }}
                    style={{
                      color: 'var(--primary)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {getTypoSuggestion(searchTerm)}
                  </span>
                  ?
                </div>
              )}

              {/* Popular Searches when search input is empty */}
              {!searchTerm && (
                <div style={{ padding: '0.2rem 1.5rem 1rem 1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Popular Searches:</span>
                  {["t-shirt", "wireless earbuds", "gaming laptop", "running shoes", "chef knife"].map((term, idx) => (
                    <span
                      key={idx}
                      onClick={() => { setSearchTerm(term); setIsVectorSearch(true); }}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        color: 'var(--primary)',
                        fontWeight: 500,
                        transition: 'all 0.2s ease'
                      }}
                      className="hover-glow"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              )}

              {/* Related Searches when search input is active */}
              {searchTerm && (
                <div style={{ padding: '0.2rem 1.5rem 0.8rem 1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Related Searches:</span>
                  {(searchTelemetry?.parsedQuery?.category === "Men's Clothing" || searchTelemetry?.parsedQuery?.category === "Women's Clothing"
                    ? ["casual shirt", "denim jeans", "winter jacket", "leather belt"]
                    : ["Electronics", "Laptops", "Mobiles"].includes(searchTelemetry?.parsedQuery?.category || '')
                      ? ["mechanical keyboard", "bluetooth speaker", "smart watch", "laptop stand"]
                      : searchTelemetry?.parsedQuery?.category === "Shoes"
                        ? ["leather boots", "canvas sneakers", "athletic socks", "penny loafers"]
                        : searchTelemetry?.parsedQuery?.category === "Grocery"
                          ? ["dark roast coffee", "pink salt", "green tea", "english breakfast"]
                          : searchTelemetry?.parsedQuery?.category === "Books"
                            ? ["sci-fi novels", "cookbooks", "mystery thriller", "fantasy epics"]
                            : ["t-shirt", "wireless earbuds", "running shoes", "coffee mug"]
                  ).map((term, idx) => (
                    <span
                      key={idx}
                      onClick={() => { setSearchTerm(term); setIsVectorSearch(true); }}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        color: 'var(--text-main)',
                        transition: 'all 0.2s ease'
                      }}
                      className="hover-glow"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              )}

              {/* AI Image Search Preview & Prediction */}
              {imagePreview && (
                <div style={{
                  margin: '0 1.5rem 1rem 1.5rem',
                  padding: '1rem',
                  backgroundColor: 'rgba(139, 92, 246, 0.05)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  flexWrap: 'wrap'
                }}>
                  {/* Thumbnail Preview */}
                  <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--primary-light)', boxShadow: '0 0 10px rgba(139, 92, 246, 0.3)', flexShrink: 0 }}>
                    <img src={imagePreview} alt="Search Query" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>

                  {/* AI Label & Confidence */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>AI Identified Object:</span>
                      {imagePrediction ? (
                        <span style={{ backgroundColor: 'var(--primary)', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, boxShadow: '0 0 8px rgba(99, 102, 241, 0.4)' }}>
                          {imagePrediction.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Classifying visual features...</span>
                      )}
                    </div>
                    {imagePrediction && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, imagePrediction.score * 100)}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '3px' }}></div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>
                          {Math.round(imagePrediction.score * 100)}% Match
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Clear Button */}
                  <button
                    onClick={clearImageSearch}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.2s'
                    }}
                    className="hover-danger-bg"
                  >
                    <X size={12} />
                    Reset Search
                  </button>
                </div>
              )}

              {/* AI Search Telemetry details */}
              {searchTelemetry && (
                <div style={{
                  margin: '0 1.5rem 1rem 1.5rem',
                  padding: '0.6rem 1rem',
                  backgroundColor: 'rgba(139, 92, 246, 0.04)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <span>
                    ⚡ Search processed in <strong style={{ color: 'var(--primary-light)' }}>{searchTelemetry.latencyMs}ms</strong> via <span style={{ textTransform: 'capitalize', color: 'var(--text-main)', fontWeight: 600 }}>{searchTelemetry.layerUsed}</span>
                  </span>
                  {Object.keys(searchTelemetry.parsedQuery).length > 0 && (
                    <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {Object.entries(searchTelemetry.parsedQuery).map(([key, val]) => (
                        <span key={key} style={{ backgroundColor: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.72rem' }}>
                          <strong>{key}</strong>: {String(val)}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )}

              {/* Shimmer loading grids vs Products Catalog grid vs Category-Wise layout */}
              {isCategoryWiseMode && !searchTerm ? (
                categoryWiseLoading ? (
                  <div className="shimmer-container">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div className="shimmer-card" key={idx}>
                        <div className="shimmer-item shimmer-img"></div>
                        <div className="shimmer-item shimmer-title"></div>
                        <div className="shimmer-item shimmer-price"></div>
                      </div>
                    ))}
                  </div>
                ) : categoryWiseProducts.length === 0 ? (
                  <div style={{ padding: '4rem 0', color: 'var(--text-muted)', textAlign: 'center' }}>
                    <p>No categories found.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', padding: '0 1.5rem 2rem 1.5rem' }}>
                    {categoryWiseProducts.map((catGroup) => (
                      <div key={catGroup.category} className="category-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {catGroup.category}
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '12px' }}>
                              {catGroup.count} products
                            </span>
                          </h3>
                          <button
                            onClick={() => {
                              setSelectedCategory(catGroup.category);
                              setIsCategoryWiseMode(false);
                              setCurrentPage(1);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary-light)',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}
                          >
                            View All &rarr;
                          </button>
                        </div>

                        {/* Horizontal Scroll Carousel Wrapper */}
                        <div className="carousel-wrapper-container">
                          {/* Scroll Left Button */}
                          <button
                            className="carousel-scroll-btn left"
                            onClick={() => {
                              const row = document.getElementById(`carousel-${catGroup.category.replace(/\s+/g, '-')}`);
                              if (row) row.scrollBy({ left: -320, behavior: 'smooth' });
                            }}
                            title="Scroll Left"
                          >
                            <ChevronLeft size={20} />
                          </button>

                          {/* Horizontal Scroll Carousel */}
                          <div
                            id={`carousel-${catGroup.category.replace(/\s+/g, '-')}`}
                            className="category-carousel-row"
                            style={{
                              display: 'flex',
                              gap: '1.25rem',
                              overflowX: 'auto',
                              paddingBottom: '0.75rem',
                              scrollSnapType: 'x mandatory',
                              WebkitOverflowScrolling: 'touch',
                              scrollbarWidth: 'thin'
                            }}
                          >
                            {catGroup.products.map((p) => (
                              <div
                                className="product-card"
                                key={p._id}
                                style={{
                                  minWidth: '240px',
                                  width: '240px',
                                  flexShrink: 0,
                                  margin: '0.25rem 0',
                                  scrollSnapAlign: 'start',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  height: '360px',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <div className="product-img-wrapper" style={{ height: '160px' }}>
                                  <span className="category-tag">{p.category}</span>
                                  <img
                                    className="product-img"
                                    src={p.imageUrl || getLoremFlickrUrl(p.name, p.category)}
                                    alt={p.name}
                                    loading="lazy"
                                    onError={(e) => {
                                      const t = e.currentTarget;
                                      t.onerror = null;
                                      t.src = getLoremFlickrUrl(p.name, p.category);
                                    }}
                                  />
                                </div>
                                <div className="product-info" style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                  <div>
                                    <h4 className="product-name" style={{ fontSize: '0.82rem', marginBottom: '0.25rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={p.name}>
                                      {p.name}
                                    </h4>
                                    <p className="product-desc" style={{ fontSize: '0.72rem', height: '32px', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                      {p.description}
                                    </p>
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      <span className={`product-stock ${p.stock < 50 ? 'low-stock' : ''}`}>
                                        {p.stock === 0 ? 'Out of Stock' : `${p.stock} in stock`}
                                      </span>
                                    </div>
                                    <div className="product-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span className="product-price" style={{ fontSize: '0.85rem' }}>${p.price.toFixed(2)}</span>
                                      <button
                                        onClick={(e) => addToCart(p, e)}
                                        disabled={p.stock === 0}
                                        className="btn btn-primary"
                                        style={{
                                          padding: '0.25rem 0.6rem',
                                          fontSize: '0.75rem',
                                          background: p.stock === 0 ? 'var(--border-color)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                                          cursor: p.stock === 0 ? 'not-allowed' : 'pointer',
                                          border: 'none',
                                        }}
                                      >
                                        Add
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Scroll Right Button */}
                          <button
                            className="carousel-scroll-btn right"
                            onClick={() => {
                              const row = document.getElementById(`carousel-${catGroup.category.replace(/\s+/g, '-')}`);
                              if (row) row.scrollBy({ left: 320, behavior: 'smooth' });
                            }}
                            title="Scroll Right"
                          >
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <>
                  {loading ? (
                    <div className="shimmer-container">
                      {Array.from({ length: 8 }).map((_, idx) => (
                        <div className="shimmer-card" key={idx}>
                          <div className="shimmer-item shimmer-img"></div>
                          <div className="shimmer-item shimmer-title"></div>
                          <div className="shimmer-item shimmer-text"></div>
                          <div className="shimmer-item shimmer-text" style={{ width: '85%' }}></div>
                          <div className="shimmer-item shimmer-price"></div>
                        </div>
                      ))}
                    </div>
                  ) : products.length === 0 ? (
                    <div style={{ padding: '4rem 0', color: 'var(--text-muted)', textAlign: 'center' }}>
                      <p>No products match your search or filter settings.</p>
                    </div>
                  ) : (
                    <div className="catalog-grid">
                      {products.map((p) => (
                        <div className="product-card" key={p._id}>
                          <div className="product-img-wrapper">
                            <span className="category-tag">{p.category}</span>
                            {p.score !== undefined && (
                              <span className="score-tag">
                                AI Match: {Math.round(p.score * 100)}%
                              </span>
                            )}
                            <img
                              className="product-img"
                              src={p.imageUrl || getLoremFlickrUrl(p.name, p.category)}
                              alt={p.name}
                              loading="lazy"
                              onError={(e) => {
                                const t = e.currentTarget;
                                t.onerror = null;
                                t.src = getLoremFlickrUrl(p.name, p.category);
                              }}
                            />
                          </div>
                          <div className="product-info">
                            <h4 className="product-name">{highlightKeywords(p.name, searchTerm)}</h4>
                            <p className="product-desc">{highlightKeywords(p.description, searchTerm)}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              <span className={`product-stock ${p.stock < 50 ? 'low-stock' : ''}`}>
                                {p.stock === 0 ? 'Out of Stock' : `${p.stock} in stock`}
                              </span>
                            </div>
                            <div className="product-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                              <span className="product-price">${p.price.toFixed(2)}</span>
                              <button
                                onClick={(e) => addToCart(p, e)}
                                disabled={p.stock === 0}
                                className="btn btn-primary"
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.8rem',
                                  background: p.stock === 0 ? 'var(--border-color)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                                  cursor: p.stock === 0 ? 'not-allowed' : 'pointer',
                                  border: 'none',
                                }}
                              >
                                Add to Cart
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination controls footer */}
                  {totalPages > 1 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '2rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-color)'
                      }}
                    >
                      <button
                        disabled={currentPage === 1 || loading}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.5rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.85rem',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          opacity: currentPage === 1 ? 0.5 : 1
                        }}
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>

                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Page {currentPage} of {totalPages}
                      </span>

                      <button
                        disabled={currentPage >= totalPages || loading}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.5rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.85rem',
                          cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                          opacity: currentPage >= totalPages ? 0.5 : 1
                        }}
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'admin' && !authToken && (
            <div className="section-panel fade-in" style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Admin Authorization Required
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Provide admin credentials to access the products management panel.
                </p>
              </div>

              {loginError && (
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--danger-glow)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '1rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLoginSubmit}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                  Authenticate Admin
                </button>
              </form>
            </div>
          )}

          {activeTab === 'admin' && authToken && (
            <div className="section-panel fade-in">
              {/* Filter Controls Header */}
              <div className="panel-header-section" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleSearch}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search admin inventory..."
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.5rem 0.5rem 0.5rem 2.2rem',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1.5rem 0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      color: 'var(--text-main)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">All Categories</option>
                    {dynamicCategories.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <select
                    value={`${sortBy}:${sortOrder}`}
                    onChange={handleSortChange}
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1.5rem 0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      color: 'var(--text-main)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="createdAt:desc">Newest Products</option>
                    <option value="price:asc">Price: Low to High</option>
                    <option value="price:desc">Price: High to Low</option>
                    <option value="name:asc">Product Name: A-Z</option>
                    <option value="name:desc">Product Name: Z-A</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {totalProducts} total items
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={() => setEditingProduct({ _id: '', name: '', description: '', price: 0, stock: 0, category: dynamicCategories[0] || CATEGORIES[0], tags: [], imageUrl: '' } as any)}
                  >
                    Create Product
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </div>

              {/* Table Loader vs Admin Inventory Table */}
              {loading ? (
                <div className="shimmer-container" style={{ gridTemplateColumns: '1fr', gap: '0.5rem', marginTop: '1.5rem' }}>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div className="shimmer-card" key={idx} style={{ height: '50px', padding: '0.5rem 1rem', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="shimmer-item" style={{ height: '20px', width: '30%' }}></div>
                      <div className="shimmer-item" style={{ height: '20px', width: '15%' }}></div>
                      <div className="shimmer-item" style={{ height: '20px', width: '10%' }}></div>
                      <div className="shimmer-item" style={{ height: '20px', width: '10%' }}></div>
                      <div className="shimmer-item" style={{ height: '20px', width: '15%' }}></div>
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div style={{ padding: '4rem 0', color: 'var(--text-muted)', textAlign: 'center' }}>
                  <p>No products match your search or filter settings.</p>
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock Level</th>
                        <th>Cache State</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const isZeroStock = p.stock === 0;
                        return (
                          <tr key={p._id}>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td>{p.category}</td>
                            <td style={{ color: 'var(--secondary-light)', fontWeight: 700 }}>${p.price.toFixed(2)}</td>
                            <td style={{ color: isZeroStock ? 'var(--danger)' : 'inherit' }}>
                              {isZeroStock ? 'Out of Stock' : `${p.stock} units`}
                            </td>
                            <td>
                              <span className={`log-tag hit`}>Cached</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => setEditingProduct(p)}
                                  title="Edit details"
                                >
                                  <Edit size={14} />
                                  Edit
                                </button>
                                <button
                                  className="btn btn-danger"
                                  onClick={() => handleDelete(p._id)}
                                  disabled={deletingId === p._id}
                                  title="Delete product"
                                >
                                  <Trash2 size={14} />
                                  {deletingId === p._id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination controls footer */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '2rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-color)'
                  }}
                >
                  <button
                    disabled={currentPage === 1 || loading}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.85rem',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: currentPage === 1 ? 0.5 : 1
                    }}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.85rem',
                      cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                      opacity: currentPage >= totalPages ? 0.5 : 1
                    }}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="section-panel fade-in">
              <div className="panel-header-section">
                <h3>Live Console Telemetry</h3>
                <span className="telemetry-lbl">WebSocket Streaming Logs</span>
              </div>
              <div className="log-list">
                {logs.map((log, idx) => (
                  <div className="log-entry" key={idx}>
                    <span className={`log-method ${log.method.toLowerCase()}`}>{log.method}</span>
                    <span className="log-path">{log.path}</span>
                    <span className={`log-tag ${getLogTagClass(log.status)}`}>{log.status}</span>
                    <span className={`log-latency ${log.speed}`}>{log.latency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Slide-out Edit/Create Product Drawer */}
      {editingProduct && (
        <div className="drawer-overlay" onClick={() => setEditingProduct(null)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 className="drawer-title">
                {editingProduct._id ? 'Modify Product Details' : 'Create New Product'}
              </h3>
              <button
                className="btn btn-secondary"
                onClick={() => setEditingProduct(null)}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-input"
                  required
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {dynamicCategories.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Stock Level</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Product Description</label>
                <textarea
                  className="form-input form-textarea"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Product Image URL</label>
                <input
                  type="url"
                  className="form-input"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://picsum.photos/seed/..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tags (comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="electronics, tv, smart"
                />
              </div>

              <div className="drawer-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditingProduct(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shopping Cart Sidebar Drawer Overlay */}
      {isCartOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fade-in 0.2s ease-out'
          }}
          onClick={() => setIsCartOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '450px',
              height: '100%',
              backgroundColor: 'var(--bg-card)',
              borderLeft: '1px solid var(--border-color)',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem',
              position: 'relative',
              animation: 'slide-in-drawer 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingCart size={20} color="var(--primary-light)" />
                Your Shopping Cart
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.2rem'
                }}
              >
                &times;
              </button>
            </div>

            {/* Cart Items List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.25rem' }}>
              {cart.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  <ShoppingCart size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Your cart is empty.</p>
                  <button
                    onClick={() => { setIsCartOpen(false); setActiveTab('catalog'); }}
                    className="btn btn-primary"
                    style={{ marginTop: '1rem' }}
                  >
                    Browse Catalog
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product._id}
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={item.product.imageUrl || getLoremFlickrUrl(item.product.name, item.product.category, 120, 120)}
                      alt={item.product.name}
                      style={{ width: '60px', height: '60px', borderRadius: '4px', objectFit: 'cover' }}
                      onError={(e) => {
                        const t = e.currentTarget;
                        t.onerror = null;
                        t.src = getLoremFlickrUrl(item.product.name, item.product.category, 120, 120);
                      }}
                    />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
                          {item.product.name}
                        </h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Unit Price: ${item.product.price.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                          <button
                            onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)}
                            style={{ border: 'none', backgroundColor: 'transparent', padding: '0.2rem 0.5rem', color: 'var(--text-main)', cursor: 'pointer' }}
                          >
                            -
                          </button>
                          <span style={{ padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)}
                            style={{ border: 'none', backgroundColor: 'transparent', padding: '0.2rem 0.5rem', color: 'var(--text-main)', cursor: 'pointer' }}
                          >
                            +
                          </button>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-light)' }}>
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product._id)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        padding: '0.2rem'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Recommendations Section */}
            {cart.length > 0 && recommendations.length > 0 && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <Layers size={14} color="var(--success)" />
                  People Also Viewed (AI Recommendations)
                </h4>

                <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'thin' }}>
                  {recommendations.map((rec) => (
                    <div
                      key={rec._id}
                      style={{
                        minWidth: '135px',
                        width: '135px',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.4rem'
                      }}
                    >
                      <img
                        src={rec.imageUrl || getLoremFlickrUrl(rec.name, rec.category, 270, 160)}
                        alt={rec.name}
                        style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }}
                        onError={(e) => {
                          const t = e.currentTarget;
                          t.onerror = null;
                          t.src = getLoremFlickrUrl(rec.name, rec.category, 270, 160);
                        }}
                      />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h5 style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.name}>
                            {rec.name}
                          </h5>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                            ${rec.price.toFixed(2)}
                          </span>
                        </div>
                        <button
                          onClick={() => addToCart(rec)}
                          disabled={rec.stock === 0}
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            padding: '0.25rem',
                            fontSize: '0.7rem',
                            marginTop: '0.4rem',
                            border: 'none',
                            background: rec.stock === 0 ? 'var(--border-color)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                            cursor: rec.stock === 0 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {rec.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drawer Footer: Coupon and Calculation details */}
            {cart.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1rem' }}>
                {/* Coupon Code Input */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    placeholder="ENTER COUPON (e.g. SAVE20)"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem',
                      fontSize: '0.8rem',
                      outline: 'none',
                      color: 'var(--text-main)'
                    }}
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={calculating}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.8rem',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                  >
                    {calculating ? <RefreshCw size={12} className="animate-spin" /> : 'Apply'}
                  </button>
                </div>

                {couponError && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '-0.75rem', marginBottom: '0.75rem' }}>{couponError}</p>}
                {couponSuccess && <p style={{ color: 'var(--success)', fontSize: '0.75rem', marginTop: '-0.75rem', marginBottom: '0.75rem' }}>{couponSuccess}</p>}

                {/* Totals Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                    <span>${totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.discountApplied > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                      <span>Discount ({totals.discountPercent}%)</span>
                      <span>-${totals.discountApplied.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                    <span>Total Amount</span>
                    <span className="text-glow">${totals.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Checkout Trigger Button */}
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.95rem',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                  }}
                >
                  {checkingOut ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Processing Checkout...</span>
                    </>
                  ) : (
                    'Place Order'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flying particles overlay list */}
      {particles.map(p => (
        <div
          key={p.id}
          className="flying-particle"
          style={{
            left: `${p.x - 10}px`,
            top: `${p.y - 10}px`,
            '--target-x': `${p.tx}px`,
            '--target-y': `${p.ty}px`
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default App;
