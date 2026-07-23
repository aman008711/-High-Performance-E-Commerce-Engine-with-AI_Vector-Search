// API Service client wrapper for AeroCache E-Commerce Engine
const BASE_URL = '/api';

export interface ApiResponse<T> {
  data: T;
  latency: number; // Request duration in milliseconds
  cacheStatus: 'HIT' | 'MISS' | 'BYPASS'; // Captured from X-Cache header
}

// Custom request wrapper measuring performance metrics
async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const startTime = performance.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('adminToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(1));

    // Extract caching state headers sent by backend
    const xCacheHeader = response.headers.get('X-Cache');
    let cacheStatus: 'HIT' | 'MISS' | 'BYPASS' = 'BYPASS';
    if (xCacheHeader === 'HIT') cacheStatus = 'HIT';
    if (xCacheHeader === 'MISS') cacheStatus = 'MISS';

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP Error: ${response.status}`);
    }

    const payload = await response.json();
    
    // Return structured API response containing telemetry metrics
    return {
      data: payload.data !== undefined ? payload.data : payload,
      latency,
      cacheStatus,
    };
  } catch (error) {
    console.error(`[API Error] Request to ${path} failed:`, error);
    throw error;
  }
}

export interface ProductQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  tags?: string[];
  imageUrl?: string;
}

export interface ApiProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  tags: string[];
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheckResponse {
  status: string;
  message: string;
  timestamp: string;
  env: string;
  services: {
    database: 'connected' | 'disconnected';
    redis?: 'connected' | 'disconnected';
  };
}

export const api = {
  // Catalog Queries
  getProducts: (params: ProductQuery = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.category) query.append('category', params.category);
    if (params.search) query.append('search', params.search);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<{ products: ApiProduct[]; total: number; pages: number }>(`/products${queryString}`);
  },

  searchProductsVector: (params: ProductQuery = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.category) query.append('category', params.category);
    if (params.search) query.append('search', params.search || '');

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<{ products: ApiProduct[]; total: number; pages: number }>(`/products/search/vector${queryString}`);
  },

  getProduct: (id: string) => {
    return request<ApiProduct>(`/products/${id}`);
  },

  // Admin Mutations (Purges cache keys on database write)
  createProduct: (data: ProductInput) => {
    return request<ApiProduct>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateProduct: (id: string, data: Partial<ProductInput>) => {
    return request<ApiProduct>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteProduct: (id: string) => {
    return request<{ success: boolean; message: string }>(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  // Observability
  getHealth: () => {
    return request<HealthCheckResponse>('/health');
  },

  // Authentication
  login: (username: string, password: string) => {
    return request<{ token: string; user: { id: string; username: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
};
