import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales/use-locales';

import { SalesView } from 'src/sections/sales/view';

// ----------------------------------------------------------------------

export default function SalesPage() {
  const { t } = useTranslate('navbar');

  const pageTitle = `${t('sales')} - ${CONFIG.appName}`;

  return (
    <>
      <title>{pageTitle}</title>

      <SalesView />
    </>
  );
}
