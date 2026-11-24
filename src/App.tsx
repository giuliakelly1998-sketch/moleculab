import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Shell } from './components/layout/Shell';
import { Spinner, ToastHost } from './components/ui';
import { AppDataProvider } from './state/AppDataContext';
import { MoleculeProvider } from './state/MoleculeContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Módulos carregados sob demanda (code splitting por rota).
const OverviewPage = lazy(() => import('./modules/overview/OverviewPage'));
const ExplorerPage = lazy(() => import('./modules/explorer/ExplorerPage'));
const PropertiesPage = lazy(() => import('./modules/properties/PropertiesPage'));
const FunctionalGroupsPage = lazy(() => import('./modules/functional-groups/FunctionalGroupsPage'));
const CalculatorPage = lazy(() => import('./modules/calculator/CalculatorPage'));
const PeriodicTablePage = lazy(() => import('./modules/elements/PeriodicTablePage'));
const ElementPage = lazy(() => import('./modules/elements/ElementPage'));
const KnowledgePage = lazy(() => import('./modules/knowledge/KnowledgePage'));
const FavoritesPage = lazy(() => import('./modules/favorites/FavoritesPage'));
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage'));

export default function App() {
  return (
    <AppDataProvider>
      <MoleculeProvider>
        <HashRouter>
          <Shell>
            <RouteBoundary>
              <Suspense fallback={<Spinner label="Carregando módulo…" />}>
                <Routes>
                  <Route path="/" element={<OverviewPage />} />
                  <Route path="/explorer" element={<ExplorerPage />} />
                  <Route path="/properties" element={<PropertiesPage />} />
                  <Route path="/functional-groups" element={<FunctionalGroupsPage />} />
                  <Route path="/calculator" element={<CalculatorPage />} />
                  <Route path="/calculator/:id" element={<CalculatorPage />} />
                  <Route path="/elements" element={<PeriodicTablePage />} />
                  <Route path="/elements/:symbol" element={<ElementPage />} />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route path="/knowledge/:topicId" element={<KnowledgePage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </RouteBoundary>
          </Shell>
          <ToastHost />
        </HashRouter>
      </MoleculeProvider>
    </AppDataProvider>
  );
}

function RouteBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return <ErrorBoundary resetKey={loc.pathname}>{children}</ErrorBoundary>;
}
