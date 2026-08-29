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
  SignUpPage: lazy(() => import('src/pages/auth/sign-up')),
  VerifyPage: lazy(() => import('src/pages/auth/verify')),
  ResetPasswordPage: lazy(() => import('src/pages/auth/reset-password')),
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
      {
        path: 'sign-up',
        element: (
          <GuestGuard>
            <AuthCenteredContent>
              <Firebase.SignUpPage />
            </AuthCenteredContent>
          </GuestGuard>
        ),
      },
      {
        path: 'verify',
        element: (
          <AuthCenteredContent>
            <Firebase.VerifyPage />
          </AuthCenteredContent>
        ),
      },
      {
        path: 'reset-password',
        element: (
          <AuthCenteredContent>
            <Firebase.ResetPasswordPage />
          </AuthCenteredContent>
        ),
      },
    ],
  },
];
