import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales/use-locales';

import { InputOrderView } from 'src/sections/input-order/view';

// ----------------------------------------------------------------------

export default function InputOrdersPage() {
  const { t } = useTranslate('navbar');

  const pageTitle = `${t('inputOrders')} - ${CONFIG.appName}`;

  return (
    <>
      <title>{pageTitle}</title>

      <InputOrderView />
    </>
  );
}
