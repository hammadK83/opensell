import axios from 'axios';

const DEFAULT_BASE = 'http://192.168.1.136:5000';

const axiosInstance = axios.create({
  baseURL: DEFAULT_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export default axiosInstance;
