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

export default {
  getAllScholarships,
  getScholarshipById,
  createScholarship,
};
