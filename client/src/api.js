import axios from "axios"

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:4000",
  timeout: 40000,
})

// Admin token lives in sessionStorage (cleared when the tab closes). Storage can be
// unavailable (private mode, blocked cookies), so every access is guarded.
const KEY = "fleet_admin_token"
export const getToken = () => { try { return sessionStorage.getItem(KEY) } catch { return null } }
export const setToken = t => { try { sessionStorage.setItem(KEY, t) } catch { /* ignore */ } }
export const clearToken = () => { try { sessionStorage.removeItem(KEY) } catch { /* ignore */ } }

export function errorMessage(e, fallback = "Something went wrong") {
  return e?.response?.data?.error || (e?.request ? "Cannot reach the API server. Is it running?" : e?.message) || fallback
}

export default api
