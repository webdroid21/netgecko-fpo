import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router';

import App from './app';
import { routesSection } from './routes/sections';
import { ErrorBoundary } from './routes/components';

// ----------------------------------------------------------------------

// After each deploy the old hashed chunks no longer exist; a lazy-loaded
// route then fails with a chunk error. Reload once to pick up the new build.
const RELOAD_GUARD_KEY = 'chunk-reload-at';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    window.location.reload();
  }
});

const router = createBrowserRouter([
  {
    Component: () => (
      <App>
        <Outlet />
      </App>
    ),
    errorElement: <ErrorBoundary />,
    children: routesSection,
  },
]);

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
