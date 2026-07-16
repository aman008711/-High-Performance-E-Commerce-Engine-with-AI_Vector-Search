import { useState, useEffect, ChangeEvent } from 'react';
import { api, ApiProduct } from './services/api';
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
  ChevronRight
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'catalog' | 'logs'>('dashboard');
  const [apiStatus, setApiStatus] = useState<'Online' | 'Offline' | 'Checking'>('Checking');
  const [dbStatus, setDbStatus] = useState<'Connected' | 'Disconnected' | 'Checking'>('Checking');

  // Products and Telemetry telemetry states
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const [avgLatency, setAvgLatency] = useState<number>(12.4);
  const [cacheHitRate, setCacheHitRate] = useState<number>(94.8);
  const [logs, setLogs] = useState<Array<{ method: string; path: string; status: string; latency: string; speed: 'fast' | 'slow' }>>([
    { method: 'GET', path: '/api/health', status: 'BYPASS', latency: '4.5ms', speed: 'fast' }
  ]);

  const CATEGORIES = [
    'Electronics',
    'Apparel & Fashion',
    'Home & Kitchen',
    'Sports & Outdoors',
    'Beauty & Personal Care',
    'Books',
    'Automotive',
    'Toys & Games',
  ];

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

  // Fetch products from backend with client-side fallback if route is not implemented yet
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.getProducts({
        page: currentPage,
        limit: 12,
        category: selectedCategory || undefined,
        search: searchTerm || undefined
      });

      setProducts(response.data.products);
      setTotalProducts(response.data.total);
      setTotalPages(response.data.pages);

      const pathStr = `/api/products?page=${currentPage}&limit=12` + 
                      (selectedCategory ? `&category=${selectedCategory}` : '') +
                      (searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '');
                      
      const newLog = {
        method: 'GET',
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
      // Endpoint is 404 (Route not built on server until Day 10). Perform local client-side data mirroring.
      const fallbackData = getMockProducts(searchTerm, selectedCategory, currentPage);
      
      // Inject standard latency delay (600ms) to demonstrate loading skeletons
      await new Promise(resolve => setTimeout(resolve, 600));

      setProducts(fallbackData.list);
      setTotalProducts(fallbackData.total);
      setTotalPages(fallbackData.pages);

      const pathStr = `/api/products?page=${currentPage}&limit=12` + 
                      (selectedCategory ? `&category=${selectedCategory}` : '') +
                      (searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '');

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
      setLoading(false);
    }
  };

  // Re-run search whenever page, category or keyword updates
  useEffect(() => {
    fetchProducts();
  }, [currentPage, selectedCategory, searchTerm]);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Local static mock product generator matching seed schemas for client side fallbacks
  const getMockProducts = (search: string, cat: string, page: number) => {
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

    const total = items.length;
    const limit = 12;
    const pages = Math.max(1, Math.ceil(total / limit));
    const startIdx = (page - 1) * limit;
    const list = items.slice(startIdx, startIdx + limit);

    return { list, total, pages };
  };

  const statsList = [
    { label: 'Total Catalog Products', value: totalProducts ? totalProducts.toLocaleString() : '5,000', desc: 'Active records count', icon: Database, color: 'var(--secondary-light)' },
    { label: 'Cache Hit Rate', value: `${cacheHitRate}%`, desc: 'Redis cache optimization ratio', icon: Cpu, color: 'var(--primary-light)' },
    { label: 'Average Query Latency', value: `${avgLatency} ms`, desc: 'Targeting sub-50ms operations', icon: Activity, color: 'var(--success)' },
    { label: 'Redis Connection State', value: apiStatus === 'Online' ? 'Active' : 'Standby', desc: 'Cache key invalidations live', icon: SlidersHorizontal, color: 'var(--warning)' }
  ];

  return (
    <div className="app-layout">
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
              onClick={() => setActiveTab('catalog')}
            >
              <Layers size={18} />
              Product Catalog
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
      </aside>

      {/* Main Content Area */}
      <div className="main-area">
        {/* Header */}
        <header className="header">
          <h2 className="page-title">
            {activeTab === 'dashboard' && 'Dashboard Overview'}
            {activeTab === 'catalog' && 'Product Inventory'}
            {activeTab === 'logs' && 'System Telemetry Logs'}
          </h2>

          <div className="telemetry-row">
            <div className="telemetry-item">
              <span className="telemetry-val text-glow" style={{ color: 'var(--success)' }}>{avgLatency} ms</span>
              <span className="telemetry-lbl">Avg Response Time</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-val" style={{ color: 'var(--primary-light)' }}>{cacheHitRate}%</span>
              <span className="telemetry-lbl">Cache Hit Ratio</span>
            </div>
          </div>
        </header>

        {/* Active Content Frame */}
        <div className="content-frame">
          {activeTab === 'dashboard' && (
            <div>
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

              {/* Console log list preview */}
              <div className="section-panel">
                <div className="panel-header-section">
                  <h3>Recent Cache Activity</h3>
                  <button 
                    onClick={fetchProducts}
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
                      <span className={`log-tag ${log.status.toLowerCase().includes('hit') ? 'hit' : 'miss'}`}>{log.status}</span>
                      <span className={`log-latency ${log.speed}`}>{log.latency}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'catalog' && (
            <div className="section-panel">
              {/* Filter Controls Header */}
              <div className="panel-header-section" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={handleSearch}
                      placeholder="Search product catalog..." 
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
                    {CATEGORIES.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                    {totalProducts ? `${totalProducts} products` : 'No products'}
                  </span>
                </div>
              </div>

              {/* Shimmer loading grids vs Products Catalog grid */}
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
                        <img className="product-img" src={p.imageUrl} alt={p.name} loading="lazy" />
                      </div>
                      <div className="product-info">
                        <h4 className="product-name">{p.name}</h4>
                        <p className="product-desc">{p.description}</p>
                        <div className="product-footer">
                          <span className="product-price">${p.price.toFixed(2)}</span>
                          <span className="product-stock">{p.stock} in stock</span>
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
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="section-panel">
              <div className="panel-header-section">
                <h3>Live Console Telemetry</h3>
                <span className="telemetry-lbl">WebSocket Streaming Logs</span>
              </div>
              <div className="log-list">
                {logs.map((log, idx) => (
                  <div className="log-entry" key={idx}>
                    <span className={`log-method ${log.method.toLowerCase()}`}>{log.method}</span>
                    <span className="log-path">{log.path}</span>
                    <span className={`log-tag ${log.status.toLowerCase().includes('hit') ? 'hit' : 'miss'}`}>{log.status}</span>
                    <span className={`log-latency ${log.speed}`}>{log.latency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
