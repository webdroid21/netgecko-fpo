import { CONFIG } from 'src/global-config';

import { AccountView } from 'src/sections/account/view';

// ----------------------------------------------------------------------

const metadata = { title: `Account - ${CONFIG.appName}` };

export default function AccountPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <AccountView />
    </>
  );
}
