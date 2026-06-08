import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, ShieldCheck, X } from "lucide-react";

const ROLE_OPTIONS = [
  {
    id: "scholar",
    title: "Student",
    description: "Access courses, resources, and learning opportunities.",
    icon: GraduationCap,
  },
  {
    id: "admin",
    title: "Admin",
    description: "Manage users, programs, and platform operations.",
    icon: ShieldCheck,
  },
];

/**
 * AccountTypeModal
 *
 * Props:
 *   open:          boolean
 *   currentRole:   "scholar" | "admin"
 *   onClose:       () => void
 *   onConfirm:     (role) => void
 */
const AccountTypeModal = ({ open, currentRole, onClose, onConfirm }) => {
  const [selected, setSelected] = useState(currentRole);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (open) setSelected(currentRole);
  }, [open, currentRole]);

  // ESC to close + focus trap (basic)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    // focus the dialog
    dialogRef.current?.focus();
    // lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-type-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative z-10 w-full max-w-md rounded-[20px] bg-white p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="account-type-title"
                  className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl"
                >
                  Choose Account Type
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Switch the form to match the account you want.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              role="radiogroup"
              aria-label="Account type"
              className="mt-6 flex flex-col gap-3"
            >
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = selected === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelected(option.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(option.id);
                      }
                    }}
                    className={[
                      "group flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-200",
                      "focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/25",
                      isSelected
                        ? "border-emerald-600 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors",
                        isSelected
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-base font-bold text-slate-900">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-slate-500">
                        {option.description}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={[
                        "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                        isSelected
                          ? "border-emerald-600 bg-emerald-600"
                          : "border-slate-300 bg-white",
                      ].join(" ")}
                    >
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm(selected);
                  onClose();
                }}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/30"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AccountTypeModal;
