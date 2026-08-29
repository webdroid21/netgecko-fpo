import { CONFIG } from 'src/global-config';

import { FpoRelatedView } from 'src/sections/fpo/view';

// ----------------------------------------------------------------------

const metadata = { title: `Input Orders - ${CONFIG.appName}` };

export default function InputOrdersPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <FpoRelatedView title="Input Orders" />
    </>
  );
}
