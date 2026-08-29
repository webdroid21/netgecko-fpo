import { CONFIG } from 'src/global-config';

import { InputOrderView } from 'src/sections/input-order/view';
import { useTranslate } from 'src/locales/use-locales';

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
