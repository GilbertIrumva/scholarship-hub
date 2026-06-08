import { useCallback, useMemo, useState } from "react";
import {
  deleteAdminScholar,
  getAdminApplicant,
  getAdminDashboard,
  getAdminSettings,
  listAdminApplicants,
  listAdminScholars,
  signInAdmin,
  signUpAdmin,
  updateAdminScholar,
  updateAdminSettings,
  verifyAdminChallenge,
} from "../services/adminAuth";
import { getScholarProfile, signInScholar, signUpScholar, updateScholarProfile } from "../services/scholarAuth";
import { AuthContext } from "./authContextValue";

const idleStatus = () => ({ type: "idle", message: "" });

export const AuthProvider = ({ children }) => {
  const [pendingChallenge, setPendingChallenge] = useState(null);
  const [adminDashboard, setAdminDashboard] = useState(null);
  const [scholarProfile, setScholarProfile] = useState(null);
  const [credentialSettings, setCredentialSettings] = useState(null);
  const [scholarsList, setScholarsList] = useState([]);
  const [scholarsStatus, setScholarsStatus] = useState(idleStatus());
  const [applicantsList, setApplicantsList] = useState([]);
  const [applicantsStatus, setApplicantsStatus] = useState(idleStatus());
  const [profileStatus, setProfileStatus] = useState(idleStatus());
  const [sessionToken, setSessionToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(idleStatus());
  const [settingsStatus, setSettingsStatus] = useState(idleStatus());

  const resetAll = useCallback(() => {
    setPendingChallenge(null);
    setAdminDashboard(null);
    setScholarProfile(null);
    setCredentialSettings(null);
    setScholarsList([]);
    setScholarsStatus(idleStatus());
    setApplicantsList([]);
    setApplicantsStatus(idleStatus());
    setProfileStatus(idleStatus());
    setSessionToken("");
    setVerificationStatus(idleStatus());
    setSettingsStatus(idleStatus());
  }, []);

  const signInAsScholar = useCallback(async ({ email, password }) => {
    try {
      setIsSubmitting(true);
      const session = await signInScholar({ email, password });
      const profile = await getScholarProfile(session.sessionToken);
      setSessionToken(session.sessionToken);
      setScholarProfile(profile);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error.response?.data?.message || "Unable to sign in as scholar.",
      };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const signUpAsScholar = useCallback(async ({ name, email, password }) => {
    try {
      setIsSubmitting(true);
      const result = await signUpScholar({ name, email, password });
      const profile = await getScholarProfile(result.sessionToken);
      setSessionToken(result.sessionToken);
      setScholarProfile(profile);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error.response?.data?.message || "Unable to create scholar account.",
      };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const startAdminSignIn = useCallback(async ({ email, password, verificationPrefill }) => {
    try {
      setIsSubmitting(true);
      const challenge = await signInAdmin({ email, password });
      setPendingChallenge({ ...challenge, prefillCode: verificationPrefill });
      setVerificationStatus({
        type: "idle",
        message: "Credentials accepted. Enter the department code or 2FA code to continue.",
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error.response?.data?.message || "Unable to sign in as administrator.",
      };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const signUpAsAdmin = useCallback(async (payload) => {
    try {
      setIsSubmitting(true);
      const result = await signUpAdmin(payload);
      return { ok: true, admin: result.admin, message: result.message };
    } catch (error) {
      return {
        ok: false,
        message: error.response?.data?.message || "Unable to create admin account.",
      };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // One-shot admin sign-in: chains the challenge + verification calls so the
  // user only sees a single screen. `accessCode` is the admin's department
  // code or 2FA code.
  const signInAdminDirect = useCallback(
    async ({ email, password, accessCode }) => {
      try {
        setIsSubmitting(true);
        const challenge = await signInAdmin({ email, password });
        const result = await verifyAdminChallenge({
          challengeId: challenge.challengeId,
          verificationCode: accessCode,
        });
        const dashboard = await getAdminDashboard(result.sessionToken);
        setSessionToken(result.sessionToken);
        setAdminDashboard(dashboard);
        setPendingChallenge(null);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message:
            error.response?.data?.message ||
            "Unable to sign in as administrator.",
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const verifyAdmin = useCallback(async (verificationCode) => {
    if (!pendingChallenge) {
      return { ok: false, message: "No active admin challenge." };
    }
    try {
      setIsSubmitting(true);
      const result = await verifyAdminChallenge({
        challengeId: pendingChallenge.challengeId,
        verificationCode,
      });
      const dashboard = await getAdminDashboard(result.sessionToken);
      setSessionToken(result.sessionToken);
      setAdminDashboard(dashboard);
      setVerificationStatus({ type: "success", message: result.message });
      return { ok: true };
    } catch (error) {
      const message = error.response?.data?.message || "Unable to verify department access.";
      setVerificationStatus({ type: "error", message });
      return { ok: false, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingChallenge]);

  const refreshAdminDashboard = useCallback(async () => {
    if (!sessionToken) return;
    try {
      setIsSubmitting(true);
      const next = await getAdminDashboard(sessionToken);
      setAdminDashboard(next);
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionToken]);

  const loadSettings = useCallback(async () => {
    if (!sessionToken) return { ok: false };
    try {
      setIsSubmitting(true);
      const next = await getAdminSettings(sessionToken);
      setCredentialSettings(next);
      setSettingsStatus({
        type: "idle",
        message: "Update either account here. Leave password fields blank to keep the current passwords.",
      });
      return { ok: true };
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load credential settings.";
      setSettingsStatus({ type: "error", message });
      return { ok: false, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionToken]);

  const saveSettings = useCallback(async (payload) => {
    if (!sessionToken) return null;
    try {
      setIsSubmitting(true);
      const updated = await updateAdminSettings(sessionToken, payload);
      setCredentialSettings(updated);
      setAdminDashboard((current) =>
        current
          ? { ...current, admin: { ...current.admin, ...updated.admin } }
          : current,
      );
      setSettingsStatus({ type: "success", message: updated.message });
      return updated;
    } catch (error) {
      const message = error.response?.data?.message || "Unable to save credential settings.";
      setSettingsStatus({ type: "error", message });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionToken]);

  const signOut = useCallback(() => {
    resetAll();
  }, [resetAll]);

  const loadScholars = useCallback(async () => {
    if (!sessionToken) return { ok: false };
    try {
      setIsSubmitting(true);
      const result = await listAdminScholars(sessionToken);
      setScholarsList(result.scholars || []);
      setScholarsStatus({ type: "idle", message: "" });
      return { ok: true };
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load scholar accounts.";
      setScholarsStatus({ type: "error", message });
      return { ok: false, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionToken]);

  const updateScholarCredentials = useCallback(async (scholarId, payload) => {
    if (!sessionToken) return { ok: false };
    try {
      setIsSubmitting(true);
      const result = await updateAdminScholar(sessionToken, scholarId, payload);
      setScholarsList((current) =>
        current.map((entry) => (entry.id === result.scholar.id ? result.scholar : entry)),
      );
      setScholarsStatus({ type: "success", message: result.message });
      return { ok: true, scholar: result.scholar };
    } catch (error) {
      const message = error.response?.data?.message || "Unable to update scholar.";
      setScholarsStatus({ type: "error", message });
      return { ok: false, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionToken]);

  const removeScholar = useCallback(async (scholarId) => {
    if (!sessionToken) return { ok: false };
    try {
      setIsSubmitting(true);
      await deleteAdminScholar(sessionToken, scholarId);
      setScholarsList((current) => current.filter((entry) => entry.id !== scholarId));
      setScholarsStatus({ type: "success", message: "Scholar account removed." });
      return { ok: true };
    } catch (error) {
      const message = error.response?.data?.message || "Unable to remove scholar.";
      setScholarsStatus({ type: "error", message });
      return { ok: false, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionToken]);

  const loadApplicants = useCallback(async () => {
    if (!sessionToken) return { ok: false };
    try {
      setIsSubmitting(true);
      const result = await listAdminApplicants(sessionToken);
      setApplicantsList(result.applicants || []);
      setApplicantsStatus({ type: "idle", message: "" });
      return { ok: true };
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load applicants.";
      setApplicantsStatus({ type: "error", message });
      return { ok: false, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionToken]);

  const fetchApplicant = useCallback(async (applicantId) => {
    if (!sessionToken) return { ok: false };
    try {
      const result = await getAdminApplicant(sessionToken, applicantId);
      return { ok: true, applicant: result.applicant };
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load applicant.";
      return { ok: false, message };
    }
  }, [sessionToken]);

  const updateScholarProfileDetails = useCallback(async (payload) => {
    if (!sessionToken) return { ok: false };
    try {
      setIsSubmitting(true);
      const result = await updateScholarProfile(sessionToken, payload);
      setScholarProfile(result);
      setProfileStatus({ type: "success", message: "Profile updated." });
      return { ok: true };
    } catch (error) {
      const message = error.response?.data?.message || "Unable to update profile.";
      setProfileStatus({ type: "error", message });
      return { ok: false, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionToken]);

  const value = useMemo(
    () => ({
      sessionToken,
      isSubmitting,
      pendingChallenge,
      adminDashboard,
      scholarProfile,
      credentialSettings,
      scholarsList,
      scholarsStatus,
      applicantsList,
      applicantsStatus,
      profileStatus,
      verificationStatus,
      settingsStatus,
      signInAsScholar,
      signUpAsScholar,
      startAdminSignIn,
      signInAdminDirect,
      signUpAsAdmin,
      verifyAdmin,
      refreshAdminDashboard,
      loadSettings,
      saveSettings,
      loadScholars,
      updateScholarCredentials,
      removeScholar,
      loadApplicants,
      fetchApplicant,
      updateScholarProfileDetails,
      signOut,
    }),
    [
      sessionToken,
      isSubmitting,
      pendingChallenge,
      adminDashboard,
      scholarProfile,
      credentialSettings,
      scholarsList,
      scholarsStatus,
      applicantsList,
      applicantsStatus,
      profileStatus,
      verificationStatus,
      settingsStatus,
      signInAsScholar,
      signUpAsScholar,
      startAdminSignIn,
      signInAdminDirect,
      signUpAsAdmin,
      verifyAdmin,
      refreshAdminDashboard,
      loadSettings,
      saveSettings,
      loadScholars,
      updateScholarCredentials,
      removeScholar,
      loadApplicants,
      fetchApplicant,
      updateScholarProfileDetails,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
