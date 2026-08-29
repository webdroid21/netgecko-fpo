import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { Outlet, Navigate } from 'react-router';

import { CONFIG } from 'src/global-config';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { AuthGuard } from 'src/auth/guard';

import { usePathname } from '../hooks';

// ----------------------------------------------------------------------

// Overview
const IndexPage = lazy(() => import('src/pages/dashboard'));
const FarmersPage = lazy(() => import('src/pages/dashboard/farmers'));
const LandsPage = lazy(() => import('src/pages/dashboard/lands'));
const InputOrdersPage = lazy(() => import('src/pages/dashboard/input-orders'));
const LoansPage = lazy(() => import('src/pages/dashboard/loans'));
const PaymentsPage = lazy(() => import('src/pages/dashboard/payments'));
const SalesPage = lazy(() => import('src/pages/dashboard/sales'));
const AccountPage = lazy(() => import('src/pages/dashboard/account'));
// ----------------------------------------------------------------------

function SuspenseOutlet() {
  const pathname = usePathname();
  return (
    <Suspense key={pathname} fallback={<LoadingScreen />}>
      <Outlet />
    </Suspense>
  );
}

const dashboardLayout = () => (
  <DashboardLayout>
    <SuspenseOutlet />
  </DashboardLayout>
);

export const dashboardRoutes: RouteObject[] = [
  {
    path: 'dashboard',
    element: CONFIG.auth.skip ? dashboardLayout() : <AuthGuard>{dashboardLayout()}</AuthGuard>,
    children: [
      { index: true, element: <IndexPage /> },
      { path: 'farmers', element: <FarmersPage /> },
      { path: 'lands', element: <LandsPage /> },
      { path: 'input-orders', element: <InputOrdersPage /> },
      { path: 'loans', element: <LoansPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'sales', element: <SalesPage /> },
      { path: 'account', element: <AccountPage /> },
      {
        path: 'subpaths',
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard/subpaths/sub-1/sub-2" />,
          },
          { path: 'sub-1/sub-2', element: <div> aub 2 </div> },
        ],
      },
    ],
  },
];
