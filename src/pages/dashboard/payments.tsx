import { CONFIG } from 'src/global-config';

import { PaymentView } from 'src/sections/payment/view';

// ----------------------------------------------------------------------

const metadata = { title: `Payments - ${CONFIG.appName}` };

export default function PaymentsPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <PaymentView />
    </>
  );
}
