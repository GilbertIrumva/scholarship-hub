import axios from "axios";

const BASE = "/api/auth/admin/audit-log";

const buildAuthConfig = (sessionToken) => ({
  headers: { Authorization: `Bearer ${sessionToken}` },
});

export const fetchAuditLog = async (sessionToken, params = {}) => {
  const config = { ...buildAuthConfig(sessionToken), params };
  const { data } = await axios.get(BASE, config);
  return data;
};

export default { fetchAuditLog };
