import { CONFIG } from 'src/global-config';

import { LandView } from 'src/sections/land/view';
import { useTranslate } from 'src/locales/use-locales';

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
