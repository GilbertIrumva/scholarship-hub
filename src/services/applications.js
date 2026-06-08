import axios from "axios";

const BASE_URL = "/api/auth/student/applications";

const buildAuthConfig = (sessionToken) => ({
  headers: { Authorization: `Bearer ${sessionToken}` },
});

export const listMyApplications = async (sessionToken) => {
  const { data } = await axios.get(BASE_URL, buildAuthConfig(sessionToken));
  return data;
};

export const submitApplication = async (sessionToken, { scholarshipId, motivation }) => {
  const { data } = await axios.post(
    BASE_URL,
    { scholarshipId, motivation },
    buildAuthConfig(sessionToken)
  );
  return data;
};

export default {
  listMyApplications,
  submitApplication,
};
