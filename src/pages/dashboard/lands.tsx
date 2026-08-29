import { CONFIG } from 'src/global-config';

import { LandView } from 'src/sections/land/view';

// ----------------------------------------------------------------------

const metadata = { title: `Land Management - ${CONFIG.appName}` };

export default function LandsPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <LandView />
    </>
  );
}
