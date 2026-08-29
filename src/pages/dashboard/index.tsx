import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales/use-locales';

import { OverviewAppView } from 'src/sections/overview/app/view';

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
