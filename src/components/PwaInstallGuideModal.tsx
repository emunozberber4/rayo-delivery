import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Download, 
  Share, 
  PlusSquare, 
  MoreVertical, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  QrCode as QrIcon,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface PwaInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onInstalled?: () => void;
}

export const PwaInstallGuideModal: React.FC<PwaInstallGuideModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstalled
}) => {
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop'>('android');
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showTroubleshooting, setShowTroubleshooting] = useState(true);

  // Determine direct app link
  const appUrl = typeof window !== 'undefined' 
    ? (window.location.origin.includes('localhost') 
        ? window.location.origin 
        : 'https://ais-pre-amgalvnq7drxkcm6k6rjvi-111852729129.us-west2.run.app')
    : 'https://ais-pre-amgalvnq7drxkcm6k6rjvi-111852729129.us-west2.run.app';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        setPlatform('ios');
      } else if (/android/.test(ua)) {
        setPlatform('android');
      } else {
        setPlatform('desktop');
      }

      // Detect if running inside an iframe (like AI Studio preview pane)
      try {
        setIsInIframe(window.self !== window.top);
      } catch (e) {
        setIsInIframe(true);
      }

      const standalone = window.matchMedia('(display-mode: standalone)').matches || 
        (navigator as any).standalone === true;
      setIsStandalone(standalone);

      // Generate QR Code for easy phone scanning
      QRCode.toDataURL(appUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
        .then(setQrCodeUrl)
        .catch(console.error);
    }
  }, [isOpen, appUrl]);

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('¡Instalando Rayo en tu pantalla! ⚡');
          if (onInstalled) onInstalled();
          onClose();
        } else {
          toast.info('Instalación cancelada');
        }
      } catch (err) {
        console.error('Install prompt error', err);
      }
    } else {
      toast.info('Sigue la guía abajo para abrirlo en Chrome');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    toast.success('¡Enlace directo copiado! Pégalo en Google Chrome.');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenDirectly = () => {
    window.open(appUrl, '_blank');
  };

  const handleSendToWhatsApp = () => {
    const text = encodeURIComponent(
      `⚡ *Rayo Delivery - Enlace de Instalación*\n\nAbre este enlace en Google Chrome o Safari para instalar la burbuja en tu pantalla:\n${appUrl}`
    );
    window.open(`https://wa.me/50241070444?text=${text}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[95vw] bg-[#0E0E11] text-white border-2 border-[#FECC01]/40 rounded-[2.5rem] p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-y-auto max-h-[92vh]">
        <DialogHeader className="text-center space-y-2 pb-1">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#FECC01] text-black flex items-center justify-center shadow-[0_0_30px_rgba(254,204,1,0.4)] relative">
            <Smartphone size={28} className="animate-bounce" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-black" />
          </div>
          <DialogTitle className="text-2xl font-black italic tracking-tight text-white uppercase flex items-center justify-center gap-2">
            Instalar Burbuja en Celular 📲
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-300 font-medium px-1">
            Fija la burbuja/ícono de Rayo en la pantalla de inicio de tu teléfono para entrar cuando quieras sin usar la web.
          </DialogDescription>
        </DialogHeader>

        {/* Warning if running inside iframe or webview */}
        {isInIframe && (
          <div className="bg-amber-950/50 border-2 border-amber-500/50 p-3.5 rounded-2xl space-y-2 text-amber-200 text-xs">
            <div className="flex items-center gap-2 font-black uppercase text-amber-400">
              <AlertTriangle size={18} className="shrink-0 text-amber-400" />
              <span>¿Por qué no te aparece en los 3 puntos?</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-200">
              Actualmente estás viendo la aplicación dentro de la <b>vista previa integrada</b>. Los navegadores móviles como Chrome <b>solo muestran la opción de instalar</b> cuando abres la web directamente en una pestaña real de Chrome.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleOpenDirectly}
                className="flex-1 bg-[#FECC01] hover:bg-[#FECC01]/90 text-black font-black uppercase text-[10px] h-9 rounded-xl flex items-center justify-center gap-1.5 shadow"
              >
                <ExternalLink size={14} />
                Abrir en Chrome Directo
              </Button>
              <Button
                onClick={handleSendToWhatsApp}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase text-[10px] h-9 rounded-xl px-2.5 flex items-center justify-center gap-1"
              >
                <MessageCircle size={14} />
                Enviar a WhatsApp
              </Button>
            </div>
          </div>
        )}

        {/* Direct One-Click Install Button if Android Chrome already emitted event */}
        {deferredPrompt && (
          <div className="my-1 p-3 bg-gradient-to-r from-[#FECC01]/25 via-zinc-900 to-zinc-900 border border-[#FECC01]/60 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#FECC01]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#FECC01]">
                Instalación Automática Detectada
              </span>
            </div>
            <Button
              onClick={handleNativeInstall}
              className="w-full bg-[#FECC01] hover:bg-[#FECC01]/90 text-black font-black uppercase tracking-wider text-xs h-11 rounded-xl shadow-lg shadow-[#FECC01]/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Agregar a Mi Pantalla con 1 Toque
            </Button>
          </div>
        )}

        {/* Platform switcher tab */}
        <div className="flex bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800 gap-1 my-1">
          <button
            onClick={() => setPlatform('android')}
            className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
              platform === 'android'
                ? 'bg-[#FECC01] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            🤖 Android
          </button>
          
          <button
            onClick={() => setPlatform('ios')}
            className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
              platform === 'ios'
                ? 'bg-[#FECC01] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            🍎 iPhone
          </button>

          <button
            onClick={() => setPlatform('desktop')}
            className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
              platform === 'desktop'
                ? 'bg-[#FECC01] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            📸 Código QR
          </button>
        </div>

        {/* Instructions by Platform */}
        <div className="space-y-2.5 text-xs">
          {platform === 'android' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-black text-xs text-[#FECC01] uppercase tracking-wide">
                  En tu celular Android (Google Chrome):
                </p>
                <Badge className="bg-zinc-800 text-zinc-300 text-[9px]">Paso a Paso</Badge>
              </div>

              {/* Step 1 */}
              <div className="flex items-start gap-3 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                <div className="w-6 h-6 rounded-full bg-[#FECC01] text-black font-black flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-200 font-bold">
                    Abre el enlace directo en Google Chrome:
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Asegúrate de no estar dentro de WhatsApp Web ni en una app secundaria. Toca el botón abajo para abrirlo directo en Chrome:
                  </p>
                  <div className="pt-1 flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleOpenDirectly}
                      className="bg-[#FECC01] hover:bg-[#FECC01]/90 text-black font-black text-[10px] h-8 rounded-lg"
                    >
                      Abrir en Chrome
                      <ExternalLink size={12} className="ml-1" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyLink}
                      className="border-zinc-700 bg-zinc-900 text-white font-bold text-[10px] h-8 rounded-lg"
                    >
                      {copied ? <Check size={12} className="text-green-400 mr-1" /> : <Copy size={12} className="mr-1" />}
                      {copied ? 'Copiado' : 'Copiar Enlace'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                <div className="w-6 h-6 rounded-full bg-[#FECC01] text-black font-black flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div className="space-y-1.5">
                  <p className="text-zinc-200 font-bold">
                    Toca los tres puntos (⋮) en la esquina superior derecha de Chrome.
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    En el menú desplegable, busca y selecciona:
                  </p>
                  <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-700/80 space-y-1">
                    <p className="font-black text-white text-[11px] flex items-center gap-1.5">
                      <Download size={14} className="text-[#FECC01]" />
                      "Instalar aplicación"
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      (En algunos teléfonos se llama: <span className="text-zinc-200 font-bold">"Agregar a la pantalla principal"</span> o <span className="text-zinc-200 font-bold">"Añadir a inicio"</span>)
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                <div className="w-6 h-6 rounded-full bg-[#FECC01] text-black font-black flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <p className="text-zinc-200 font-medium text-[11px]">
                  Presiona <b>"Instalar"</b> o <b>"Agregar"</b>. El ícono con el rayo de Rayo Delivery se creará en tu pantalla principal como una app de Play Store.
                </p>
              </div>

              {/* Phone brand specific notes */}
              <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800 text-[11px] space-y-1 text-zinc-300">
                <p className="font-black text-zinc-400 uppercase text-[10px]">
                  📌 Si usas otro navegador en Android:
                </p>
                <p>• <b>Samsung Internet:</b> Toca las tres rayitas (☰) abajo a la derecha → <b>"Agregar página a"</b> → <b>"Pantalla de inicio"</b>.</p>
                <p>• <b>Xiaomi / Redmi:</b> Toca el menú → <b>"Añadir a pantalla de inicio"</b>.</p>
              </div>
            </div>
          )}

          {platform === 'ios' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <p className="font-black text-xs text-[#FECC01] uppercase tracking-wide">
                En iPhone o iPad (Safari):
              </p>
              <div className="flex items-start gap-3 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                <div className="w-6 h-6 rounded-full bg-[#FECC01] text-black font-black flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <p className="text-zinc-200 font-medium">
                  Abre esta página en el navegador <b>Safari</b>. Toca el botón <b>Compartir</b> <Share size={14} className="inline text-[#FECC01]" /> (el ícono del cuadrado con la flecha hacia arriba en la barra inferior).
                </p>
              </div>
              <div className="flex items-start gap-3 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                <div className="w-6 h-6 rounded-full bg-[#FECC01] text-black font-black flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <p className="text-zinc-200 font-medium">
                  Desliza hacia abajo y presiona <b className="text-white bg-zinc-800 px-2 py-0.5 rounded-lg border border-zinc-700 inline-flex items-center gap-1"><PlusSquare size={13} /> Agregar al inicio</b>.
                </p>
              </div>
              <div className="flex items-start gap-3 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                <div className="w-6 h-6 rounded-full bg-[#FECC01] text-black font-black flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <p className="text-zinc-200 font-medium">
                  Toca <b>"Agregar"</b> en la esquina superior derecha.
                </p>
              </div>
            </div>
          )}

          {platform === 'desktop' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2.5">
              <p className="font-black text-xs text-[#FECC01] uppercase tracking-wide">
                Escanear con tu Teléfono 📸
              </p>
              <p className="text-[11px] text-zinc-300">
                Abre la cámara de tu celular y apunta al código QR para abrir Rayo directamente en tu navegador móvil:
              </p>
              {qrCodeUrl && (
                <div className="bg-white p-3 rounded-2xl border-2 border-[#FECC01] shadow-lg">
                  <img src={qrCodeUrl} alt="QR Rayo" className="w-44 h-44 rounded-lg block" />
                </div>
              )}
              <Button
                onClick={handleCopyLink}
                size="sm"
                variant="outline"
                className="border-zinc-700 bg-zinc-800 text-xs text-white font-bold rounded-xl"
              >
                {copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}
              </Button>
            </div>
          )}
        </div>

        {/* WhatsApp Quick Dispatch Option */}
        <div className="bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <MessageCircle size={18} />
            </div>
            <div>
              <p className="font-black text-white text-[11px]">¿Quieres recibir el link por WhatsApp?</p>
              <p className="text-[10px] text-emerald-400">Te enviamos el enlace directo a tu número</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSendToWhatsApp}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-[10px] h-8 rounded-xl shrink-0"
          >
            Enviar Link
          </Button>
        </div>

        <div className="pt-1">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl h-10 text-xs"
          >
            Entendido, cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
