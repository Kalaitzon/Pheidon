// Ρύθμιση i18n.
//
// Η γλώσσα ανιχνεύεται από τον browser και αποθηκεύεται στο localStorage.
// Προεπιλογή τα ελληνικά, με πτώση στα αγγλικά αν λείπει κάποιο κλειδί.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import el from './locales/el.json';
import en from './locales/en.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { el: { translation: el }, en: { translation: en } },
    fallbackLng: 'el',
    supportedLngs: ['el', 'en'],
    interpolation: { escapeValue: false },
    /*
     * Προεπιλογή τα ελληνικά, ΠΑΝΤΑ.
     *
     * Ο ανιχνευτής κοιτάζει μόνο το localStorage, δηλαδή τι έχει διαλέξει ο ίδιος
     * ο χρήστης. Αν κοιτούσαμε και τη γλώσσα του browser, όποιος έχει αγγλικά
     * Windows θα άνοιγε την εφαρμογή στα αγγλικά χωρίς να το έχει ζητήσει.
     */
    lng: undefined,
    detection: { order: ['localStorage'], caches: ['localStorage'] },
  });

export default i18n;

/** Το locale για το Intl, από τον κωδικό γλώσσας του i18next. */
export const intlLocale = (language: string): string =>
  language.startsWith('en') ? 'en-US' : 'el-GR';
