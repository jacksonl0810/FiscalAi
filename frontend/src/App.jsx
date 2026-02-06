import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from '@/pages/Login';
import Pricing from '@/pages/Pricing';
import PaymentSuccess from '@/pages/PaymentSuccess';
import PaymentFailed from '@/pages/PaymentFailed';
import SubscriptionBlocked from '@/pages/SubscriptionBlocked';
import SubscriptionSettings from '@/pages/SubscriptionSettings';
import SubscriptionPending from '@/pages/SubscriptionPending';
import PaymentDelinquent from '@/pages/PaymentDelinquent';
import CheckoutSubscription from '@/pages/CheckoutSubscription';
import GoogleCallback from '@/pages/GoogleCallback';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

/**
 * Protected Route with Subscription Status Guard
 * 👉 Backend /auth/me decides access based on subscription_status
 * 
 * Access Priority:
 * 1. 'ativo' - User has active paid subscription ✅ ALLOW
 * 2. 'pending' - Payment processing
 * 3. 'inadimplente' - Payment failed
 * 4. 'cancelado' - Subscription canceled and period ended
 * 5. null/undefined - New user, needs to select plan
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 🚨 SUBSCRIPTION STATUS GUARDS
  // Frontend checks user.subscription_status from backend
  const status = user?.subscription_status;
  const plan = user?.plan;

  // ✅ PRIORITY 1: User has a plan (pay_per_use/essential/professional/accountant) → allow access
  // This ensures users with subscriptions can access dashboard even if status is weird
  // If user has ANY plan value, they have a subscription and should have access
  if (plan) {
    const planLower = String(plan).toLowerCase();
    if (planLower === 'pay_per_use' || planLower === 'essential' || planLower === 'professional' || planLower === 'accountant') {
      return children;
    }
    // Even if plan value is unexpected, if it exists, allow access
    return children;
  }

  // ✅ PRIORITY 2: Active subscription → allow access
  // Normalize status to lowercase for comparison (consistent with Login.jsx and GoogleCallback.jsx)
  const statusLower = status ? String(status).toLowerCase() : null;
  if (statusLower === 'ativo' || statusLower === 'active') {
    return children;
  }

  // ✅ PRIORITY 3: User has days remaining in subscription period → allow access
  if (user?.days_remaining > 0) {
    return children;
  }

  // 🚫 REDIRECT: New users without subscription must select a plan first
  // Only redirect to pricing if user truly has NO subscription
  if ((statusLower === null || statusLower === undefined || statusLower === 'no_subscription') && !plan) {
    return <Navigate to="/pricing" replace />;
  }

  // 🚫 REDIRECT: Payment is being processed
  if (statusLower === 'pending') {
    return <Navigate to="/subscription-pending" replace />;
  }

  // 🚫 REDIRECT: Payment failed or overdue (handles both Portuguese and English)
  if (statusLower === 'inadimplente' || statusLower === 'past_due') {
    return <Navigate to="/payment-delinquent" replace />;
  }

  // 🚫 REDIRECT: Subscription canceled and expired (handles both Portuguese and English)
  if (statusLower === 'cancelado' || statusLower === 'canceled') {
    return <Navigate to="/subscription-blocked" replace />;
  }

  // Default: allow access (shouldn't reach here)
  return children;
};

// AppRoutes component - must be inside AuthProvider
const AppRoutes = () => {
  const { isLoadingAuth, authError } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/checkout/subscription" element={<CheckoutSubscription />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-failed" element={<PaymentFailed />} />
      <Route path="/auth/google/callback" element={<GoogleCallback />} />
      
      {/* Subscription status routes (semi-protected) */}
      <Route path="/subscription-blocked" element={<SubscriptionBlocked />} />
      <Route path="/subscription-pending" element={<SubscriptionPending />} />
      <Route path="/payment-delinquent" element={<PaymentDelinquent />} />
      
      {/* Subscription settings - protected */}
      <Route path="/subscription" element={
        <ProtectedRoute>
          <LayoutWrapper currentPageName="Subscription">
            <SubscriptionSettings />
          </LayoutWrapper>
        </ProtectedRoute>
      } />
      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        </ProtectedRoute>
      } />
      
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <ProtectedRoute>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </ProtectedRoute>
          }
        />
      ))}
      
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

// Separate component to ensure it's inside AuthProvider
const AppContent = () => {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <NavigationTracker />
        <AppRoutes />
      </Router>
      <SonnerToaster 
        position="top-right"
        richColors
        expand={true}
        toastOptions={{
          duration: 5000,
          classNames: {
            toast: '!bg-gradient-to-br !from-[#1a1a2e] !via-[#16213e] !to-[#0f1419] !backdrop-blur-xl !border !border-white/20 !shadow-2xl !rounded-2xl !p-6',
            title: '!text-white !font-semibold !text-base !mb-2',
            description: '!text-gray-200 !text-sm !leading-relaxed',
            error: '!bg-gradient-to-br !from-red-950/90 !via-red-900/80 !to-red-950/90 !border-red-500/40 !shadow-red-500/20',
            success: '!bg-gradient-to-br !from-emerald-950/90 !via-emerald-900/80 !to-emerald-950/90 !border-emerald-500/40 !shadow-emerald-500/20',
            warning: '!bg-gradient-to-br !from-amber-950/90 !via-amber-900/80 !to-amber-950/90 !border-amber-500/40 !shadow-amber-500/20',
            info: '!bg-gradient-to-br !from-blue-950/90 !via-blue-900/80 !to-blue-950/90 !border-blue-500/40 !shadow-blue-500/20',
          },
          style: {
            background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 50%, rgba(15, 20, 25, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            color: '#ffffff',
            padding: '20px',
            minWidth: '380px',
            maxWidth: '500px',
          },
        }}
      />
    </QueryClientProvider>
  );
};

export default App
