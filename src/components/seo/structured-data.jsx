/**
 * Structured data (JSON-LD) helpers.
 *
 * React 19 hoists <script type="application/ld+json"> to <head> too,
 * so these can be used anywhere in the tree.
 *
 *   <OrganizationSchema />
 *   <EducationalOrganizationSchema />
 *   <WebSiteSchema />
 *   <FAQSchema items={[{ q: "…", a: "…" }, …]} />
 *   <BreadcrumbSchema items={[{ name: "Home", path: "/" }, { name: "Scholarships", path: "/scholarships" }]} />
 *
 * Test in production with:
 *   https://search.google.com/test/rich-results
 */
import { SITE_NAME, DEFAULT_DESCRIPTION } from "./Seo";

const resolveSiteUrl = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return (
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_SITE_URL) ||
    "https://scholarshipzone.app"
  );
};

const Ld = ({ data }) => (
  <script
    type="application/ld+json"
    // Stringify on render so it's deterministic; React 19 will hoist into <head>.
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
  />
);

export const OrganizationSchema = ({ logoPath = "/logo.png", sameAs = [] }) => {
  const siteUrl = resolveSiteUrl();
  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: siteUrl,
        logo: `${siteUrl}${logoPath}`,
        description: DEFAULT_DESCRIPTION,
        sameAs,
      }}
    />
  );
};

export const EducationalOrganizationSchema = ({
  logoPath = "/logo.png",
  sameAs = [],
}) => {
  const siteUrl = resolveSiteUrl();
  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        name: SITE_NAME,
        url: siteUrl,
        logo: `${siteUrl}${logoPath}`,
        description: DEFAULT_DESCRIPTION,
        sameAs,
      }}
    />
  );
};

export const WebSiteSchema = ({ searchPath = "/scholar/scholarships?q={query}" }) => {
  const siteUrl = resolveSiteUrl();
  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: siteUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}${searchPath}`,
          },
          "query-input": "required name=query",
        },
      }}
    />
  );
};

export const FAQSchema = ({ items = [] }) => {
  if (!items.length) return null;
  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      }}
    />
  );
};

export const BreadcrumbSchema = ({ items = [] }) => {
  if (!items.length) return null;
  const siteUrl = resolveSiteUrl();
  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map(({ name, path }, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name,
          item: path?.startsWith("http") ? path : `${siteUrl}${path}`,
        })),
      }}
    />
  );
};

export const ScholarshipSchema = ({
  name,
  description,
  url,
  amount,
  currency = "USD",
  deadline,
  provider,
  eligibility,
}) => {
  if (!name) return null;
  const siteUrl = resolveSiteUrl();
  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "EducationalOccupationalProgram",
        name,
        description,
        url: url?.startsWith("http") ? url : url ? `${siteUrl}${url}` : undefined,
        provider: provider
          ? { "@type": "Organization", name: provider }
          : undefined,
        applicationDeadline: deadline,
        offers: amount
          ? {
              "@type": "Offer",
              price: amount,
              priceCurrency: currency,
            }
          : undefined,
        eligibilityToWorkRequirement: eligibility,
      }}
    />
  );
};
