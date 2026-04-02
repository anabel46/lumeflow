import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import OrderDetail from '@/pages/OrderDetail';
import Production from '@/pages/Production';
import Catalog from '@/pages/Catalog';
import Stock from '@/pages/Stock';
import Quality from '@/pages/Quality';
import SectorView from '@/pages/SectorView';
import Sac from '@/pages/Sac';
import Reports from '@/pages/Reports';
import Administration from '@/pages/Administration';
import SankhyaIntegration from '@/pages/SankhyaIntegration';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-4">Carregando LumiFlow...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pedidos" element={<Orders />} />
        <Route path="/pedidos/:id" element={<OrderDetail />} />
        <Route path="/producao" element={<Production />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/estoque" element={<Stock />} />
        <Route path="/qualidade" element={<Quality />} />
        <Route path="/setor/:sectorId" element={<SectorView />} />
        <Route path="/sac" element={<Sac />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/administracao" element={<Administration />} />
        <Route path="/integracao-sankhya" element={<SankhyaIntegration />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App