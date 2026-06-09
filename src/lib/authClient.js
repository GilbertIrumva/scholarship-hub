// Axios refresh-token plumbing for sliding sessions.
//
// The backend issues an httpOnly `sz_rt` cookie scoped to `/api/auth` that
// carries an opaque refresh token. Access tokens (15 min) ride in the
// `Authorization: Bearer ...` header. When the server replies 401 to a
// bearer-authenticated request, we transparently call /api/auth/refresh,
// pick up the new access token, and replay the original request once.
import axios from "axios";

// All axios calls must send cookies so /refresh and /logout can read sz_rt.
axios.defaults.withCredentials = true;

let refreshInFlight = null;
let getToken = () => null;
let setToken = () => {};
let onRefreshed = () => {};
let onLogout = () => {};

const refreshOnce = () => {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post("/api/auth/refresh")
      .finally(() => {
        // Release the lock on the next tick so any awaiters resolve first.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      });
  }
  return refreshInFlight;
};

let interceptorId = null;

export const installAxiosAuthInterceptor = (opts = {}) => {
  if (opts.getToken) getToken = opts.getToken;
  if (opts.setToken) setToken = opts.setToken;
  if (opts.onRefreshed) onRefreshed = opts.onRefreshed;
  if (opts.onLogout) onLogout = opts.onLogout;

  if (interceptorId !== null) return;

  interceptorId = axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      const status = error.response?.status;

      // Only attempt refresh for 401s on a bearer-authenticated request that
      // we have not already retried, and never on the refresh call itself.
      const isRefreshCall = typeof original?.url === "string" && original.url.includes("/api/auth/refresh");
      const isLogoutCall = typeof original?.url === "string" && original.url.includes("/api/auth/logout");
      const hadAuthHeader = Boolean(original?.headers?.Authorization || original?.headers?.authorization);

      if (status !== 401 || !original || original._retried || isRefreshCall || isLogoutCall || !hadAuthHeader) {
        throw error;
      }

      original._retried = true;
      try {
        const { data } = await refreshOnce();
        const nextToken = data?.sessionToken;
        if (!nextToken) throw error;

        setToken(nextToken);
        onRefreshed(nextToken, data);

        original.headers = { ...original.headers, Authorization: `Bearer ${nextToken}` };
        return axios(original);
      } catch (refreshError) {
        onLogout(refreshError);
        throw error;
      }
    },
  );
};

// Called once on app mount to restore a session that lives only in the
// httpOnly cookie (after a hard reload). Returns the refresh payload on
// success or null when the cookie is missing/expired.
export const bootstrapSession = async () => {
  try {
    const { data } = await axios.post("/api/auth/refresh");
    return data;
  } catch {
    return null;
  }
};

// Best-effort server-side logout. Always resolves so UI flow is unblocked.
export const logoutServer = async () => {
  try {
    await axios.post("/api/auth/logout");
  } catch {
    /* ignore — the local session is already being cleared */
  }
};
