import { useContext } from "react";
import { SavedScholarshipsContext } from "./savedScholarshipsContextValue";

export const useSavedScholarships = () => useContext(SavedScholarshipsContext);
