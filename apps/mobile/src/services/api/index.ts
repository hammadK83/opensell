import { axiosInstance } from './api.client';
import { requestInterceptor } from './interceptors/request.interceptor';
import { responseInterceptor } from './interceptors/response.interceptor';

axiosInstance.interceptors.request.use(requestInterceptor);

axiosInstance.interceptors.response.use((res) => res, responseInterceptor);

export { axiosInstance };
