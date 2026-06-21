import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function requestOtp(email) {
  const response = await api.post("/auth/request-otp", { email });
  return response.data;
}

export async function verifyOtp(email, otp) {
  const response = await api.post("/auth/verify-otp", { email, otp });
  return response.data;
}

export default api;
