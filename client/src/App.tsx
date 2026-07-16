import { useState, useEffect } from 'react';
import { api } from './services/api';
import { 
  Activity, 
  Layers, 
  Database, 
  Terminal, 
  Cpu, 
  RefreshCw, 
  Search, 
  Filter, 
  Plus, 
  SlidersHorizontal 
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'catalog' | 'logs'>('dashboard');
  const [apiStatus, setApiStatus] = useState<'Online' | 'Offline' | 'Checking'>('Checking');
  const [dbStatus, setDbStatus] = useState<'Connected' | 'Disconnected' | 'Checking'>('Checking');

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
    // Poll system health metrics every 15 seconds
    const intervalId = setInterval(checkSystemHealth, 15000);
    return () => clearInterval(intervalId);
  }, []);

  // Mock telemetry data
  const stats = [
    { label: 'Total Catalog Products', value: '5,000', desc: 'Successfully seeded in MongoDB', icon: Database, color: 'var(--secondary-light)' },
    { label: 'Cache Hit Rate', value: '94.8%', desc: 'Redis hit ratio past 24 hours', icon: Cpu, color: 'var(--primary-light)' },
    { label: 'Average Query Latency', value: '12.4 ms', desc: 'Sub-50ms threshold maintained', icon: Activity, color: 'var(--success)' },
    { label: 'Redis Memory Usage', value: '1.24 MB', desc: 'Memory consumption in Redis cache', icon: SlidersHorizontal, color: 'var(--warning)' }
  ];

  const mockLogs = [
    { method: 'GET', path: '/api/products', status: 'CACHE HIT', latency: '6ms', speed: 'fast' },
    { method: 'GET', path: '/api/products/6659f81a7b328a113a1de82e', status: 'CACHE HIT', latency: '4ms', speed: 'fast' },
    { method: 'PUT', path: '/api/products/6659f81a7b328a113a1de82e', status: 'CACHE EVICT', latency: '42ms', speed: 'fast' },
    { method: 'GET', path: '/api/products/6659f81a7b328a113a1de82e', status: 'CACHE MISS', latency: '78ms', speed: 'slow' },
    { method: 'GET', path: '/api/products?page=2&limit=20', status: 'CACHE HIT', latency: '11ms', speed: 'fast' },
    { method: 'POST', path: '/api/products/search/vector', status: 'VECTOR SEARCH', latency: '105ms', speed: 'slow' },
    { method: 'GET', path: '/api/products?category=Electronics', status: 'CACHE MISS', latency: '82ms', speed: 'slow' },
  ];

  const mockProducts = [
    { id: '1', name: 'Premium Leather Boots', category: 'Apparel & Fashion', price: '$129.99', stock: 142, status: 'In Cache' },
    { id: '2', name: 'Ergonomic Wooden Chair', category: 'Home & Kitchen', price: '$89.50', stock: 68, status: 'In Cache' },
    { id: '3', name: 'Wireless Noise-Cancelling Headphones', category: 'Electronics', price: '$249.99', stock: 310, status: 'Database Only' },
    { id: '4', name: 'Carbon Fiber Road Bike', category: 'Sports & Outdoors', price: '$1,150.00', stock: 12, status: 'In Cache' },
    { id: '5', name: 'Organic Hydrating Serum', category: 'Beauty & Personal Care', price: '$34.00', stock: 215, status: 'Database Only' },
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
              <span className="telemetry-val text-glow" style={{ color: 'var(--success)' }}>12.4 ms</span>
              <span className="telemetry-lbl">Avg Response Time</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-val" style={{ color: 'var(--primary-light)' }}>94.8%</span>
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
                {stats.map((stat, idx) => {
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
                  {mockLogs.slice(0, 4).map((log, idx) => (
                    <div className="log-entry" key={idx}>
                      <span className={`log-method ${log.method.toLowerCase()}`}>{log.method}</span>
                      <span className="log-path">{log.path}</span>
                      <span className={`log-tag ${log.status.toLowerCase().replace(' ', '')}`}>{log.status}</span>
                      <span className={`log-latency ${log.speed}`}>{log.latency}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'catalog' && (
            <div className="section-panel">
              <div className="panel-header-section">
                <div style={{ display: 'flex', gap: '1rem', flex: 1, maxWidth: '500px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Search mock catalog..." 
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.5rem 0.5rem 0.5rem 2rem',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                  <button 
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.9rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Filter size={14} />
                    Filter
                  </button>
                </div>
                <button 
                  style={{
                    backgroundColor: 'var(--primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem 1.2rem',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} />
                  Add Product
                </button>
              </div>

              {/* Products Table Placeholder */}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Product Name</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Price</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Stock</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Cache Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockProducts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{p.name}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{p.category}</td>
                      <td style={{ padding: '1rem' }}>{p.price}</td>
                      <td style={{ padding: '1rem' }}>{p.stock} units</td>
                      <td style={{ padding: '1rem' }}>
                        <span 
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: p.status === 'In Cache' ? 'var(--success-glow)' : 'rgba(100, 116, 139, 0.15)',
                            color: p.status === 'In Cache' ? 'var(--success)' : 'var(--text-muted)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: p.status === 'In Cache' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(100, 116, 139, 0.15)'
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="section-panel">
              <div className="panel-header-section">
                <h3>Live Console Telemetry</h3>
                <span className="telemetry-lbl">WebSocket Streaming Logs</span>
              </div>
              <div className="log-list">
                {mockLogs.map((log, idx) => (
                  <div className="log-entry" key={idx}>
                    <span className={`log-method ${log.method.toLowerCase()}`}>{log.method}</span>
                    <span className="log-path">{log.path}</span>
                    <span className={`log-tag ${log.status.toLowerCase().replace(' ', '').replace('/', '')}`}>{log.status}</span>
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
