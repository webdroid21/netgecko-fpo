import { CONFIG } from 'src/global-config';

import { SalesView } from 'src/sections/sales/view';

// ----------------------------------------------------------------------

const metadata = { title: `Sales - ${CONFIG.appName}` };

export default function SalesPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <SalesView />
    </>
  );
}
