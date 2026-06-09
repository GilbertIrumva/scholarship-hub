import axios from "axios";

const BASE = "/api/auth/student";

export const requestEmailVerification = async (email) => {
  const { data } = await axios.post(`${BASE}/resend-verification`, { email });
  return data;
};

export const verifyEmail = async (token) => {
  const { data } = await axios.post(`${BASE}/verify-email`, { token });
  return data;
};

export const requestPasswordReset = async (email) => {
  const { data } = await axios.post(`${BASE}/forgot-password`, { email });
  return data;
};

export const resetPassword = async ({ token, password }) => {
  const { data } = await axios.post(`${BASE}/reset-password`, { token, password });
  return data;
};

export default {
  requestEmailVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
};
