import axios from "axios";

const BASE_URL = "/api/auth/student/travel-docs";

const buildAuthConfig = (sessionToken, extra = {}) => ({
  ...extra,
  headers: {
    Authorization: `Bearer ${sessionToken}`,
    ...(extra.headers || {}),
  },
});

export const TRAVEL_DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "visa", label: "Visa" },
  { value: "travel-insurance", label: "Travel insurance" },
  { value: "vaccination", label: "Vaccination certificate" },
  { value: "other-travel", label: "Other travel document" },
];

export const listTravelDocs = async (sessionToken) => {
  const { data } = await axios.get(BASE_URL, buildAuthConfig(sessionToken));
  return data;
};

export const uploadTravelDoc = async (sessionToken, payload) => {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("type", payload.type);
  form.append("title", payload.title);
  if (payload.country) form.append("country", payload.country);
  if (payload.documentNumber) form.append("documentNumber", payload.documentNumber);
  if (payload.issuedDate) form.append("issuedDate", payload.issuedDate);
  if (payload.expiryDate) form.append("expiryDate", payload.expiryDate);

  const { data } = await axios.post(
    BASE_URL,
    form,
    buildAuthConfig(sessionToken, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  );
  return data;
};

export const deleteTravelDoc = async (sessionToken, id) => {
  const { data } = await axios.delete(
    `${BASE_URL}/${id}`,
    buildAuthConfig(sessionToken)
  );
  return data;
};

export const travelDocDownloadUrl = (id) => `${BASE_URL}/${id}/download`;

// ----- Admin side ----------------------------------------------------------
const ADMIN_BASE = "/api/auth/admin/travel-docs";

export const listAdminTravelDocs = async (sessionToken, params = {}) => {
  const { data } = await axios.get(ADMIN_BASE, {
    ...buildAuthConfig(sessionToken),
    params,
  });
  return data;
};

export const checkTravelDocEligibility = async (sessionToken, scholarId) => {
  const { data } = await axios.get(
    `${ADMIN_BASE}/eligibility/${scholarId}`,
    buildAuthConfig(sessionToken)
  );
  return data;
};

export const reviewAdminTravelDoc = async (sessionToken, id, payload) => {
  const { data } = await axios.patch(
    `${ADMIN_BASE}/${id}`,
    payload,
    buildAuthConfig(sessionToken)
  );
  return data;
};

export const adminTravelDocDownloadUrl = (id) => `${ADMIN_BASE}/${id}/download`;

export default {
  TRAVEL_DOC_TYPES,
  listTravelDocs,
  uploadTravelDoc,
  deleteTravelDoc,
  travelDocDownloadUrl,
  listAdminTravelDocs,
  checkTravelDocEligibility,
  reviewAdminTravelDoc,
  adminTravelDocDownloadUrl,
};
