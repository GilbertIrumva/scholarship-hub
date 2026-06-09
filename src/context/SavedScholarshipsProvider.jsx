import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { SavedScholarshipsContext } from "./savedScholarshipsContextValue";
import { useAuth } from "./useAuth";
import {
  listSavedScholarships,
  saveScholarship,
  unsaveScholarship,
} from "../services/scholarship";

/**
 * Provides the set of saved scholarship IDs for the signed-in scholar, plus
 * a toggle helper that performs optimistic UI updates and reconciles with
 * the server on failure.
 *
 * Loads lazily: only fetches the saved list once the scholar is signed in
 * (sessionToken + scholarProfile present). Safe to render for admin/public
 * routes — it just becomes a no-op until a scholar logs in.
 */
const SavedScholarshipsProvider = ({ children }) => {
  const { sessionToken, scholarProfile } = useAuth();
  const [ids, setIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const loadedForTokenRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!sessionToken || !scholarProfile) {
      setIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const data = await listSavedScholarships(sessionToken);
      const nextIds = new Set((data?.ids || []).map(String));
      setIds(nextIds);
      loadedForTokenRef.current = sessionToken;
    } catch {
      // Soft-fail: leave whatever we had and don't toast (would be noisy).
    } finally {
      setLoading(false);
    }
  }, [sessionToken, scholarProfile]);

  // Auto-fetch on sign-in; clear on sign-out.
  useEffect(() => {
    if (!sessionToken || !scholarProfile) {
      setIds(new Set());
      loadedForTokenRef.current = null;
      return;
    }
    if (loadedForTokenRef.current !== sessionToken) {
      refresh();
    }
  }, [sessionToken, scholarProfile, refresh]);

  const isSaved = useCallback(
    (scholarshipId) => ids.has(String(scholarshipId)),
    [ids]
  );

  const toggle = useCallback(
    async (scholarshipId, scholarshipTitle) => {
      if (!sessionToken || !scholarProfile) {
        toast.error("Sign in to save scholarships.");
        return false;
      }
      const id = String(scholarshipId);
      const wasSaved = ids.has(id);

      // Optimistic update.
      setIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });

      try {
        const result = wasSaved
          ? await unsaveScholarship(sessionToken, id)
          : await saveScholarship(sessionToken, id);
        // Trust server's authoritative list.
        if (Array.isArray(result?.ids)) {
          setIds(new Set(result.ids.map(String)));
        }
        toast.success(
          wasSaved
            ? `Removed${scholarshipTitle ? ` "${scholarshipTitle}"` : ""} from saved`
            : `Saved${scholarshipTitle ? ` "${scholarshipTitle}"` : ""}`
        );
        return !wasSaved;
      } catch (err) {
        // Revert optimistic update.
        setIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id);
          else next.delete(id);
          return next;
        });
        const message =
          err?.response?.data?.message ||
          (wasSaved ? "Could not remove from saved." : "Could not save scholarship.");
        toast.error(message);
        return wasSaved;
      }
    },
    [sessionToken, scholarProfile, ids]
  );

  const value = useMemo(
    () => ({ ids, isSaved, toggle, refresh, loading }),
    [ids, isSaved, toggle, refresh, loading]
  );

  return (
    <SavedScholarshipsContext.Provider value={value}>
      {children}
    </SavedScholarshipsContext.Provider>
  );
};

export default SavedScholarshipsProvider;
export { SavedScholarshipsProvider };
