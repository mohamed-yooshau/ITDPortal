import axios from "axios";
import { decryptPayload, ensureHandshake, getHandshakeId, resetHandshake } from "./lib/cryptoPayload";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true
});

api.interceptors.request.use(async (config) => {
  await ensureHandshake(true);
  const handshake = getHandshakeId();
  if (handshake) {
    config.headers = config.headers || {};
    config.headers["x-itd-handshake"] = handshake;
  }
  return config;
});

api.interceptors.response.use(
  async (response) => {
    if (response.data?.enc) {
      const decrypted = await decryptPayload(response.data.enc, "");
      response.data = (decrypted as any).data ?? decrypted;
    }
    if (response.data?.encSettings) {
      const decrypted = await decryptPayload(response.data.encSettings, "settings");
      response.data = decrypted;
    }
    return response;
  },
  async (error) => {
    if (error?.response?.data?.enc) {
      try {
        const decrypted = await decryptPayload(error.response.data.enc, "");
        error.response.data = (decrypted as any).data ?? decrypted;
      } catch {
        // ignore decrypt error
      }
    }
    if (error?.response?.data?.encSettings) {
      try {
        const decrypted = await decryptPayload(error.response.data.encSettings, "settings");
        error.response.data = decrypted;
      } catch {
        // ignore decrypt error
      }
    }
    if (error?.response?.status === 426 && !error.config?._retry) {
      error.config._retry = true;
      resetHandshake();
      await ensureHandshake(true);
      const handshake = getHandshakeId();
      if (handshake) {
        error.config.headers = error.config.headers || {};
        error.config.headers["x-itd-handshake"] = handshake;
      }
      return api.request(error.config);
    }
    return Promise.reject(error);
  }
);

export default api;
