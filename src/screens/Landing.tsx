import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, ShoppingBag, Bike, Store, Shield, Zap, Scan, Mail, Lock, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/store';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { AuthModal } from '@/components/AuthModal';

const Landing = () => {
  const navigate = useNavigate();
  const { user, login, applyAsRider, updateUser } = useApp();
  const [location, setLocation] = React.useState('Coatepeque, Quetzaltenango');
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [authDefaultMode, setAuthDefaultMode] = React.useState<'login' | 'register'>('login');

  const storedUserRaw = typeof window !== 'undefined' ? localStorage.getItem('rayo_active_user') : null;
  const isAlreadyLoggedIn = Boolean((user && user.isLoggedIn) || storedUserRaw);

  React.useEffect(() => {
    let hasStoredSession = false;
    try {
      if (storedUserRaw) {
        const parsed = JSON.parse(storedUserRaw);
        if (parsed?.isLoggedIn !== false && (parsed?.uid || parsed?.email)) {
          hasStoredSession = true;
        }
      }
    } catch {}

    if ((user && user.isLoggedIn) || hasStoredSession) {
      // If signed in, never stay on landing screen or ask to log in again on back navigation
      navigate('/explore', { replace: true });
    }
  }, [user, navigate, storedUserRaw]);

  if (isAlreadyLoggedIn) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-[#FECC01] border-t-transparent animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-[#FECC01]">Entrando a Rayo Delivery...</p>
        </div>
      </div>
    );
  }

  const openAuth = (mode: 'login' | 'register') => {
    setAuthDefaultMode(mode);
    setShowAuthModal(true);
  };

  const handleStart = async () => {
    if (!user) {
      openAuth('login');
    } else {
      navigate('/explore');
    }
  };

  const handleRoleSelect = async (role: 'client' | 'rider' | 'admin') => {
    if (!user) {
      openAuth('login');
      return;
    }
    
    if (role === 'rider') {
      await applyAsRider();
    } else if (role === 'admin') {
      await updateUser({ role: 'admin' });
      toast.success("Rol Comerciante registrado");
    } else {
      await updateUser({ role: 'client' });
    }
    navigate('/explore');
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col justify-between items-center px-6 py-12 relative overflow-hidden">
      {/* Background neon blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[320px] h-[320px] bg-[#FECC01]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-20%] w-[350px] h-[350px] bg-[#FECC01]/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Brand Tagline */}
      <div className="w-full flex flex-col items-center gap-6 mt-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="flex flex-col items-center gap-1"
        >
          {/* Glowing Golden Lightning Logo */}
          <div className="relative flex items-center justify-center w-24 h-24 mb-4 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-300 shadow-[0_0_30px_rgba(254,204,1,0.4)] border border-yellow-400">
            <Zap size={56} className="text-black fill-black animate-pulse" />
          </div>
          <h1 className="text-5xl font-black tracking-tight text-center leading-none">
            RAYO
            <span className="block text-[#FECC01] text-4xl mt-1 tracking-[0.2em] font-extrabold italic">DELIVERY</span>
          </h1>
          <p className="text-[10px] font-black tracking-[0.25em] text-zinc-400 text-center uppercase mt-3 px-4 leading-relaxed">
            RÁPIDO, FÁCIL Y DIRECTO<br />HASTA TU PUERTA ⚡️
          </p>
        </motion.div>

        {/* Location selector */}
        <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-zinc-805 text-zinc-300 text-xs font-semibold shadow-inner mt-2 shrink-0">
          <MapPin size={14} className="text-[#FECC01]" />
          <span>{location}</span>
          <span className="text-[10px] text-emerald-500 animate-pulse">●</span>
          <span className="text-[9px] text-zinc-500 font-bold uppercase">Detectando...</span>
        </div>
      </div>

      {/* Action Area */}
      <div className="w-full flex flex-col gap-5 mt-8 relative z-10 max-w-sm">
        <div className="flex flex-col gap-2.5">
          {/* Email & Password Login / Register Button */}
          <Button
            onClick={() => openAuth('login')}
            className="w-full h-14 bg-[#FECC01] hover:bg-[#ebd534] text-black rounded-[1.5rem] font-bold text-sm flex items-center justify-between px-6 shadow-[0_4px_25px_rgba(254,204,1,0.3)] active:scale-98 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-black text-[#FECC01] flex items-center justify-center">
                <Scan size={18} />
              </div>
              <div className="text-left">
                <span className="font-black italic uppercase tracking-wider block text-xs leading-none">
                  ENTRAR / ESCANEAR ROSTRO
                </span>
                <span className="text-[9px] font-bold text-zinc-900 tracking-tight">
                  Correo + Contraseña + Face ID
                </span>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
          </Button>

          <div className="grid grid-cols-2 gap-2">
            {/* Create Account Button */}
            <button
              onClick={() => openAuth('register')}
              className="h-12 bg-zinc-900/90 hover:bg-zinc-800 text-white rounded-2xl border border-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
            >
              <UserPlus size={15} className="text-[#FECC01]" />
              <span>Crear Cuenta</span>
            </button>

            {/* Google Connection Button */}
            <button
              onClick={handleStart}
              className="h-12 bg-zinc-900/90 hover:bg-zinc-800 text-white rounded-2xl border border-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.227C18.23 1.765 15.42 1 12.24 1 5.48 1 0 6.48 0 13.24s5.48 12.24 12.24 12.24c7.05 0 11.72-4.96 11.72-11.93 0-.8-.09-1.41-.2-1.93H12.24z"
                />
              </svg>
              <span>Google</span>
            </button>
          </div>

          {/* Golden Order Button Direct */}
          <Button
            onClick={() => handleRoleSelect('client')}
            variant="outline"
            className="w-full h-11 border-zinc-800 bg-black/60 hover:bg-zinc-900 text-zinc-300 hover:text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2"
          >
            <span>Explorar Restaurantes y Menú</span>
            <ChevronRight size={14} />
          </Button>
        </div>

        {/* Security Face ID Badge */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-2.5 flex items-center justify-center gap-2 text-[10px] text-zinc-400 font-semibold">
          <Shield size={14} className="text-emerald-400" />
          <span>Seguridad con Escaneo Facial Biométrico Activo</span>
        </div>

        {/* Roles Widget */}
        <div className="mt-4">
          <p className="text-[10px] text-center font-bold text-zinc-500 uppercase tracking-widest mb-4">
            ¿Nuevo en Rayo Delivery? Elige una opción:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Cliente */}
            <div
              onClick={() => handleRoleSelect('client')}
              className="bg-zinc-900 hover:bg-zinc-850 p-4 rounded-3xl border border-zinc-800 hover:border-[#FECC01]/40 transition-all cursor-pointer group active:scale-95"
            >
              <div className="w-9 h-9 bg-zinc-800 rounded-2xl flex items-center justify-center mb-2.5 text-[#FECC01]">
                <ShoppingBag size={18} />
              </div>
              <h3 className="text-xs font-black uppercase text-zinc-100 group-hover:text-[#FECC01]">CLIENTE</h3>
              <p className="text-[9px] text-zinc-500 font-medium leading-snug mt-1">
                Pide comida en los mejores restaurantes
              </p>
            </div>

            {/* Repartidor */}
            <div
              onClick={() => handleRoleSelect('rider')}
              className="bg-zinc-900 hover:bg-zinc-850 p-4 rounded-3xl border border-zinc-800 hover:border-[#FECC01]/40 transition-all cursor-pointer group active:scale-95"
            >
              <div className="w-9 h-9 bg-zinc-800 rounded-2xl flex items-center justify-center mb-2.5 text-[#FECC01]">
                <Bike size={18} />
              </div>
              <h3 className="text-xs font-black uppercase text-zinc-100 group-hover:text-[#FECC01]">REPARTIDOR</h3>
              <p className="text-[9px] text-zinc-500 font-medium leading-snug mt-1">
                Únete a nuestra flota de repartidores
              </p>
            </div>

            {/* Comercio */}
            <div
              onClick={() => handleRoleSelect('admin')}
              className="bg-zinc-900 hover:bg-zinc-850 p-4 rounded-3xl border border-zinc-800 hover:border-[#FECC01]/40 transition-all cursor-pointer group active:scale-95"
            >
              <div className="w-9 h-9 bg-zinc-800 rounded-2xl flex items-center justify-center mb-2.5 text-[#FECC01]">
                <Store size={18} />
              </div>
              <h3 className="text-xs font-black uppercase text-zinc-100 group-hover:text-[#FECC01]">COMERCIO</h3>
              <p className="text-[9px] text-zinc-500 font-medium leading-snug mt-1">
                Vende tus productos en Rayo Delivery
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer License */}
      <div className="w-full text-center mt-12 relative z-10 max-w-sm">
        <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">
          Al continuar, aceptas nuestros<br />
          <span className="text-zinc-400 hover:underline cursor-pointer">Términos y Condiciones</span> y <span className="text-zinc-400 hover:underline cursor-pointer">Política de Privacidad</span>
        </p>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authDefaultMode}
        onSuccess={() => navigate('/explore')}
      />
    </div>
  );
};

export default Landing;
