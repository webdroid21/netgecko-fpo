import { CONFIG } from 'src/global-config';

import { FpoRelatedView } from 'src/sections/fpo/view';

// ----------------------------------------------------------------------

const metadata = { title: `Loans - ${CONFIG.appName}` };

export default function LoansPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <FpoRelatedView title="Loans" />
    </>
  );
}
