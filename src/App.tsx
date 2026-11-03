import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingBag, User, ArrowLeft, MapPin, Package, Bell, Store, Bike } from 'lucide-react';
import { AppProvider, useApp } from './store';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Explore from '@/screens/Explore';
import RestaurantView from '@/screens/RestaurantView';
import CartView from '@/screens/CartView';
import ProfileView from '@/screens/ProfileView';
import TrackingView from '@/screens/TrackingView';
import Landing from '@/screens/Landing';
import RiderApp from '@/screens/rider/RiderApp';
import AdminApp from '@/screens/admin/AdminApp';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { FloatingBubbleWidget } from '@/components/FloatingBubbleWidget';
import { playOrderChime, sendOrderNotification, vibrateDevice, flashTabTitle } from '@/lib/notifications';

const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
        // Prevent accidental exit to landing/login on back button press
        navigate('/explore', { replace: true });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, navigate]);

  return null;
};

const NotificationListener = () => {
  const { orders, user } = useApp();
  const navigate = useNavigate();
  const [lastOrderCount, setLastOrderCount] = React.useState(orders.length);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    // Unlock audio playback on first interaction
    const unlockAudio = () => {
      playOrderChime();
      if (audioRef.current) {
        audioRef.current.load();
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  React.useEffect(() => {
    if (orders.length > lastOrderCount) {
      const newOrders = orders.slice(0, orders.length - lastOrderCount);
      const isEduardo = user?.email?.toLowerCase() === 'emunozberber4@gmail.com' || 
                        user?.email?.toLowerCase() === 'emunozberber@gmail.com' ||
                        user?.name?.toLowerCase().includes('eduardo');

      const isRelevant = newOrders.some(order => {
        if (isEduardo) return order.status === 'recibido';
        if (user?.role === 'rider') return false; // Only Eduardo receives orders for now
        if (user?.role === 'admin') return order.restaurantId === user.restaurantId && order.status === 'recibido';
        if (user?.role === 'super_admin') return order.status === 'recibido';
        return false;
      });

      if (isRelevant) {
        const firstOrder = newOrders[0];
        
        // Play Web Audio Chime and audio element fallback
        playOrderChime();
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.log("Audio play blocked", e));
        }

        // Vibrate mobile device
        vibrateDevice([400, 200, 400, 200, 400]);

        // Flash browser tab title so user sees it even in other tabs or apps
        flashTabTitle(`🔔 (1) ¡NUEVO PEDIDO #${firstOrder?.shortId || ''}!`);

        // Send Native Mobile & Desktop Web Push Notification
        sendOrderNotification({
          title: `⚡ ¡NUEVO PEDIDO #${firstOrder?.shortId || ''}!`,
          body: `${firstOrder?.restaurantName || 'Comercio'} - Total: Q${firstOrder?.total?.toFixed(2) || '0.00'}. Haz clic para gestionar.`,
          tag: `rayo-order-${firstOrder?.id || Date.now()}`
        });
        
        toast.custom((t) => (
          <div 
            onClick={() => {
              toast.dismiss(t);
              const targetRoute = user?.role === 'rider' ? '/rider' : (user?.role === 'admin' || user?.role === 'super_admin') ? '/admin' : '/profile';
              navigate(targetRoute);
            }}
            className="bg-[#161619] text-white p-4 rounded-[2rem] shadow-2xl border-2 border-[#FECC01] flex gap-4 items-center cursor-pointer hover:scale-[1.02] transition-transform active:scale-95"
          >
            <div className="w-12 h-12 bg-[#FECC01] rounded-2xl flex items-center justify-center shrink-0">
              <Package className="text-black animate-pulse" size={24} />
            </div>
            <div className="flex-1">
              <p className="font-black italic text-[#FECC01] uppercase text-sm leading-tight">¡NUEVO PEDIDO RAYO! ⚡️</p>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Toca para gestionar ahora</p>
            </div>
            <Button size="sm" variant="ghost" className="rounded-xl font-black italic text-[#FECC01]">VER</Button>
          </div>
        ), { duration: 15000 });
      }
    }
    setLastOrderCount(orders.length);
  }, [orders.length, user, lastOrderCount, navigate]);

  return (
    <audio ref={audioRef} preload="auto">
      <source src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" type="audio/mpeg" />
    </audio>
  );
};

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, user } = useApp();

  const isRayoAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.email?.toLowerCase() === 'emunozberber4@gmail.com' || user?.email?.toLowerCase() === 'emunozberber@gmail.com';
  const isRider = user?.role === 'rider';

  const tabs = [
    { id: 'explore', icon: Home, label: 'Inicio', path: '/explore' },
    { id: 'cart', icon: ShoppingBag, label: 'Carrito', path: '/cart', badge: cart.length },
    ...(isRider ? [{ id: 'rider', icon: Bike, label: 'Repartos', path: '/rider' }] : []),
    ...(isRayoAdmin ? [{ id: 'business', icon: Store, label: 'Negocio', path: '/admin' }] : []),
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

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user } = useApp();
  const isLanding = location.pathname === '/landing' || location.pathname === '/';
  const isAdmin = location.pathname.startsWith('/admin');
  const isRider = location.pathname.startsWith('/rider');

  React.useEffect(() => {
    // Keep dark mode enabled so all dark classes and typography contrast properly
    document.documentElement.classList.add('dark');
  }, [user?.theme]);

  return (
    <div className={`min-h-screen bg-black text-white ${
      isAdmin 
        ? 'max-w-7xl mx-auto px-4 sm:px-6 pb-12 shadow-2xl transition-colors duration-300' 
        : 'max-w-md mx-auto pb-20 relative overflow-x-hidden shadow-2xl border-x border-zinc-900/45 transition-colors duration-300'
    }`}>
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
      {!isLanding && !isAdmin && !isRider && <BottomNav />}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <BackButtonHandler />
        <NotificationListener />
        <MainLayout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/restaurant/:id" element={<RestaurantView />} />
            <Route path="/cart" element={<CartView />} />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/tracking/:id" element={<TrackingView />} />
            <Route path="/rider" element={<RiderApp />} />
            <Route path="/admin" element={<AdminApp />} />
          </Routes>
        </MainLayout>
        <Toaster position="top-center" />
      </BrowserRouter>
    </AppProvider>
  );
}
