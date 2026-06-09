import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const NAV_GROUPS = {
  admin: [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, keywords: "home dashboard" },
    { to: "/admin/applicants", label: "Applicants", icon: Users, keywords: "scholars users people" },
    { to: "/admin/credentials", label: "Credentials", icon: FolderArchive, keywords: "documents transcripts" },
    { to: "/admin/visa-tracker", label: "Visa tracker", icon: Plane, keywords: "travel embassy" },
    { to: "/admin/messages", label: "Messages", icon: Mail, keywords: "inbox contact email" },
    { to: "/admin/audit-log", label: "Audit log", icon: ScrollText, keywords: "history activity" },
    { to: "/admin/settings", label: "Settings", icon: KeyRound, keywords: "account profile password" },
  ],
  scholar: [
    { to: "/scholar", label: "Overview", icon: LayoutDashboard, keywords: "home dashboard" },
    { to: "/scholar/scholarships", label: "Browse scholarships", icon: Compass, keywords: "search find opportunities" },
    { to: "/scholar/saved", label: "Saved scholarships", icon: Heart, keywords: "watchlist bookmarks favorites" },
    { to: "/scholar/applications", label: "My applications", icon: FileText, keywords: "submissions" },
    { to: "/scholar/credentials", label: "Academic credentials", icon: FolderArchive, keywords: "transcripts documents" },
    { to: "/scholar/travel-docs", label: "Travel documents", icon: Plane, keywords: "passport visa" },
    { to: "/scholar/visa-tracker", label: "Visa tracker", icon: ShieldCheck, keywords: "embassy status" },
    { to: "/scholar/profile", label: "Profile", icon: User, keywords: "account settings me" },
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

  const navItems = useMemo(() => NAV_GROUPS[role] || NAV_GROUPS.scholar, [role]);

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
    toast.success("Signed out");
    navigate("/login");
  }, [navigate, signOut]);

  const searchHeading =
    role === "admin"
      ? query.trim().length >= 2
        ? `Applicants matching "${query.trim()}"`
        : "Search applicants"
      : query.trim().length >= 2
      ? `Scholarships matching "${query.trim()}"`
      : "Search scholarships";

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label={role === "admin" ? "Admin command palette" : "Scholar command palette"}
    >
      <CommandInput
        placeholder={
          role === "admin"
            ? "Type a command, search applicants…"
            : "Type a command, search scholarships…"
        }
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Searching…" : "No results found."}
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
                  <CommandShortcut>Enter</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigation">
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

        <CommandGroup heading="Quick actions">
          <CommandItem value="home landing" onSelect={() => go("/")}>
            <Home />
            <span className="flex-1">Go to home page</span>
          </CommandItem>
          {role === "scholar" && (
            <CommandItem value="inbox notifications" onSelect={() => go("/scholar/notifications")}>
              <Inbox />
              <span className="flex-1">Notifications</span>
            </CommandItem>
          )}
          <CommandItem
            value={`toggle theme dark light ${resolvedTheme}`}
            onSelect={handleToggleTheme}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            <span className="flex-1">
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
            </span>
            <CommandShortcut>{theme === "system" ? "System" : theme}</CommandShortcut>
          </CommandItem>
          <CommandItem value="theme system auto" onSelect={handleSystemTheme}>
            <Settings />
            <span className="flex-1">Use system theme</span>
          </CommandItem>
          <CommandItem value="sign out logout" onSelect={handleSignOut}>
            <LogOut />
            <span className="flex-1">Sign out</span>
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
