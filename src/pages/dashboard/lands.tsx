import { CONFIG } from 'src/global-config';

import { FpoRelatedView } from 'src/sections/fpo/view';

// ----------------------------------------------------------------------

const metadata = { title: `Lands - ${CONFIG.appName}` };

export default function LandsPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <FpoRelatedView title="Lands" />
    </>
  );
}
