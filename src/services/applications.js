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

// ---------------------------------------------------------------------------
// Multi-step wizard helpers (T2.3)
// ---------------------------------------------------------------------------

export const getApplicationDraft = async (sessionToken, scholarshipId) => {
  const { data } = await axios.get(
    `${BASE_URL}/draft/${scholarshipId}`,
    buildAuthConfig(sessionToken)
  );
  return data;
};

export const saveApplicationDraft = async (sessionToken, scholarshipId, payload) => {
  const { data } = await axios.put(
    `${BASE_URL}/draft/${scholarshipId}`,
    payload,
    buildAuthConfig(sessionToken)
  );
  return data;
};

export const discardApplicationDraft = async (sessionToken, scholarshipId) => {
  const { data } = await axios.delete(
    `${BASE_URL}/draft/${scholarshipId}`,
    buildAuthConfig(sessionToken)
  );
  return data;
};

export const submitApplicationWizard = async (sessionToken, scholarshipId, payload) => {
  const { data } = await axios.post(
    `${BASE_URL}/submit/${scholarshipId}`,
    payload,
    buildAuthConfig(sessionToken)
  );
  return data;
};

export default {
  listMyApplications,
  submitApplication,
  getApplicationDraft,
  saveApplicationDraft,
  discardApplicationDraft,
  submitApplicationWizard,
};
