import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Compass,
  FileText,
  FolderArchive,
  GraduationCap,
  Heart,
  Home,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Moon,
  Plane,
  ScrollText,
  Search as SearchIcon,
  Settings,
  ShieldCheck,
  Sun,
  User,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAuth } from "../../context/useAuth";
import { useTheme } from "../../context/useTheme";
import { listAdminApplicants } from "../../services/adminAuth";
import { searchPublicScholarships } from "../../services/publicApi";

const NAV_GROUPS_RAW = {
  admin: [
    { to: "/admin", labelKey: "commandPalette.navOverview", icon: LayoutDashboard, keywords: "home dashboard" },
    { to: "/admin/applicants", labelKey: "commandPalette.navApplicants", icon: Users, keywords: "scholars users people" },
    { to: "/admin/credentials", labelKey: "commandPalette.navCredentials", icon: FolderArchive, keywords: "documents transcripts" },
    { to: "/admin/visa-tracker", labelKey: "commandPalette.navVisaTracker", icon: Plane, keywords: "travel embassy" },
    { to: "/admin/messages", labelKey: "commandPalette.navMessages", icon: Mail, keywords: "inbox contact email" },
    { to: "/admin/audit-log", labelKey: "commandPalette.navAuditLog", icon: ScrollText, keywords: "history activity" },
    { to: "/admin/settings", labelKey: "commandPalette.navSettings", icon: KeyRound, keywords: "account profile password" },
  ],
  scholar: [
    { to: "/scholar", labelKey: "commandPalette.navOverview", icon: LayoutDashboard, keywords: "home dashboard" },
    { to: "/scholar/scholarships", labelKey: "commandPalette.navBrowse", icon: Compass, keywords: "search find opportunities" },
    { to: "/scholar/saved", labelKey: "commandPalette.navSaved", icon: Heart, keywords: "watchlist bookmarks favorites" },
    { to: "/scholar/applications", labelKey: "commandPalette.navApplications", icon: FileText, keywords: "submissions" },
    { to: "/scholar/credentials", labelKey: "commandPalette.navAcademicCredentials", icon: FolderArchive, keywords: "transcripts documents" },
    { to: "/scholar/travel-docs", labelKey: "commandPalette.navTravelDocs", icon: Plane, keywords: "passport visa" },
    { to: "/scholar/visa-tracker", labelKey: "commandPalette.navVisaTracker", icon: ShieldCheck, keywords: "embassy status" },
    { to: "/scholar/profile", labelKey: "commandPalette.navProfile", icon: User, keywords: "account settings me" },
  ],
};

/**
 * CommandPalette — global ⌘K / Ctrl+K palette for authenticated users.
 *
 * Features:
 *  - Navigation across the role-specific dashboard
 *  - Async search: applicants (admin) or scholarships (scholar) with debounce
 *  - Quick actions: toggle theme, sign out, go home
 */
