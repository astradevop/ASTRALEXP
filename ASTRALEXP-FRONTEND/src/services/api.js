import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your machine's local IP when testing on a physical device
// For emulator use 10.0.2.2 (Android) or localhost (iOS sim)
export const BASE_URL = 'http://3.111.206.12/api';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// ─── Request interceptor — attach JWT ────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response interceptor — auto-refresh on 401 ──────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = await AsyncStorage.getItem('refresh_token');
        if (!refresh) throw new Error('No refresh token');
        const res = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
        const { access } = res.data;
        await AsyncStorage.setItem('access_token', access);
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
        // Navigation reset handled by AuthContext listener
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (data) => api.post('/auth/login/', data),
  register:       (data) => api.post('/auth/register/', data),
  logout:         (data) => api.post('/auth/logout/', data),
  refreshToken:   (data) => api.post('/auth/token/refresh/', data),
  getProfile:     ()     => api.get('/auth/profile/'),
  updateProfile:  (data) => api.patch('/auth/profile/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  changePassword: (data) => api.post('/auth/change-password/', data),
  deleteAccount:  ()     => api.delete('/auth/profile/'),
  createSubIntent:()     => api.post('/auth/subscription/create-intent/'),
  verifySub:      ()     => api.post('/auth/subscription/verify/'),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chatAPI = {
  parse: (data) => api.post('/chat/parse/', data),
};

// ─── Expenses ─────────────────────────────────────────────────────────────────
export const expensesAPI = {
  list:   (params) => api.get('/expenses/', { params }),
  create: (data)   => api.post('/expenses/', data),
  update: (id, d)  => api.patch(`/expenses/${id}/`, d),
  delete: (id)     => api.delete(`/expenses/${id}/`),
  creditsGiven: () => api.get('/expenses/credits-given/'),
  creditsOwed:  () => api.get('/expenses/credits-owed/'),
  markPaid:     (id, data) => api.patch(`/expenses/splits/${id}/mark-paid/`, data),
  clearAll:     () => api.delete('/expenses/clear-all/'),
};

// ─── Payment Methods ──────────────────────────────────────────────────────────
export const paymentsAPI = {
  list:   ()       => api.get('/payment-methods/'),
  create: (data)   => api.post('/payment-methods/', data),
  update: (id, d)  => api.patch(`/payment-methods/${id}/`, d),
  delete: (id)     => api.delete(`/payment-methods/${id}/`),
  clearAll: ()     => api.delete('/payment-methods/clear-all/'),
};

// ─── Friends ──────────────────────────────────────────────────────────────────
export const friendsAPI = {
  search:   (q)      => api.get('/friends/search/', { params: { q } }),
  list:     ()       => api.get('/friends/list_friends/'),
  pending:  ()       => api.get('/friends/pending_requests/'),
  request:  (toId)   => api.post('/friends/', { to_user: toId }),
  respond:  (id, s)  => api.post(`/friends/${id}/respond/`, { status: s }),
};

export default api;
