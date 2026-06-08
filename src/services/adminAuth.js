import axios from "axios";

const ADMIN_AUTH_BASE_URL = "/api/auth/admin";

const buildAuthConfig = (sessionToken) => ({
  headers: {
    Authorization: `Bearer ${sessionToken}`,
  },
});

export const signInAdmin = async (payload) => {
  const response = await axios.post(`${ADMIN_AUTH_BASE_URL}/sign-in`, payload);
  return response.data;
};

export const signUpAdmin = async (payload) => {
  const response = await axios.post(`${ADMIN_AUTH_BASE_URL}/sign-up`, payload);
  return response.data;
};

export const verifyAdminChallenge = async (payload) => {
  const response = await axios.post(`${ADMIN_AUTH_BASE_URL}/verify`, payload);
  return response.data;
};

export const getAdminDashboard = async (sessionToken) => {
  const response = await axios.get(`${ADMIN_AUTH_BASE_URL}/dashboard`, buildAuthConfig(sessionToken));

  return response.data;
};

export const getAdminSettings = async (sessionToken) => {
  const response = await axios.get(`${ADMIN_AUTH_BASE_URL}/settings`, buildAuthConfig(sessionToken));

  return response.data;
};

export const updateAdminSettings = async (sessionToken, payload) => {
  const response = await axios.put(`${ADMIN_AUTH_BASE_URL}/settings`, payload, buildAuthConfig(sessionToken));

  return response.data;
};

export const listAdminScholars = async (sessionToken) => {
  const response = await axios.get(`${ADMIN_AUTH_BASE_URL}/scholars`, buildAuthConfig(sessionToken));
  return response.data;
};

export const updateAdminScholar = async (sessionToken, scholarId, payload) => {
  const response = await axios.put(
    `${ADMIN_AUTH_BASE_URL}/scholars/${scholarId}`,
    payload,
    buildAuthConfig(sessionToken),
  );
  return response.data;
};

export const deleteAdminScholar = async (sessionToken, scholarId) => {
  const response = await axios.delete(
    `${ADMIN_AUTH_BASE_URL}/scholars/${scholarId}`,
    buildAuthConfig(sessionToken),
  );
  return response.data;
};

export const listAdminApplicants = async (sessionToken) => {
  const response = await axios.get(`${ADMIN_AUTH_BASE_URL}/applicants`, buildAuthConfig(sessionToken));
  return response.data;
};

export const getAdminApplicant = async (sessionToken, applicantId) => {
  const response = await axios.get(
    `${ADMIN_AUTH_BASE_URL}/applicants/${applicantId}`,
    buildAuthConfig(sessionToken),
  );
  return response.data;
};
 
export const listAdminMessages = async (sessionToken, params = {}) => {
  const response = await axios.get(`${ADMIN_AUTH_BASE_URL}/messages`, {
    ...buildAuthConfig(sessionToken),
    params,
  });
  return response.data;
};

export const updateAdminMessage = async (sessionToken, messageId, payload) => {
  const response = await axios.patch(
    `${ADMIN_AUTH_BASE_URL}/messages/${messageId}`,
    payload,
    buildAuthConfig(sessionToken),
  );
  return response.data;
};

export const deleteAdminMessage = async (sessionToken, messageId) => {
  const response = await axios.delete(
    `${ADMIN_AUTH_BASE_URL}/messages/${messageId}`,
    buildAuthConfig(sessionToken),
  );
  return response.data;
};

export const replyToAdminMessage = async (sessionToken, messageId, body) => {
  const response = await axios.post(
    `${ADMIN_AUTH_BASE_URL}/messages/${messageId}/reply`,
    { body },
    buildAuthConfig(sessionToken),
  );
  return response.data;
};

export default {
  signInAdmin,
  signUpAdmin,
  verifyAdminChallenge,
  getAdminDashboard,
  getAdminSettings,
  updateAdminSettings,
  listAdminScholars,
  updateAdminScholar,
  deleteAdminScholar,
  listAdminApplicants,
  getAdminApplicant,
  listAdminMessages,
  updateAdminMessage,
  deleteAdminMessage,
  replyToAdminMessage,
};