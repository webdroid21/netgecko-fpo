import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales/use-locales';

import { LandView } from 'src/sections/land/view';

// ----------------------------------------------------------------------

export default function LandsPage() {
  const { t } = useTranslate('navbar');

  const pageTitle = `${t('lands')} - ${CONFIG.appName}`;

  return (
    <>
      <title>{pageTitle}</title>

      <LandView />
    </>
  );
}
