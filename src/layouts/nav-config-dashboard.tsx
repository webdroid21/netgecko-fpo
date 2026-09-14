import type { NavSectionProps } from 'src/components/nav-section';

import { paths } from 'src/routes/paths';

import { useTranslate } from 'src/locales';
import { CONFIG } from 'src/global-config';

import { SvgColor } from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name: string) => (
  <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />
);

const ICONS = {
  user: icon('ic-user'),
  land: icon('ic-land'),
  order: icon('ic-order'),
  dollar: icon('ic-dollar'),
  folder: icon('ic-folder'),
  banking: icon('ic-banking'),
  dashboard: icon('ic-dashboard'),
};

// ----------------------------------------------------------------------

export function useDashboardNavData(): NavSectionProps['data'] {
  const { t } = useTranslate('navbar');

  return [
    {
      // subheader: t('subheader'),
      items: [
        { title: t('home'), path: paths.dashboard.root, icon: ICONS.dashboard },
        { title: t('farmers'), path: paths.dashboard.fpo.farmers, icon: ICONS.user },
        { title: t('lands'), path: paths.dashboard.fpo.lands, icon: ICONS.land },
        { title: t('inputOrders'), path: paths.dashboard.fpo.inputOrders, icon: ICONS.order },
        { title: t('loans'), path: paths.dashboard.fpo.loans, icon: ICONS.banking },
        { title: t('payments'), path: paths.dashboard.fpo.payments, icon: ICONS.dollar },
        { title: t('sales'), path: paths.dashboard.fpo.sales, icon: ICONS.order },
      ],
    },
  ];
}
