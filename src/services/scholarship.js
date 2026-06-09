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

// Saved / watchlist scholarships. The backend stores ObjectIds on the Scholar
// document; the list endpoint returns populated scholarship objects.

export const listSavedScholarships = async (sessionToken) => {
  const response = await axios.get("/api/auth/student/saved", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  return response.data; // { items, ids }
};

export const saveScholarship = async (sessionToken, scholarshipId) => {
  const response = await axios.post(
    `/api/auth/student/saved/${scholarshipId}`,
    null,
    { headers: { Authorization: `Bearer ${sessionToken}` } }
  );
  return response.data; // { saved: true, ids }
};

export const unsaveScholarship = async (sessionToken, scholarshipId) => {
  const response = await axios.delete(
    `/api/auth/student/saved/${scholarshipId}`,
    { headers: { Authorization: `Bearer ${sessionToken}` } }
  );
  return response.data; // { saved: false, ids }
};

export const toggleSavedScholarship = async (
  sessionToken,
  scholarshipId,
  currentlySaved
) =>
  currentlySaved
    ? unsaveScholarship(sessionToken, scholarshipId)
    : saveScholarship(sessionToken, scholarshipId);

export default {
  getAllScholarships,
  getScholarshipById,
  createScholarship,
  fetchRecommendations,
  listSavedScholarships,
  saveScholarship,
  unsaveScholarship,
  toggleSavedScholarship,
};
