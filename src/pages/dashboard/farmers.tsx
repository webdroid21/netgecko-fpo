import { CONFIG } from 'src/global-config';

import { FarmerView } from 'src/sections/farmer/view';
import { useTranslate } from 'src/locales/use-locales';

// ----------------------------------------------------------------------

export default function FarmersPage() {
  const { t } = useTranslate('navbar');

  const pageTitle = `${t('farmers')} - ${CONFIG.appName}`;

  return (
    <>
      <title>{pageTitle}</title>

      <FarmerView />
    </>
  );
}
