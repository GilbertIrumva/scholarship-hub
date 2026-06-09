import { Toaster, toast } from "react-hot-toast";
import { useTheme } from "@/context/useTheme";

/**
 * ThemedToaster — drop-in replacement for <Toaster /> that automatically
 * re-skins toasts for light/dark themes using our CSS variables.
 *
 * Mount once near the app root (in src/main.jsx):
 *   <ThemedToaster />
 *
 * Continue calling toast / toast.success / toast.error from anywhere:
 *   import toast from "react-hot-toast";
 *   toast.success("Saved");
 */
const ThemedToaster = (props) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Toaster
      position="top-right"
      gutter={10}
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: "Manrope, system-ui, sans-serif",
          fontSize: "14px",
          fontWeight: 500,
          background: isDark ? "#11161f" : "#ffffff",
          color: isDark ? "#e2e8f0" : "#0f172a",
          border: `1px solid ${isDark ? "#1f2937" : "#e2e8f0"}`,
          boxShadow: isDark
            ? "0 20px 60px -15px rgba(0, 0, 0, 0.7)"
            : "0 20px 60px -15px rgba(15, 23, 42, 0.25)",
          borderRadius: "12px",
          padding: "12px 14px",
        },
        success: { iconTheme: { primary: "#10b981", secondary: isDark ? "#11161f" : "#fff" } },
        error:   { iconTheme: { primary: "#ef4444", secondary: isDark ? "#11161f" : "#fff" } },
        loading: { iconTheme: { primary: "#10b981", secondary: isDark ? "#11161f" : "#fff" } },
      }}
      {...props}
    />
  );
};

export { ThemedToaster, toast };
export default ThemedToaster;
