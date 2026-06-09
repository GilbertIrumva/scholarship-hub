import { Link } from "react-router-dom";
import { Seo } from "./seo/Seo";

const LEGAL_CONTENT = {
  privacy: {
    title: "Privacy Policy",
    intro:
      "ScholarshipZone collects only the information needed to help scholars discover opportunities, manage applications, and contact support.",
    sections: [
      {
        heading: "What we collect",
        body:
          "We may collect contact details, profile information, application data, and support messages that scholars or partner institutions choose to submit.",
      },
      {
        heading: "How we use it",
        body:
          "Information is used to power scholarship discovery, application workflows, account access, partner coordination, and user support. We do not sell scholar data to advertising or data brokerage services.",
      },
      {
        heading: "Data access",
        body:
          "Access is limited to the teams and partner workflows that need it to deliver the platform. Sensitive operations should be protected with appropriate operational safeguards.",
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    intro:
      "ScholarshipZone is intended to help scholars, institutions, and partners discover and manage scholarship opportunities responsibly.",
    sections: [
      {
        heading: "Using the platform",
        body:
          "Users should provide accurate information, respect other applicants and partner institutions, and avoid misuse of application or messaging flows.",
      },
      {
        heading: "Scholarship listings",
        body:
          "We work to keep listings accurate and current, but scholarship terms, deadlines, and eligibility remain subject to the issuing institution or sponsor.",
      },
      {
        heading: "Service updates",
        body:
          "We may improve, update, or refine the platform over time to improve reliability, accessibility, and partner workflows.",
      },
    ],
  },
  accessibility: {
    title: "Accessibility Statement",
    intro:
      "ScholarshipZone aims to be usable across low-bandwidth environments, mobile devices, and a wide range of assistive needs.",
    sections: [
      {
        heading: "Design approach",
        body:
          "We prioritize readable typography, keyboard-accessible controls, clear navigation, and lightweight pages that load on slower networks.",
      },
      {
        heading: "Ongoing improvements",
        body:
          "Accessibility is part of our product work. We review issues, refine interfaces, and improve interaction patterns as the platform evolves.",
      },
      {
        heading: "Need help?",
        body:
          "If you encounter an accessibility barrier, contact hello@scholarshipzone.org and we will review it as quickly as possible.",
      },
    ],
  },
};

const LegalPage = ({ variant }) => {
  const content = LEGAL_CONTENT[variant] || LEGAL_CONTENT.privacy;
  const legalPath =
    variant === "terms"
      ? "/terms"
      : variant === "accessibility"
      ? "/accessibility"
      : "/privacy";

  return (
    <main className="landing">
      <Seo
        title={content.title}
        description={content.intro}
        path={legalPath}
      />
      <div className="landing__container">
        <section className="landing__section" aria-labelledby="legal-heading">
          <header className="landing__section-head">
            <span className="landing__section-eyebrow">ScholarshipZone</span>
            <h1 id="legal-heading" className="landing__section-title">
              {content.title}
            </h1>
            <p className="landing__section-sub">{content.intro}</p>
          </header>

          <div className="landing__cards" style={{ width: "min(960px, 100%)" }}>
            {content.sections.map((section) => (
              <article key={section.heading} className="landing__card">
                <h2 className="landing__card-title">{section.heading}</h2>
                <p className="landing__card-desc">{section.body}</p>
              </article>
            ))}
          </div>

          <div className="landing__hero-ctas" style={{ marginTop: 24 }}>
            <Link to="/" className="landing__btn landing__btn--primary">
              Back to home
            </Link>
            <a href="mailto:hello@scholarshipzone.org" className="landing__btn landing__btn--ghost">
              Contact support
            </a>
          </div>
        </section>
      </div>
    </main>
  );
};

export default LegalPage;