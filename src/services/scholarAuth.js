import axios from "axios";

const SCHOLAR_AUTH_BASE_URL = "/api/auth/student";

const buildAuthConfig = (sessionToken) => ({
  headers: {
    Authorization: `Bearer ${sessionToken}`,
  },
});

export const signInScholar = async (payload) => {
  const response = await axios.post(`${SCHOLAR_AUTH_BASE_URL}/sign-in`, payload);
  return response.data;
};

export const signUpScholar = async (payload) => {
  const response = await axios.post(`${SCHOLAR_AUTH_BASE_URL}/sign-up`, payload);
  return response.data;
};

export const getScholarProfile = async (sessionToken) => {
  const response = await axios.get(`${SCHOLAR_AUTH_BASE_URL}/profile`, buildAuthConfig(sessionToken));
  return response.data;
};

export const updateScholarProfile = async (sessionToken, payload) => {
  const response = await axios.put(`${SCHOLAR_AUTH_BASE_URL}/profile`, payload, buildAuthConfig(sessionToken));
  return response.data;
};

export default {
  signInScholar,
  signUpScholar,
  getScholarProfile,
  updateScholarProfile,
};