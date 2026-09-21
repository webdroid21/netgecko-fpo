import type { RouteObject } from 'react-router';

import { Outlet } from 'react-router';
import { lazy, Suspense } from 'react';

import { AuthCenteredContent } from 'src/layouts/auth';

import { SplashScreen } from 'src/components/loading-screen';

import { GuestGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------


/** **************************************
 * Firebase
 *************************************** */
const Firebase = {
  SignInPage: lazy(() => import('src/pages/auth/sign-in')),
};

// ----------------------------------------------------------------------

export const authRoutes: RouteObject[] = [
  {
    path: 'auth',
    element: (
      <Suspense fallback={<SplashScreen />}>
        <Outlet />
      </Suspense>
    ),
    children: [
      {
        path: 'sign-in',
        element: (
          <GuestGuard>
            <AuthCenteredContent>
              <Firebase.SignInPage />
            </AuthCenteredContent>
          </GuestGuard>
        ),
      },
    ],
  },
];
