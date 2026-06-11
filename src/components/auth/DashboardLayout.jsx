import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Mail,
  KeyRound,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Home,
  GraduationCap,
  ShieldCheck,
  ChevronRight,
  Inbox,
  Compass,
  FileText,
  FolderArchive,
  Plane,
  ClipboardCheck,
  ScrollText,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "../../context/useAuth";
import {
  listScholarNotifications,
  markScholarNotificationRead,
  markAllScholarNotificationsRead,
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "../../services/notifications";
import LanguageSwitcher from "../common/LanguageSwitcher";
import { ThemeToggle } from "../ui/theme-toggle";
import { Seo } from "../seo/Seo";
import CommandPalette from "./CommandPalette";

// Nav item shapes — labels are resolved from i18n at render time.
const ADMIN_NAV_ITEMS = [
  { to: "/admin", key: "sidebarOverview", icon: LayoutDashboard, end: true },
  { to: "/admin/applicants", key: "sidebarApplicants", icon: Users },
  { to: "/admin/credentials", key: "sidebarCredentials", icon: FolderArchive },
  { to: "/admin/visa-tracker", key: "sidebarVisaTracker", icon: Plane },
  { to: "/admin/messages", key: "sidebarMessages", icon: Mail },
  { to: "/admin/audit-log", key: "sidebarAuditLog", icon: ScrollText },
  { to: "/admin/settings", key: "sidebarSettings", icon: KeyRound },
];

const SCHOLAR_NAV_ITEMS = [
  { to: "/scholar", key: "sidebarOverview", icon: LayoutDashboard, end: true },
  { to: "/scholar/scholarships", key: "sidebarBrowse", icon: Compass },
  { to: "/scholar/saved", key: "sidebarSaved", icon: Heart },
  { to: "/scholar/applications", key: "sidebarApplications", icon: FileText },
  { to: "/scholar/notifications", key: "sidebarNotifications", icon: Bell },
  { to: "/scholar/credentials", key: "sidebarAcademicCredentials", icon: FolderArchive },
  { to: "/scholar/travel-docs", key: "sidebarTravelDocs", icon: Plane },
  { to: "/scholar/visa-tracker", key: "sidebarMyVisaTracker", icon: ClipboardCheck },
];

const ROLE_STYLES = {
  admin: {
    icon: ShieldCheck,
    accent: "bg-gradient-to-br from-primary-dark to-emerald-900",
    accentText: "text-primary-dark",
    accentLight: "bg-primary/10",
  },
  scholar: {
    icon: GraduationCap,
    accent: "bg-primary",
    accentText: "text-primary",
    accentLight: "bg-primary/10",
  },
};

/**
 * DashboardLayout — shared sidebar + topbar wrapper for authenticated screens.
 *
 * Props:
 *   role:       "admin" | "scholar"
 *   user:       { name, email, department?, role? }  display info for the sidebar
 *   title:      page title (topbar)
 *   subtitle:   optional supporting text below title
 *   actions:    optional ReactNode rendered in the topbar right area
 *   onSignOut:  handler for sign-out button
 *   children:   page content
 */
const DashboardLayout = ({
  role = "admin",
  user,
  title,
  subtitle,
  actions,
  onSignOut,
  children,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { sessionToken, scholarProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef(null);
  const styles = ROLE_STYLES[role];
  const Icon = styles.icon;
  const brandLabel = role === "admin" ? t("layout.brandAdmin") : t("layout.brandScholar");
  const navItems = useMemo(
    () => (role === "admin" ? ADMIN_NAV_ITEMS : SCHOLAR_NAV_ITEMS),
    [role]
  );

  // Poll the unified notification feed for both scholars and admins.
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    const fetcher = role === "admin" ? listAdminNotifications : listScholarNotifications;
    const fetchNotifs = async () => {
      try {
        const data = await fetcher(sessionToken, { limit: 10 });
        if (cancelled) return;
        setNotifs(Array.isArray(data?.items) ? data.items : []);
        setUnread(Number(data?.unread) || 0);
      } catch {
        /* silent */
      }
    };
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [role, sessionToken]);

  // Close popover on outside click / escape
  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [notifOpen]);

  const handleNotifLoad = async () => {
    if (!sessionToken) return;
    setNotifLoading(true);
    try {
      const fetcher = role === "admin" ? listAdminNotifications : listScholarNotifications;
      const data = await fetcher(sessionToken, { limit: 10 });
      setNotifs(Array.isArray(data?.items) ? data.items : []);
      setUnread(Number(data?.unread) || 0);
    } catch {
      /* silent */
    } finally {
      setNotifLoading(false);
    }
  };

  const handleNotifClick = async (notif) => {
    setNotifOpen(false);
    if (!notif?.readAt && sessionToken) {
      try {
        const marker = role === "admin" ? markAdminNotificationRead : markScholarNotificationRead;
        await marker(sessionToken, notif._id || notif.id);
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        /* silent */
      }
    }
    if (notif?.url) navigate(notif.url);
  };

  const handleMarkAllRead = async () => {
    if (!sessionToken) return;
    try {
      const marker =
        role === "admin" ? markAllAdminNotificationsRead : markAllScholarNotificationsRead;
      await marker(sessionToken);
      setUnread(0);
      setNotifs((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch {
      /* silent */
    }
  };

  const notifCount = unread;

  const photoUrl =
    user?.photo ||
    (role === "scholar" ? scholarProfile?.application?.photo : null) ||
    null;

  const initials = (user?.name || t("layout.userFallback"))
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = () => {
    if (onSignOut) onSignOut();
    else navigate("/");
  };

  const Sidebar = (
    <div className="flex h-full flex-col bg-white border-r border-border">
      {/* Brand */}
      <div className="flex items-center justify-between p-5 border-b border-border">
        <Link to="/" className="flex items-center font-extrabold text-ink">
          <img
            src="/logo.png"
            alt={t("layout.logoAlt")}
            className="h-24 w-auto object-contain"
          />
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-slate-100"
          aria-label={t("layout.closeSidebar")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Role pill */}
      <div className="px-5 pt-5">
        <div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider", styles.accentLight, styles.accentText)}>
          <Icon className="h-3.5 w-3.5" />
          {brandLabel}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 pt-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.key + item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    isActive
                      ? cn("text-white", styles.accent)
                      : "text-muted hover:bg-slate-100 hover:text-ink"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {t(`layout.${item.key}`)}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-8 px-3 text-xs font-bold uppercase tracking-wider text-muted">{t("layout.quickLinks")}</div>
        <ul className="mt-2 space-y-1">
          <li>
            <Link
              to="/"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted hover:bg-slate-100 hover:text-ink transition-colors"
            >
              <Home className="h-4 w-4" /> {t("layout.publicSite")}
            </Link>
          </li>
        </ul>
      </nav>

      {/* User card + sign out */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <Avatar className="h-9 w-9 shrink-0">
            {photoUrl && (
              <AvatarImage src={photoUrl} alt={user?.name || t("layout.userFallback")} />
            )}
            <AvatarFallback className={styles.accent}>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{user?.name || t("layout.userFallback")}</p>
            <p className="truncate text-xs text-muted">{user?.email || ""}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-center"
        >
          <LogOut className="h-4 w-4" />
          {t("layout.signOut")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={role === "admin" ? t("layout.pageAdminTitle") : t("layout.pageScholarTitle")}
        noindex
      />
      <CommandPalette role={role} />
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 z-30">
        {Sidebar}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 z-50"
            >
              {Sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main panel */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-white/85 px-4 sm:px-6 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden grid h-9 w-9 place-items-center rounded-lg border border-border text-ink hover:bg-slate-100"
            aria-label={t("layout.openSidebar")}
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-base sm:text-lg font-bold text-ink">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted hidden sm:block">{subtitle}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Command palette trigger */}
            <button
              type="button"
              onClick={() => {
                // Dispatch ⌘K to open the palette without coupling to its internal state.
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true })
                );
              }}
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label={t("layout.openCommandPalette")}
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t("layout.quickActions")}</span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
            {actions}
            <LanguageSwitcher variant="compact" className="hidden sm:inline-flex" />
            <ThemeToggle variant="icon" className="hidden sm:inline-flex" />
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen) handleNotifLoad();
                }}
                className="hidden sm:grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink relative"
                aria-label={t("layout.notificationsAria", { count: notifCount })}
                aria-expanded={notifOpen}
              >
                <Bell className="h-4 w-4" />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 z-50 w-80 sm:w-96 origin-top-right rounded-xl border border-border bg-white shadow-modal overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-ink">{t("notifications.title")}</p>
                        <p className="text-xs text-muted">
                          {notifCount > 0
                            ? t("notifications.unreadCount", { count: notifCount })
                            : t("notifications.allCaughtUp")}
                        </p>
                      </div>
                      {notifCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-xs font-semibold text-primary hover:text-primary-dark"
                        >
                          {t("notifications.markAllRead")}
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifLoading && notifs.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-muted">{t("common.loading")}</div>
                      ) : notifs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                          <Inbox className="h-10 w-10 text-muted/40" />
                          <p className="mt-3 text-sm font-semibold text-ink">{t("notifications.noneYet")}</p>
                          <p className="mt-1 text-xs text-muted">
                            {t("notifications.nonePrompt")}
                          </p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-border">
                          {notifs.slice(0, 8).map((n) => (
                            <li key={n._id || n.id}>
                              <button
                                onClick={() => handleNotifClick(n)}
                                className={cn(
                                  "w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors",
                                  !n.readAt && "bg-emerald-50/40"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                                      n.readAt ? "bg-slate-300" : "bg-primary"
                                    )}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-ink">
                                      {n.title}
                                    </p>
                                    {n.body && (
                                      <p className="line-clamp-2 text-xs text-muted">{n.body}</p>
                                    )}
                                    {n.createdAt && (
                                      <p className="mt-0.5 text-[10px] text-muted">
                                        {new Date(n.createdAt).toLocaleString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Link
              to={role === "admin" ? "/admin/settings" : "/scholar"}
              aria-label={t("layout.viewProfileAria", { name: user?.name || t("layout.userFallback") })}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-1 py-1 pr-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Avatar className="h-7 w-7 shrink-0">
                {photoUrl && (
                  <AvatarImage src={photoUrl} alt={user?.name || t("layout.userFallback")} />
                )}
                <AvatarFallback className={cn(styles.accent, "text-[10px]")}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:inline max-w-[10rem] truncate text-xs font-semibold text-ink">
                {user?.name || t("layout.userFallback")}
              </span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
