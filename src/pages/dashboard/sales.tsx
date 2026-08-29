import { CONFIG } from 'src/global-config';

import { SalesView } from 'src/sections/sales/view';
import { useTranslate } from 'src/locales/use-locales';

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
