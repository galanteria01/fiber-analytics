import { RouterProvider, useRouter } from './router.js';
import { ToastProvider } from './toast.js';
import { NavBar } from './components/NavBar.js';
import { ConsentBanner } from './components/feedback.js';
import { HomeView } from './views/HomeView.js';
import { ProductsView } from './views/ProductsView.js';
import { PricingView } from './views/PricingView.js';
import { SettingsView } from './views/SettingsView.js';

function CurrentView() {
  const { path } = useRouter();
  switch (path) {
    case '/products':
      return <ProductsView />;
    case '/pricing':
      return <PricingView />;
    case '/settings':
      return <SettingsView />;
    default:
      return <HomeView />;
  }
}

export function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <div className="app">
          <NavBar />
          <main className="content">
            <CurrentView />
          </main>
          <footer className="footer">
            <span>FiberAnalytics demo</span>
            <span className="muted">Open the overlay (bottom-right) to watch events stream.</span>
          </footer>
        </div>
        <ConsentBanner />
      </ToastProvider>
    </RouterProvider>
  );
}
