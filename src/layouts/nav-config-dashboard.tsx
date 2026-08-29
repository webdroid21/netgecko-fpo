import type { NavSectionProps } from 'src/components/nav-section';

import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';

import { SvgColor } from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name: string) => (
  <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />
);

const ICONS = {
  user: icon('ic-user'),
  order: icon('ic-order'),
  folder: icon('ic-folder'),
  banking: icon('ic-banking'),
  dashboard: icon('ic-dashboard'),
};

// ----------------------------------------------------------------------

export const navData: NavSectionProps['data'] = [
  {
    subheader: 'FPO modules',
    items: [
      { title: 'Home', path: paths.dashboard.root, icon: ICONS.dashboard },
      { title: 'Farmers', path: paths.dashboard.fpo.farmers, icon: ICONS.user },
      { title: 'Lands', path: paths.dashboard.fpo.lands, icon: ICONS.folder },
      { title: 'Input orders', path: paths.dashboard.fpo.inputOrders, icon: ICONS.order },
      { title: 'Loans', path: paths.dashboard.fpo.loans, icon: ICONS.banking },
    ],
  },
];
