import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const Ctx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(localStorage.getItem('msai_token') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.defaults.baseURL = API;
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchMe();
    } else { setLoading(false); }
  }, []);

  const fetchMe = async () => {
    try {
      const { data } = await axios.get('/auth/me');
      setUser(data);
    } catch { logout(); }
    finally { setLoading(false); }
  };

  const login = async (email, password) => {
    const { data } = await axios.post('/auth/login', { email, password });
    localStorage.setItem('msai_token', data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setToken(data.token); setUser(data.user);
    return data;
  };

  const register = async (form) => {
    const { data } = await axios.post('/auth/register', form);
    if (data.token && data.user?.role !== 'doctor') {
      localStorage.setItem('msai_token', data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      setToken(data.token); setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('msai_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(''); setUser(null);
  };

  const updateUser = (u) => setUser(p => ({ ...p, ...u }));

  return (
    <Ctx.Provider value={{ user, token, loading, login, register, logout, updateUser, fetchMe }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
