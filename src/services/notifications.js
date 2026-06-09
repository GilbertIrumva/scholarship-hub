import axios from "axios";

// Returns { items, unread }.
export const listScholarNotifications = async (token, { limit = 20, unreadOnly = false } = {}) => {
  const res = await axios.get("/api/auth/student/notifications", {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit, unreadOnly },
  });
  return res.data;
};

export const markScholarNotificationRead = async (token, id) => {
  const res = await axios.post(
    `/api/auth/student/notifications/${id}/read`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const markAllScholarNotificationsRead = async (token) => {
  const res = await axios.post(
    "/api/auth/student/notifications/read-all",
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const listAdminNotifications = async (token, { limit = 20, unreadOnly = false } = {}) => {
  const res = await axios.get("/api/auth/admin/notifications", {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit, unreadOnly },
  });
  return res.data;
};

export const markAdminNotificationRead = async (token, id) => {
  const res = await axios.post(
    `/api/auth/admin/notifications/${id}/read`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const markAllAdminNotificationsRead = async (token) => {
  const res = await axios.post(
    "/api/auth/admin/notifications/read-all",
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};
