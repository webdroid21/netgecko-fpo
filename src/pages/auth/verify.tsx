import { CONFIG } from 'src/global-config';

import { VerifyView } from 'src/auth/view';

// ----------------------------------------------------------------------

const metadata = { title: `Verify | Firebase - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <VerifyView />
    </>
  );
}
