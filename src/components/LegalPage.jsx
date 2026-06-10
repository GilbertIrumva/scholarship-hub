import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Seo } from "./seo/Seo";

const VARIANT_KEYS = ["privacy", "terms", "accessibility"];
const SECTION_KEYS = ["one", "two", "three"];

const LegalPage = ({ variant }) => {
  const { t } = useTranslation();
  const safeVariant = VARIANT_KEYS.includes(variant) ? variant : "privacy";
  const legalPath =
    safeVariant === "terms"
      ? "/terms"
      : safeVariant === "accessibility"
      ? "/accessibility"
      : "/privacy";

  const title = t(`legal.${safeVariant}.title`);
  const intro = t(`legal.${safeVariant}.intro`);

  return (
    <main className="landing">
      <Seo title={title} description={intro} path={legalPath} />
      <div className="landing__container">
        <section className="landing__section" aria-labelledby="legal-heading">
          <header className="landing__section-head">
            <span className="landing__section-eyebrow">{t("common.appName")}</span>
            <h1 id="legal-heading" className="landing__section-title">
              {title}
            </h1>
            <p className="landing__section-sub">{intro}</p>
          </header>

          <div className="landing__cards" style={{ width: "min(960px, 100%)" }}>
            {SECTION_KEYS.map((key) => (
              <article key={key} className="landing__card">
                <h2 className="landing__card-title">
                  {t(`legal.${safeVariant}.sections.${key}.heading`)}
                </h2>
                <p className="landing__card-desc">
                  {t(`legal.${safeVariant}.sections.${key}.body`)}
                </p>
              </article>
            ))}
          </div>

          <div className="landing__hero-ctas" style={{ marginTop: 24 }}>
            <Link to="/" className="landing__btn landing__btn--primary">
              {t("common.backToHome")}
            </Link>
            <a href="mailto:hello@scholarshipzone.org" className="landing__btn landing__btn--ghost">
              {t("legal.contactSupport")}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
};

export default LegalPage;