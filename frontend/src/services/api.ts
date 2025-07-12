import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { ApiResponse } from '../types';

// 创建axios实例
const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理通用错误
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // 处理401错误 - token过期或无效
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // 处理网络错误
    if (!error.response) {
      console.error('网络错误:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// 通用API调用函数
export const apiCall = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  data?: any,
  params?: any
): Promise<ApiResponse<T>> => {
  try {
    const response = await api.request({
      method,
      url,
      data,
      params,
    });
    
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    
    // 如果服务器返回了错误响应
    if (axiosError.response?.data) {
      return axiosError.response.data as ApiResponse<T>;
    }
    
    // 网络或其他错误
    return {
      success: false,
      message: axiosError.message || '请求失败',
      code: axiosError.response?.status || 500,
    };
  }
};

// 文件上传函数
export const uploadFile = async (file: File, url: string): Promise<ApiResponse<any>> => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    return {
      success: false,
      message: axiosError.message || '文件上传失败',
      code: axiosError.response?.status || 500,
    };
  }
};

// 导出默认实例
export default api;