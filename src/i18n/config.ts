import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enDashboard from '@/locales/en/dashboard.json';
import enTools from '@/locales/en/tools.json';
import enPdfViewer from '@/locales/en/pdf-viewer.json';
import enSettings from '@/locales/en/settings.json';

import heCommon from '@/locales/he/common.json';
import heAuth from '@/locales/he/auth.json';
import heDashboard from '@/locales/he/dashboard.json';
import heTools from '@/locales/he/tools.json';
import hePdfViewer from '@/locales/he/pdf-viewer.json';
import heSettings from '@/locales/he/settings.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        tools: enTools,
        'pdf-viewer': enPdfViewer,
        settings: enSettings,
      },
      he: {
        common: heCommon,
        auth: heAuth,
        dashboard: heDashboard,
        tools: heTools,
        'pdf-viewer': hePdfViewer,
        settings: heSettings,
      },
    },
    defaultNS: 'common',
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
