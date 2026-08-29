import { CONFIG } from 'src/global-config';

import { InputOrderView } from 'src/sections/input-order/view';

// ----------------------------------------------------------------------

const metadata = { title: `Input Orders - ${CONFIG.appName}` };

export default function InputOrdersPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <InputOrderView />
    </>
  );
}
