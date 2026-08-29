import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales/use-locales';

import { AccountView } from 'src/sections/account/view';

// ----------------------------------------------------------------------

export default function AccountPage() {
  const { t } = useTranslate('account');

  const pageTitle = `${t('title')} - ${CONFIG.appName}`;

  return (
    <>
      <title>{pageTitle}</title>

      <AccountView />
    </>
  );
}
