// i18n bootstrap. Imported by main.jsx BEFORE rendering <App />.
// Detection order: localStorage('scholarz_lang') → navigator language → fallback 'en'.
// Persists user selection back to localStorage so it survives reloads.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en";
import fr from "./locales/fr";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "fr", label: "Français", short: "FR" },
];

const STORAGE_KEY = "scholarz_lang";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    nonExplicitSupportedLngs: true, // 'fr-CA' → 'fr'
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    returnEmptyString: false,
  });

// Keep <html lang="…"> in sync with the active language so assistive
// technologies, browsers, and search engines pick up the correct locale.
// Strip any region suffix (e.g. "fr-CA" → "fr") to match our resources.
const syncHtmlLang = (lng) => {
  if (typeof document === "undefined") return;
  const base = String(lng || "en").split("-")[0];
  document.documentElement.lang = base;
};
syncHtmlLang(i18n.language);
i18n.on("languageChanged", syncHtmlLang);

export function changeLanguage(lng) {
  return i18n.changeLanguage(lng);
}

export default i18n;
