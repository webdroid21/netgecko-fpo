import { CONFIG } from 'src/global-config';

import { SignInView } from 'src/auth/view';

// ----------------------------------------------------------------------

const metadata = { title: `Sign in | Firebase - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <SignInView />
    </>
  );
}
