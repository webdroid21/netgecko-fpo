import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales/use-locales';

import { SmsView } from 'src/sections/sms/view';

// ----------------------------------------------------------------------

export default function SmsPage() {
  const { t } = useTranslate('navbar');

  const pageTitle = `${t('sms')} - ${CONFIG.appName}`;

  return (
    <>
      <title>{pageTitle}</title>

      <SmsView />
    </>
  );
}
