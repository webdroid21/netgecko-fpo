import { CONFIG } from 'src/global-config';

import { PaymentView } from 'src/sections/payment/view';
import { useTranslate } from 'src/locales/use-locales';

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
