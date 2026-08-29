import { CONFIG } from 'src/global-config';

import { FarmerView } from 'src/sections/farmer/view';

// ----------------------------------------------------------------------

const metadata = { title: `Farmers - ${CONFIG.appName}` };

export default function FarmersPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <FarmerView />
    </>
  );
}
