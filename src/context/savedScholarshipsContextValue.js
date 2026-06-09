import { createContext } from "react";

// Holds the set of saved-scholarship IDs for the signed-in scholar, plus
// helpers to mutate the set. Provider lives in SavedScholarshipsProvider.jsx.
// Default value is intentionally safe for non-scholar pages that may render
// without the provider mounted.
export const SavedScholarshipsContext = createContext({
  ids: new Set(),
  isSaved: () => false,
  toggle: async () => false,
  refresh: async () => {},
  loading: false,
});
