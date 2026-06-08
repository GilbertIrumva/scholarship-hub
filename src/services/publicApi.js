import axios from "axios";

const BASE = "/api/public";

export const getPublicStats = async () => {
  const { data } = await axios.get(`${BASE}/stats`);
  return data;
};

export const getPublicFilters = async () => {
  const { data } = await axios.get(`${BASE}/filters`);
  return data;
};

export const searchPublicScholarships = async (params = {}) => {
  const { data } = await axios.get(`${BASE}/scholarships`, { params });
  return data;
};

export const getPublicScholarshipById = async (id) => {
  const { data } = await axios.get(`${BASE}/scholarships/${id}`);
  return data;
};

export default {
  getPublicStats,
  getPublicFilters,
  searchPublicScholarships,
  getPublicScholarshipById,
};
