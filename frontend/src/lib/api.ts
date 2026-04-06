import axios from "axios";

const isBrowser = typeof window !== "undefined";
const defaultBaseUrl = isBrowser ? "/" : "http://localhost:4000";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? defaultBaseUrl
});
