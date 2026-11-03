import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, User, ArrowLeft, Bell } from 'lucide-react';
import { AppProvider, useApp } from '@/store';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Explore from '@/screens/Explore';
import RestaurantView from '@/screens/RestaurantView';
import CartView from '@/screens/CartView';
import ProfileView from '@/screens/ProfileView';
import TrackingView from '@/screens/TrackingView';
import Landing from '@/screens/Landing';
import { motion, AnimatePresence } from 'motion/react';
import { FloatingBubbleWidget } from '@/components/FloatingBubbleWidget';

const BackButtonHandler = () => {
  const navigate = useNavigate();
  const { user } = useApp();

  React.useEffect(() => {
    const handlePopState = () => {
      let hasActiveSession = false;
      try {
        const stored = localStorage.getItem('rayo_active_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.isLoggedIn !== false && (parsed?.uid || parsed?.email)) {
            hasActiveSession = true;
          }
        }
      } catch (_) {}

      if (((user && user.isLoggedIn) || hasActiveSession) && window.location.pathname === '/') {
        navigate('/explore', { replace: true });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, navigate]);

  return null;
};

const ClientBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart } = useApp();

  const tabs = [
    { id: 'explore', icon: Home, label: 'Inicio', path: '/explore' },
    { id: 'cart', icon: ShoppingBag, label: 'Carrito', path: '/cart', badge: cart.length },
    { id: 'profile', icon: User, label: 'Perfil', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0E0E11]/95 border-t border-zinc-900/90 px-8 py-2.5 flex justify-around items-center z-50 pb-safe backdrop-blur-md shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path));
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${
              isActive ? 'text-[#FECC01]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="relative">
              <tab.icon size={21} strokeWidth={isActive ? 2.5 : 2} />
              {tab.badge ? (
                <span className="absolute -top-1.5 -right-1.5 bg-[#FECC01] text-black text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-[0_2px_8px_rgba(254,204,1,0.4)]">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const QuotaWarning = () => {
  const { quotaExceeded } = useApp();
  if (!quotaExceeded) return null;

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="bg-orange-600 text-white px-4 py-3 text-[11px] font-bold flex flex-col gap-2 shadow-2xl z-[100] sticky top-0 border-b-2 border-orange-400"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell size={16} className="animate-pulse" />
          <span className="uppercase tracking-tight">Capacidad diaria agotada (Google Free Tier)</span>
        </div>
        <Badge variant="outline" className="text-[9px] border-white text-white font-black">RESET @ 12AM PST ⏳</Badge>
      </div>
      <p className="opacity-90 leading-tight">
        La base de datos gratuita ha llegado a su límite de lectura por hoy. 
        El app está operando en <b>Modo de Respaldo</b> con datos de demostración.
      </p>
    </motion.div>
  );
};

const ClientLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user } = useApp();
  const isLanding = location.pathname === '/landing' || location.pathname === '/';

  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, [user?.theme]);

  return (
    <div className="min-h-screen bg-black text-white pb-20 max-w-md mx-auto relative overflow-x-hidden shadow-2xl border-x border-zinc-900/45 transition-colors duration-300">
      <QuotaWarning />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <FloatingBubbleWidget />
      {!isLanding && <ClientBottomNav />}
    </div>
  );
};

export default function ClientApp() {
  return (
    <AppProvider>
      <BrowserRouter>
        <BackButtonHandler />
        <ClientLayout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/restaurant/:id" element={<RestaurantView />} />
            <Route path="/cart" element={<CartView />} />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/tracking/:id" element={<TrackingView />} />
          </Routes>
        </ClientLayout>
        <Toaster position="top-center" />
      </BrowserRouter>
    </AppProvider>
  );
}
