import axios from "axios";

const OAUTH_BASE_URL = "/api/auth";

// We can't use axios for the navigation — the browser must perform a full
// top-level redirect so Google can return to our callback URL with cookies.
// This helper just builds the URL so callers can `window.location.assign(url)`.
export const buildGoogleStartUrl = (returnTo) => {
  const url = new URL(`${OAUTH_BASE_URL}/google/start`, window.location.origin);
  if (returnTo && typeof returnTo === "string") {
    url.searchParams.set("returnTo", returnTo);
  }
  return url.toString();
};

// Used by the SPA callback page to upgrade the bearer token returned in the
// URL into a full session (fetch profile, hydrate AuthContext).
export const fetchScholarProfileWithToken = async (sessionToken) => {
  const response = await axios.get(`${OAUTH_BASE_URL}/student/profile`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  return response.data;
};

export default {
  buildGoogleStartUrl,
  fetchScholarProfileWithToken,
};
