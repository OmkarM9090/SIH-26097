
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';


import en from './locales/en.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import mr from './locales/mr.json';
import bn from './locales/bn.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  ta: { translation: ta },
  te: { translation: te },
  mr: { translation: mr },
  bn: { translation: bn }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'hi',
    fallbackLng: 'hi',
    interpolation: {
      escapeValue: false, // react already safes from xss
    }
  });

export default i18n;