const CommandPalette = ({ role = "scholar" }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionToken, signOut } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  // Global hotkey: ⌘K / Ctrl+K toggles, Esc handled by the dialog itself.
  useEffect(() => {
    const onKey = (event) => {
      const isToggle = (event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey);
      if (!isToggle) return;
      // Ignore when typing inside an editable element (unless the palette is already open).
      const target = event.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isEditable && !open) {
        // Still allow ⌘K to open from inside inputs.
      }
      event.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset state when closing.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSearching(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    }
  }, [open]);

  // Debounced async search.
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      try {
        if (role === "admin") {
          if (!sessionToken) {
            setResults([]);
            return;
          }
          const list = await listAdminApplicants(sessionToken);
          const filtered = (Array.isArray(list) ? list : list?.applicants || [])
            .filter((a) => {
              const blob = `${a.firstName || ""} ${a.lastName || ""} ${a.email || ""} ${a.country || ""}`.toLowerCase();
              return blob.includes(term.toLowerCase());
            })
            .slice(0, 6)
            .map((a) => ({
              id: a.id || a._id,
              kind: "applicant",
              title: `${a.firstName || ""} ${a.lastName || ""}`.trim() || a.email,
              subtitle: a.email,
              path: `/admin/applicants/${a.id || a._id}`,
            }));
          if (requestId === requestIdRef.current) setResults(filtered);
        } else {
          const response = await searchPublicScholarships({ q: term, limit: 6 });
          const list = response?.results || response?.scholarships || response || [];
          if (requestId === requestIdRef.current) {
            setResults(
              list.slice(0, 6).map((s) => ({
                id: s.id || s._id,
                kind: "scholarship",
                title: s.title || s.name,
                subtitle: s.country || s.field || "",
                path: `/scholar/scholarships/${s.id || s._id}`,
              }))
            );
          }
        }
      } catch {
        if (requestId === requestIdRef.current) setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, role, sessionToken]);

  const go = useCallback(
    (path) => {
      setOpen(false);
      navigate(path);
    },
    [navigate]
  );

  const navItems = useMemo(() => {
    const base = NAV_GROUPS_RAW[role] || NAV_GROUPS_RAW.scholar;
    return base.map((item) => ({ ...item, label: t(item.labelKey) }));
  }, [role, t]);

  const handleToggleTheme = useCallback(() => {
    setOpen(false);
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const handleSystemTheme = useCallback(() => {
    setOpen(false);
    setTheme("system");
  }, [setTheme]);

  const handleSignOut = useCallback(() => {
    setOpen(false);
    signOut?.();
    toast.success(t("commandPalette.signedOut"));
    navigate("/login");
  }, [navigate, signOut, t]);

  const trimmed = query.trim();
  const searchHeading =
    role === "admin"
      ? trimmed.length >= 2
        ? t("commandPalette.applicantsMatching", { query: trimmed })
        : t("commandPalette.searchApplicants")
      : trimmed.length >= 2
      ? t("commandPalette.scholarshipsMatching", { query: trimmed })
      : t("commandPalette.searchScholarships");

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label={role === "admin" ? t("commandPalette.adminLabel") : t("commandPalette.scholarLabel")}
    >
      <CommandInput
        placeholder={
          role === "admin"
            ? t("commandPalette.placeholderAdmin")
            : t("commandPalette.placeholderScholar")
        }
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? t("commandPalette.searching") : t("commandPalette.noResults")}
        </CommandEmpty>

        {results.length > 0 && (
          <>
            <CommandGroup heading={searchHeading}>
              {results.map((item) => (
                <CommandItem
                  key={`${item.kind}-${item.id}`}
                  value={`${item.kind} ${item.title} ${item.subtitle}`}
                  onSelect={() => go(item.path)}
                >
                  {item.kind === "applicant" ? <User /> : <GraduationCap />}
                  <span className="flex-1 truncate">
                    {item.title}
                    {item.subtitle && (
                      <span className="ml-2 text-xs text-muted">{item.subtitle}</span>
                    )}
                  </span>
                  <CommandShortcut>{t("commandPalette.shortcutEnter")}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading={t("commandPalette.headingNav")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.keywords}`}
                onSelect={() => go(item.to)}
              >
                <Icon />
                <span className="flex-1">{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("commandPalette.headingQuickActions")}>
          <CommandItem value="home landing" onSelect={() => go("/")}>
            <Home />
            <span className="flex-1">{t("commandPalette.goHome")}</span>
          </CommandItem>
          {role === "scholar" && (
            <CommandItem value="inbox notifications" onSelect={() => go("/scholar/notifications")}>
              <Inbox />
              <span className="flex-1">{t("commandPalette.notifications")}</span>
            </CommandItem>
          )}
          <CommandItem
            value={`toggle theme dark light ${resolvedTheme}`}
            onSelect={handleToggleTheme}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            <span className="flex-1">
              {resolvedTheme === "dark" ? t("commandPalette.switchToLight") : t("commandPalette.switchToDark")}
            </span>
            <CommandShortcut>{theme === "system" ? t("commandPalette.shortcutSystem") : theme}</CommandShortcut>
          </CommandItem>
          <CommandItem value="theme system auto" onSelect={handleSystemTheme}>
            <Settings />
            <span className="flex-1">{t("commandPalette.useSystemTheme")}</span>
          </CommandItem>
          <CommandItem value="sign out logout" onSelect={handleSignOut}>
            <LogOut />
            <span className="flex-1">{t("commandPalette.signOut")}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
export { CommandPalette };
// re-export icon for parents that want to render the trigger button:
export { SearchIcon as CommandPaletteTriggerIcon };
