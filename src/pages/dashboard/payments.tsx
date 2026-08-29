import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales/use-locales';

import { PaymentView } from 'src/sections/payment/view';

// ----------------------------------------------------------------------

export default function PaymentsPage() {
  const { t } = useTranslate('navbar');

  const pageTitle = `${t('payments')} - ${CONFIG.appName}`;

  return (
    <>
      <title>{pageTitle}</title>

      <PaymentView />
    </>
  );
}
