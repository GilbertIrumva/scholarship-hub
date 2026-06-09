import axios from "axios";

const BASE_URL = "/api/auth/student/visa-workflows";

const buildAuthConfig = (sessionToken) => ({
  headers: { Authorization: `Bearer ${sessionToken}` },
});

export const VISA_TYPES = [
  { value: "student", label: "Student visa" },
  { value: "exchange", label: "Exchange visa" },
  { value: "research", label: "Research visa" },
  { value: "training", label: "Training visa" },
  { value: "other", label: "Other" },
];

export const WORKFLOW_STATUSES = [
  { value: "not-started", label: "Not started" },
  { value: "in-progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
  { value: "on-hold", label: "On hold" },
];

export const MILESTONE_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
  { value: "skipped", label: "Skipped" },
];

export const listVisaWorkflows = async (sessionToken) => {
  const { data } = await axios.get(BASE_URL, buildAuthConfig(sessionToken));
  return data;
};

export const createVisaWorkflow = async (sessionToken, payload) => {
  const { data } = await axios.post(BASE_URL, payload, buildAuthConfig(sessionToken));
  return data;
};

export const getVisaWorkflow = async (sessionToken, id) => {
  const { data } = await axios.get(`${BASE_URL}/${id}`, buildAuthConfig(sessionToken));
  return data;
};

export const updateVisaWorkflow = async (sessionToken, id, payload) => {
  const { data } = await axios.patch(`${BASE_URL}/${id}`, payload, buildAuthConfig(sessionToken));
  return data;
};

export const updateMilestone = async (sessionToken, id, key, payload) => {
  const { data } = await axios.patch(
    `${BASE_URL}/${id}/milestones/${key}`,
    payload,
    buildAuthConfig(sessionToken)
  );
  return data;
};

export const addVisaNote = async (sessionToken, id, body) => {
  const { data } = await axios.post(
    `${BASE_URL}/${id}/notes`,
    { body },
    buildAuthConfig(sessionToken)
  );
  return data;
};

// ----- Admin -------------------------------------------------------------
const ADMIN_BASE = "/api/auth/admin/visa-workflows";

export const listAdminVisaWorkflows = async (sessionToken, params = {}) => {
  const { data } = await axios.get(ADMIN_BASE, {
    ...buildAuthConfig(sessionToken),
    params,
  });
  return data;
};

export const addAdminVisaNote = async (sessionToken, id, body) => {
  const { data } = await axios.post(
    `${ADMIN_BASE}/${id}/notes`,
    { body },
    buildAuthConfig(sessionToken)
  );
  return data;
};

export default {
  VISA_TYPES,
  WORKFLOW_STATUSES,
  MILESTONE_STATUSES,
  listVisaWorkflows,
  createVisaWorkflow,
  getVisaWorkflow,
  updateVisaWorkflow,
  updateMilestone,
  addVisaNote,
  listAdminVisaWorkflows,
  addAdminVisaNote,
};
