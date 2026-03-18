import axios from "axios";
const BASE = "http://localhost:8000";
export const api  = (token) => axios.create({ baseURL: BASE, headers: token ? { Authorization: `Bearer ${token}` } : {} });
export const authApi = axios.create({ baseURL: BASE });