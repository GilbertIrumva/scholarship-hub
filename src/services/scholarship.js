import axios from "axios";

const BASE_URL = "/api/scholarships";

export const getAllScholarships = async () => {
  const response = await axios.get(BASE_URL);
  return response.data;
};

export const getScholarshipById = async (id) => {
  const response = await axios.get(`${BASE_URL}/${id}`);
  return response.data;
};

export const createScholarship = async (newEntry) => {
  const response = await axios.post(BASE_URL, newEntry);
  return response.data;
};

// Personalised recommendations for the signed-in scholar. Returns
// { items: [{ scholarship, score, matchPercent, reasons }], personalised }.
export const fetchRecommendations = async (sessionToken, { limit = 6 } = {}) => {
  const response = await axios.get("/api/auth/student/recommendations", {
    headers: { Authorization: `Bearer ${sessionToken}` },
    params: { limit },
  });
  return response.data;
};

export default {
  getAllScholarships,
  getScholarshipById,
  createScholarship,
  fetchRecommendations,
};
