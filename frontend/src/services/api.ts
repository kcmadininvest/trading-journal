import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

// Configuration recommandée pour la production :
// const DEFAULT_API_BASE_URL = process.env.NODE_ENV === 'development'
//   ? '/api'
//   : (typeof window !== 'undefined'
//       ? `${window.location.protocol}//${window.location.host}/api`
//       : '/api');
// 
// const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || DEFAULT_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 secondes de timeout
});

// Request interceptor pour ajouter le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor pour gérer les erreurs et rafraîchir le token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Ne pas essayer de rafraîchir le token pour les requêtes de déconnexion
    const isLogoutRequest = originalRequest.url?.includes('/accounts/auth/logout/');
    
    if (error.response?.status === 401 && !originalRequest._retry && !isLogoutRequest) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/accounts/auth/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } else {
          // Pas de token, on continue sans authentification
          delete originalRequest.headers.Authorization;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // Ne pas rediriger vers login si l'API ne nécessite pas d'auth
        console.warn('Auth refresh failed, continuing without authentication');
        delete originalRequest.headers.Authorization;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default api;