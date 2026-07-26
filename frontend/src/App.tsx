import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { CenteredLoader } from './components/ui/states';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { MapPage } from './features/map/MapPage';
import { NetworkPage } from './features/network/NetworkPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { OffendersPage } from './features/offenders/OffendersPage';
import { OffenderProfilePage } from './features/offenders/OffenderProfilePage';
import { AssistantPage } from './features/assistant/AssistantPage';

export default function App() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <CenteredLoader label="Restoring secure session…" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="offenders" element={<OffendersPage />} />
        <Route path="offenders/:id" element={<OffenderProfilePage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
