import { createContext } from "react";

/**
 * Theme context value shape:
 *   theme         : "light" | "dark" | "system"   — the user's stored preference
 *   resolvedTheme : "light" | "dark"              — what's actually rendered right now
 *   setTheme      : (next) => void                — update + persist
 *   toggleTheme   : () => void                    — cycle light ↔ dark (ignores "system")
 */
export const ThemeContext = createContext({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});
