import axios from "axios";

const BASE_URL = "/api/auth/student/credentials";

const buildAuthConfig = (sessionToken, extra = {}) => ({
  ...extra,
  headers: {
    Authorization: `Bearer ${sessionToken}`,
    ...(extra.headers || {}),
  },
});

export const CREDENTIAL_TYPES = [
  { value: "secondary-certificate", label: "Secondary school certificate" },
  { value: "transcript", label: "Academic transcript" },
  { value: "national-id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "language-test", label: "Language test (TOEFL / IELTS / DELF)" },
  { value: "recommendation-letter", label: "Recommendation letter" },
  { value: "cv", label: "Curriculum vitae" },
  { value: "other", label: "Other supporting document" },
];

export const listMyCredentials = async (sessionToken) => {
  const { data } = await axios.get(BASE_URL, buildAuthConfig(sessionToken));
  return data;
};

/**
 * Upload a credential. `payload` is a plain object; we build the FormData here.
 * - file:           File object (required)
 * - type, title, country, issuingBody, issuedYear (optional except type/title)
 * - gradeConversion: optional plain object snapshot (serialized as JSON)
 */
export const uploadCredential = async (sessionToken, payload) => {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("type", payload.type);
  form.append("title", payload.title);
  if (payload.country) form.append("country", payload.country);
  if (payload.issuingBody) form.append("issuingBody", payload.issuingBody);
  if (payload.issuedYear) form.append("issuedYear", String(payload.issuedYear));
  if (payload.gradeConversion) {
    form.append("gradeConversion", JSON.stringify(payload.gradeConversion));
  }

  const { data } = await axios.post(
    BASE_URL,
    form,
    buildAuthConfig(sessionToken, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  );
  return data;
};

export const deleteCredential = async (sessionToken, id) => {
  const { data } = await axios.delete(
    `${BASE_URL}/${id}`,
    buildAuthConfig(sessionToken)
  );
  return data;
};

export const downloadCredentialUrl = (id) =>
  `${BASE_URL}/${id}/download`;

export default {
  CREDENTIAL_TYPES,
  listMyCredentials,
  uploadCredential,
  deleteCredential,
  downloadCredentialUrl,
};
