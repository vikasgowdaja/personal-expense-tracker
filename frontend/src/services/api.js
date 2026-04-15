import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ── Auto token refresh on 401 ──────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

function clearAuthAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  // Navigate to login without full page reload if possible
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, only once per request, skip auth endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh') &&
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/login-otp')
    ) {
      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['x-auth-token'] = token;
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { token: newToken, refreshToken: newRefresh } = res.data;

        localStorage.setItem('token', newToken);
        if (newRefresh) localStorage.setItem('refreshToken', newRefresh);

        api.defaults.headers.common['x-auth-token'] = newToken;
        originalRequest.headers['x-auth-token'] = newToken;

        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  verifyEmail: (data) => api.post('/auth/verify-email', data),
  login: (userData) => api.post('/auth/login', userData),
  requestOTP: (data) => api.post('/auth/request-otp', data),
  loginOTP: (data) => api.post('/auth/login-otp', data),
  refresh: (data) => api.post('/auth/refresh', data),
  logout: () => api.post('/auth/logout'),
  getUser: () => api.get('/auth/user'),
  updateUser: (data) => api.put('/auth/user', data)
};

// Expense API
export const expenseAPI = {
  getAll: () => api.get('/expenses'),
  getById: (id) => api.get(`/expenses/${id}`),
  create: (expenseData) => api.post('/expenses', expenseData),
  update: (id, expenseData) => api.put(`/expenses/${id}`, expenseData),
  delete: (id) => api.delete(`/expenses/${id}`),
  getStats: () => api.get('/expenses/stats/summary')
};

// Category API
export const categoryAPI = {
  getAll: () => api.get('/categories'),
  create: (categoryData) => api.post('/categories', categoryData)
};

// Processed Data API (OpenAI results)
export const processedDataAPI = {
  getAll: () => api.get('/ocr/processed')
};

// TEMS APIs
export const trainerAPI = {
  getAll: () => api.get('/trainers'),
  create: (data) => api.post('/trainers', data),
  update: (id, data) => api.put(`/trainers/${id}`, data),
  delete: (id) => api.delete(`/trainers/${id}`),
  importFromPdf: (formData) => api.post('/trainers/import-pdf', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
};

export const institutionAPI = {
  getAll: () => api.get('/institutions'),
  create: (data) => api.post('/institutions', data),
  update: (id, data) => api.put(`/institutions/${id}`, data),
  delete: (id) => api.delete(`/institutions/${id}`)
};

export const clientAPI = {
  getAll: () => api.get('/clients'),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`)
};

export const topicAPI = {
  getAll: () => api.get('/topics'),
  create: (data) => api.post('/topics', data),
  seedDefaults: () => api.post('/topics/seed-defaults'),
  update: (id, data) => api.put(`/topics/${id}`, data),
  delete: (id) => api.delete(`/topics/${id}`)
};

export const trainingEngagementAPI = {
  getAll: (status) => api.get('/training-engagements', { params: status ? { status } : {} }),
  getById: (id) => api.get(`/training-engagements/${id}`),
  getTrainerDefaults: (trainerId) => api.get(`/training-engagements/defaults/trainer/${trainerId}`),
  create: (data) => api.post('/training-engagements', data),
  update: (id, data) => api.put(`/training-engagements/${id}`, data),
  delete: (id) => api.delete(`/training-engagements/${id}`)
};

export const trainerSettlementAPI = {
  getAll: (params = {}) => api.get('/trainer-settlements', { params }),
  create: (data) => api.post('/trainer-settlements', data),
  update: (id, data) => api.put(`/trainer-settlements/${id}`, data),
  delete: (id) => api.delete(`/trainer-settlements/${id}`)
};

export const invoiceAPI = {
  getAll: () => api.get('/invoices'),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`)
};

export const paymentDetailsAPI = {
  getAll: () => api.get('/payment-details'),
  upsert: (data) => api.post('/payment-details', data),
  delete: (id) => api.delete(`/payment-details/${id}`)
};

// SuperAdmin-only APIs
export const financialAPI = {
  getSummary: () => api.get('/financial/summary'),
  getPayouts: () => api.get('/financial/payouts'),
  getMargins: () => api.get('/financial/margins')
};

export const employeeAPI = {
  getAll: () => api.get('/employees'),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  updateConnection: (id, connectionId, isActive) => api.patch(`/employees/${id}/connection`, { connectionId, isActive }),
  promoteRole: (id, role) => api.patch(`/employees/${id}/role`, { role }),
  remove: (id) => api.delete(`/employees/${id}`)
};

export const userDataAPI = {
  getAll: (keys = []) => api.get('/user-data', { params: keys.length ? { keys: keys.join(',') } : {} }),
  upsert: (key, payload) => api.put(`/user-data/${encodeURIComponent(key)}`, { payload }),
  bulkUpsert: (items) => api.post('/user-data/bulk-upsert', { items }),
  remove: (key) => api.delete(`/user-data/${encodeURIComponent(key)}`)
};

export default api;
