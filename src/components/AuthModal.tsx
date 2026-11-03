import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Phone, 
  Scan, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ShieldCheck, 
  Zap,
  LogIn,
  UserPlus
} from 'lucide-react';
import { useApp } from '@/store';
import { toast } from 'sonner';
import { FaceScanModal } from './FaceScanModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login',
  onSuccess
}) => {
  const { login, loginWithEmail, registerWithEmail, saveFaceVerification } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Face scanner sub-step state
  const [showFaceScan, setShowFaceScan] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ uid: string; name: string; email: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Por favor ingresa tu correo y contraseña');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      toast.error('Por favor ingresa tu nombre completo');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const user = await loginWithEmail(email, password);
        toast.success(`Credenciales verificadas para ${user.email} ⚡️`);
        setPendingUser({
          uid: user.uid,
          name: user.displayName || name || 'Usuario',
          email: user.email || email
        });
        // Open mandatory face scan step
        setShowFaceScan(true);
      } else {
        const user = await registerWithEmail(email, password, name, phone);
        toast.success(`¡Cuenta creada exitosamente! ⚡️`);
        setPendingUser({
          uid: user.uid,
          name: name.trim(),
          email: user.email || email
        });
        // Open mandatory face scan step
        setShowFaceScan(true);
      }
    } catch (err: any) {
      if (err?.code !== 'auth/operation-not-allowed' && !err?.message?.includes('operation-not-allowed')) {
        console.warn('Auth issue:', err);
      }
      let msg = 'Error en la autenticación';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Correo o contraseña incorrectos.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Este correo ya tiene una cuenta registrada. Intenta iniciar sesión.';
        setMode('login');
      } else if (err.code === 'auth/weak-password') {
        msg = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'El formato del correo electrónico no es válido.';
      } else if (err?.message) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await login();
      toast.success('¡Autenticado con Google! Ahora verifica tu rostro 🛡️');
      setShowFaceScan(true);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error('No se pudo iniciar sesión con Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceScanSuccess = async (photoDataUrl: string) => {
    try {
      await saveFaceVerification(photoDataUrl);
      setShowFaceScan(false);
      onClose();
      if (onSuccess) onSuccess();
      toast.success('¡Identidad y rostro verificados! Bienvenido a Rayo Delivery ⚡️');
    } catch (err) {
      console.warn('Face save notice:', err);
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showFaceScan} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md w-[95vw] bg-[#0E0E11] text-white border-2 border-[#FECC01]/50 rounded-[2.5rem] p-5 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.95)] max-h-[92vh] overflow-y-auto">
          <DialogHeader className="text-center space-y-1.5 pb-1">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FECC01] text-black flex items-center justify-center font-black shadow-[0_0_25px_rgba(254,204,1,0.35)]">
              <Zap size={26} className="fill-black" />
            </div>

            <DialogTitle className="text-2xl font-black italic tracking-tight text-white uppercase">
              {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </DialogTitle>

            <DialogDescription className="text-xs text-zinc-400 font-medium px-2">
              {mode === 'login' 
                ? 'Ingresa tu correo y contraseña. A continuación se te pedirá un escaneo facial de seguridad.'
                : 'Crea tu cuenta de Rayo Delivery con escaneo facial biométrico obligatorio.'}
            </DialogDescription>
          </DialogHeader>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 gap-1 my-2">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                mode === 'login'
                  ? 'bg-[#FECC01] text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LogIn size={14} />
              Ya tengo cuenta
            </button>

            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                mode === 'register'
                  ? 'bg-[#FECC01] text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UserPlus size={14} />
              Crear Cuenta
            </button>
          </div>

          {/* Biometric notice banner */}
          <div className="bg-[#FECC01]/10 border border-[#FECC01]/30 rounded-2xl p-3 flex items-center gap-2.5 text-[11px] text-zinc-300">
            <div className="w-7 h-7 rounded-xl bg-[#FECC01]/20 text-[#FECC01] flex items-center justify-center shrink-0">
              <Scan size={16} />
            </div>
            <p className="leading-snug">
              <b>Escaneo de Rostro Requerido:</b> Al ingresar tus datos, se activará la cámara para verificar tu identidad en tiempo real.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            {mode === 'register' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 pl-1">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <UserIcon size={16} className="absolute left-3.5 top-3.5 text-[#FECC01]" />
                    <Input
                      type="text"
                      placeholder="Ej. Juan Carlos Pérez"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="bg-zinc-900 border-zinc-750 text-white placeholder:text-zinc-400 pl-10 h-11 rounded-xl text-xs font-bold focus:border-[#FECC01]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 pl-1">
                    Teléfono / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-3.5 text-[#FECC01]" />
                    <Input
                      type="tel"
                      placeholder="Ej. 41070444"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-zinc-900 border-zinc-750 text-white placeholder:text-zinc-400 pl-10 h-11 rounded-xl text-xs font-bold focus:border-[#FECC01]"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 pl-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-[#FECC01]" />
                <Input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-zinc-900 border-zinc-750 text-white placeholder:text-zinc-400 pl-10 h-11 rounded-xl text-xs font-bold focus:border-[#FECC01]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 pl-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-[#FECC01]" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-zinc-900 border-zinc-750 text-white placeholder:text-zinc-400 pl-10 pr-10 h-11 rounded-xl text-xs font-bold focus:border-[#FECC01]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-zinc-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FECC01] hover:bg-[#FECC01]/90 text-black font-black uppercase tracking-wider text-xs h-12 rounded-2xl shadow-lg shadow-[#FECC01]/30 active:scale-95 transition-all mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Procesando...</span>
              ) : (
                <>
                  <Scan size={18} />
                  <span>Continuar a Escaneo Facial</span>
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-2 my-2 text-zinc-400 text-[10px] font-black uppercase tracking-wider">
            <div className="flex-1 h-px bg-zinc-800" />
            <span>O también</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-11 bg-zinc-900 hover:bg-zinc-850 text-white rounded-2xl border border-zinc-800 font-bold text-xs flex items-center justify-center gap-2.5 shadow active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.227C18.23 1.765 15.42 1 12.24 1 5.48 1 0 6.48 0 13.24s5.48 12.24 12.24 12.24c7.05 0 11.72-4.96 11.72-11.93 0-.8-.09-1.41-.2-1.93H12.24z"
              />
            </svg>
            <span>Acceder con Google</span>
          </button>

          {/* Quick Access helper for Rayo Burguer */}
          <div className="pt-2">
            <p className="text-[10px] font-black uppercase text-zinc-400 text-center mb-1.5 tracking-wider">
              Acceso Rápido Rayo Burguer ⚡
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('emunozberber4@gmail.com');
                  setPassword('rayoburguer123');
                  setMode('login');
                }}
                className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-black text-[#FECC01] rounded-xl border border-zinc-800 transition-all text-center truncate"
                title="emunozberber4@gmail.com"
              >
                🍔 Rayo Burguer 4
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('emunozberber@gmail.com');
                  setPassword('rayoburguer123');
                  setMode('login');
                }}
                className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-black text-[#FECC01] rounded-xl border border-zinc-800 transition-all text-center truncate"
                title="emunozberber@gmail.com"
              >
                ⚡ Rayo Burguer Admin
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mandatory Facial Scanner Modal Step */}
      <FaceScanModal
        isOpen={showFaceScan}
        onClose={() => {
          setShowFaceScan(false);
          onClose();
        }}
        onSuccess={handleFaceScanSuccess}
        userName={pendingUser?.name || name || 'Usuario'}
        userEmail={pendingUser?.email || email}
        isMandatory={true}
      />
    </>
  );
};
