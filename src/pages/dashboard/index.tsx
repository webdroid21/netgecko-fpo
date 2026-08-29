import { CONFIG } from 'src/global-config';

import { OverviewAppView } from 'src/sections/overview/app/view';
import { useTranslate } from 'src/locales/use-locales';

// ----------------------------------------------------------------------

export default function OverviewAppPage() {
  const { t } = useTranslate('dashboard');

  const pageTitle = `${t('title')} - ${CONFIG.appName}`;

  return (
    <>
      <title>{pageTitle}</title>

      <OverviewAppView />
    </>
  );
}
