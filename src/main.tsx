import { StrictMode } from 'react';
import './index.css';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRoute, createRouter } from '@tanstack/react-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

const indexRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  component: Index,
});

const newContextRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/context/new',
  component: NewContext,
});

const contextVideoRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/context/video/$videoId',
  component: VideoPage,
});

import { RootRoute } from './routes/__root';
import { Index } from './routes';
import { NewContext } from './routes/context/new';
import VideoPage from './routes/context/video.$videoId';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const routeTree = RootRoute.addChildren([indexRoute, newContextRoute, contextVideoRoute]);

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <RouterProvider router={router} />
      </ConvexProvider>
    </StrictMode>,
  );
}
