/**
 * Seo — per-route head metadata.
 *
 * Relies on React 19's built-in head hoisting: <title>, <meta>, <link>
 * rendered anywhere in the React tree are automatically promoted to
 * <head>. No provider, no extra dependency required.
 *
 * Usage:
 *   <Seo
 *     title="Verified Scholarships"
 *     description="Discover scholarships matched to your profile."
 *     path="/scholar/scholarships"
 *   />
 *
 *   // Authenticated page — keep out of search engines:
 *   <Seo title="Admin Dashboard" noindex />
 *
 *   // Override the social image for a specific page:
 *   <Seo title="…" image="/og-scholarships.png" />
 */

const SITE_NAME = "ScholarshipZone";
const DEFAULT_DESCRIPTION =
  "ScholarshipZone helps underserved students discover verified scholarships, track applications, and connect with opportunity pathways built for real-world access.";
const DEFAULT_IMAGE = "/og-image.png";
const TWITTER_HANDLE = "@ScholarshipZone";

const resolveSiteUrl = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  // SSR / pre-render fallback. Override with VITE_SITE_URL in production.
  return (
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_SITE_URL) ||
    "https://scholarshipzone.app"
  );
};

const buildTitle = (title, fallback) => {
  if (!title) return fallback || SITE_NAME;
  // Avoid stuttering — if the page title already includes the brand, leave it.
  if (title.toLowerCase().includes("scholarshipzone")) return title;
  return `${title} · ${SITE_NAME}`;
};

const Seo = ({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  path,
  type = "website",
  noindex = false,
  keywords,
  locale = "en_US",
}) => {
  const siteUrl = resolveSiteUrl();
  const fullTitle = buildTitle(title);
  const absoluteImage = image?.startsWith("http") ? image : `${siteUrl}${image}`;
  const canonical = path
    ? `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`
    : typeof window !== "undefined"
    ? `${siteUrl}${window.location.pathname}`
    : siteUrl;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta
        name="robots"
        content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}
      />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={locale} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />
    </>
  );
};

export { Seo, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_IMAGE };
export default Seo;
