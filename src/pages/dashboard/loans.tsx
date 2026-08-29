import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales/use-locales';

import { LoanView } from 'src/sections/loan/view';

// ----------------------------------------------------------------------

export default function LoansPage() {
  const { t } = useTranslate('navbar');

  const pageTitle = `${t('loans')} - ${CONFIG.appName}`;

  return (
    <>
      <title>{pageTitle}</title>

      <LoanView />
    </>
  );
}
