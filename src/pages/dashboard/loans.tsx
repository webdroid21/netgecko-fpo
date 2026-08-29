import { CONFIG } from 'src/global-config';

import { LoanView } from 'src/sections/loan/view';
import { useTranslate } from 'src/locales/use-locales';

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
