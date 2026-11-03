import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/store';
import { 
  Zap, 
  Smartphone, 
  MessageCircle, 
  Bell, 
  Volume2, 
  VolumeX, 
  X, 
  Maximize2, 
  Minimize2, 
  ArrowRight,
  PackageCheck,
  ChevronRight,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PwaInstallGuideModal } from './PwaInstallGuideModal';

export const FloatingBubbleWidget: React.FC = () => {
  const { orders, user, cart, centralWhatsApp } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [positionSide, setPositionSide] = useState<'right' | 'left'>('right');

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (typeof window !== 'undefined') {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || 
        (navigator as any).standalone === true;
      setIsStandalone(standalone);

      if ('Notification' in window) {
        setNotificationsGranted(Notification.permission === 'granted');
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Find relevant active orders
  const activeOrders = orders.filter(o => {
    if (user?.role === 'rider') {
      return (o.riderId === user.uid || o.riderId === 'SYSTEM') && o.status !== 'entregado' && o.status !== 'cancelado';
    }
    if (user?.role === 'admin') {
      return o.restaurantId === user.restaurantId && o.status !== 'entregado' && o.status !== 'cancelado';
    }
    if (user?.role === 'super_admin') {
      return o.status !== 'entregado' && o.status !== 'cancelado';
    }
    return (o.userId === user?.uid || !user) && o.status !== 'entregado' && o.status !== 'cancelado';
  });

  const latestOrder = activeOrders[0];
  const badgeCount = activeOrders.length || (cart.length > 0 ? cart.length : 0);

  // Sound test
  const playSampleSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Sound test prevented', e));
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      toast.success('Sonido de alerta probado con éxito 🔔');
    } catch (e) {
      toast.error('No se pudo reproducir audio');
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Tu navegador no soporta notificaciones de sistema');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsGranted(true);
        new Notification('⚡ ¡Burbuja Rayo Activa!', {
          body: 'Recibirás avisos de nuevos pedidos y entregas en tu teléfono.',
          icon: '/pwa-192x192.png',
          badge: '/favicon.png'
        });
        toast.success('¡Notificaciones activadas en tu pantalla! 📲');
      } else {
        toast.error('Permiso denegado por el navegador');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error solicitando permisos de notificación');
    }
  };

  const handleOpenWhatsApp = () => {
    const phone = centralWhatsApp.replace(/\D/g, '') || '50241070444';
    const text = encodeURIComponent('¡Hola Central Rayo! Necesito asistencia con la aplicación o pedidos.');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // If minimized to a small tab
  if (isMinimized) {
    return (
      <div 
        className={`fixed bottom-24 ${positionSide === 'right' ? 'right-0' : 'left-0'} z-50`}
      >
        <button
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-1 bg-black/90 hover:bg-black text-[#FECC01] border-2 border-[#FECC01] py-1.5 px-2.5 shadow-2xl backdrop-blur-md transition-all active:scale-95 ${
            positionSide === 'right' 
              ? 'rounded-l-2xl border-r-0 pl-3' 
              : 'rounded-r-2xl border-l-0 pr-3'
          }`}
          title="Abrir Burbuja Rayo"
        >
          <Zap size={18} className="fill-[#FECC01] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider">Burbuja</span>
          {badgeCount > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          )}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Floating Trigger Bubble */}
      <div 
        className={`fixed bottom-20 sm:bottom-24 ${positionSide === 'right' ? 'right-4' : 'left-4'} z-40`}
      >
        <div className="relative group">
          {/* Subtle pulse ring around bubble */}
          <div className="absolute -inset-1.5 bg-[#FECC01]/30 rounded-full blur-sm group-hover:bg-[#FECC01]/50 transition-all animate-pulse" />

          <button
            onClick={() => setIsOpen(true)}
            aria-label="Abrir Burbuja Rayo"
            className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-black border-2 border-[#FECC01] flex flex-col items-center justify-center text-[#FECC01] shadow-[0_8px_25px_rgba(254,204,1,0.35)] hover:scale-105 active:scale-90 transition-transform cursor-pointer"
          >
            <Zap size={24} className="fill-[#FECC01] filter drop-shadow-[0_2px_8px_rgba(254,204,1,0.6)]" />
            <span className="text-[8px] font-black uppercase tracking-tighter text-white -mt-0.5">
              RAYO
            </span>

            {/* Notification badge */}
            {badgeCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black rounded-full h-5 min-w-5 px-1 border-2 border-black flex items-center justify-center shadow-lg animate-bounce">
                {badgeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Floating Panel (Sheet/Modal) */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-[#0E0E11] text-white border-t-2 sm:border-2 border-[#FECC01]/50 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-5 shadow-[0_-15px_50px_rgba(0,0,0,0.9)] max-h-[85vh] overflow-y-auto space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FECC01] text-black flex items-center justify-center font-black shadow-md shadow-[#FECC01]/30">
                    <Zap size={20} className="fill-black" />
                  </div>
                  <div>
                    <h3 className="font-black italic text-base uppercase text-white leading-none">
                      Burbuja Rayo ⚡
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      Control & Acceso Rápido
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setIsMinimized(true);
                      setIsOpen(false);
                      toast.info('Burbuja minimizada al borde de la pantalla');
                    }}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-[10px] font-bold"
                    title="Minimizar a la orilla"
                  >
                    <Minimize2 size={15} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Install PWA Prompt Banner */}
              <div className="bg-gradient-to-r from-[#FECC01]/25 via-zinc-900 to-zinc-900 border border-[#FECC01]/50 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone size={18} className="text-[#FECC01]" />
                    <span className="text-xs font-black uppercase text-[#FECC01] tracking-wider">
                      Burbuja en Pantalla de Inicio
                    </span>
                  </div>
                  {isStandalone ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] font-black">
                      INSTALADA
                    </Badge>
                  ) : (
                    <Badge className="bg-[#FECC01]/20 text-[#FECC01] border-[#FECC01]/30 text-[9px] font-black">
                      DISPONIBLE
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-zinc-300 font-medium leading-relaxed">
                  {isStandalone 
                    ? '¡Ya tienes Rayo instalado en tu celular! Puedes abrirlo directamente desde tu pantalla de inicio.'
                    : 'Deja el ícono/burbuja de Rayo en la pantalla de tu celular para entrar cuando quieras sin abrir el navegador.'}
                </p>

                <Button
                  onClick={() => setShowInstallGuide(true)}
                  className="w-full bg-[#FECC01] hover:bg-[#FECC01]/90 text-black font-black uppercase tracking-wider text-xs h-10 rounded-xl shadow-md shadow-[#FECC01]/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Sparkles size={14} />
                  {isStandalone ? 'Ver Configuración de Burbuja' : '📲 Poner Burbuja en Teléfono'}
                </Button>

                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = 'https://ais-pre-amgalvnq7drxkcm6k6rjvi-111852729129.us-west2.run.app';
                      window.open(url, '_blank');
                    }}
                    className="border-zinc-700 hover:border-zinc-500 bg-zinc-900 text-white font-bold text-[10px] h-8 rounded-lg flex items-center justify-center gap-1"
                  >
                    <ExternalLink size={12} className="text-[#FECC01]" />
                    Abrir en Chrome
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = 'https://ais-pre-amgalvnq7drxkcm6k6rjvi-111852729129.us-west2.run.app';
                      const text = encodeURIComponent(`⚡ Enlace para instalar Rayo Delivery en tu celular:\n${url}`);
                      window.open(`https://wa.me/50241070444?text=${text}`, '_blank');
                    }}
                    className="border-emerald-500/50 hover:border-emerald-400 bg-emerald-950/40 text-emerald-300 font-bold text-[10px] h-8 rounded-lg flex items-center justify-center gap-1"
                  >
                    <MessageCircle size={12} className="text-emerald-400" />
                    Enviar a mi WA
                  </Button>
                </div>
              </div>

              {/* Live Order Status Section */}
              {latestOrder ? (
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                      <PackageCheck size={13} className="text-[#FECC01]" />
                      Pedido en Curso
                    </span>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-black uppercase">
                      {latestOrder.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div>
                      <p className="font-black text-white">{latestOrder.restaurantName || 'Comercio Rayo'}</p>
                      <p className="text-[10px] text-zinc-400">Total: Q{(latestOrder.total || 0).toFixed(2)}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsOpen(false);
                        navigate(`/tracking/${latestOrder.id}`);
                      }}
                      className="bg-white hover:bg-zinc-200 text-black font-black uppercase text-[10px] h-8 rounded-lg"
                    >
                      Rastrear
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* WhatsApp Central Action */}
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <MessageCircle size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-emerald-300">WhatsApp Central</p>
                    <p className="text-[10px] text-emerald-400/80 font-mono font-bold">+502 41070444</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleOpenWhatsApp}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase h-8 rounded-lg px-3"
                >
                  Contactar
                </Button>
              </div>

              {/* Sound & System Notification Controls */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={playSampleSound}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-colors group"
                >
                  <Volume2 size={18} className="text-[#FECC01] group-hover:scale-110 transition-transform" />
                  <span className="font-black text-[10px] uppercase text-zinc-200">Probar Alerta</span>
                  <span className="text-[9px] text-zinc-500">Tocar para escuchar</span>
                </button>

                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-colors group"
                >
                  <Bell size={18} className={notificationsGranted ? 'text-emerald-400' : 'text-[#FECC01]'} />
                  <span className="font-black text-[10px] uppercase text-zinc-200">
                    {notificationsGranted ? 'Avisos Activos' : 'Activar Avisos'}
                  </span>
                  <span className="text-[9px] text-zinc-500">
                    {notificationsGranted ? 'En tu pantalla' : 'Permitir al celular'}
                  </span>
                </button>
              </div>

              {/* Position and Fullscreen options */}
              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setPositionSide(prev => prev === 'right' ? 'left' : 'right')}
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>Mover a la:</span>
                  <span className="font-bold text-white uppercase">{positionSide === 'right' ? 'Izquierda' : 'Derecha'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <Maximize2 size={12} />
                  <span>Pantalla Completa</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Install Guide Modal */}
      <PwaInstallGuideModal
        isOpen={showInstallGuide}
        onClose={() => setShowInstallGuide(false)}
        deferredPrompt={deferredPrompt}
        onInstalled={() => {
          setIsStandalone(true);
          setDeferredPrompt(null);
        }}
      />
    </>
  );
};
