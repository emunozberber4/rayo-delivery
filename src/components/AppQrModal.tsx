import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  QrCode, 
  Download, 
  Copy, 
  Share2, 
  Printer, 
  ExternalLink, 
  Store, 
  Smartphone, 
  Check, 
  Sparkles,
  UtensilsCrossed
} from 'lucide-react';
import { Restaurant } from '@/types';

interface AppQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'app' | 'restaurant' | 'table';
  currentRestaurant?: Restaurant | null;
  restaurants?: Restaurant[];
}

export const AppQrModal: React.FC<AppQrModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'app',
  currentRestaurant,
  restaurants = []
}) => {
  const [activeTab, setActiveTab] = useState<'app' | 'restaurant' | 'table'>(defaultTab);
  const [selectedRestId, setSelectedRestId] = useState<string>(
    currentRestaurant?.id || (restaurants[0]?.id || '')
  );
  const [tableNumber, setTableNumber] = useState('1');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync default rest when modal opens or rest changes
  useEffect(() => {
    if (currentRestaurant?.id) {
      setSelectedRestId(currentRestaurant.id);
    } else if (restaurants.length > 0 && !selectedRestId) {
      setSelectedRestId(restaurants[0].id);
    }
  }, [currentRestaurant, restaurants, isOpen]);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, isOpen]);

  // Compute the target URL to encode
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rayodelivery.com';
  
  let targetUrl = baseUrl;
  let qrTitle = 'Entrar a Rayo Delivery ⚡';
  let qrSubtitle = 'Escanea con la cámara de tu teléfono para entrar a la app y ordenar';

  const selectedRest = restaurants.find(r => r.id === selectedRestId) || currentRestaurant;

  if (activeTab === 'restaurant') {
    if (selectedRest) {
      targetUrl = `${baseUrl}/restaurant/${selectedRest.id}`;
      qrTitle = `Menú de ${selectedRest.name}`;
      qrSubtitle = 'Escanea para ver nuestro menú y ordenar al instante';
    } else {
      targetUrl = baseUrl;
    }
  } else if (activeTab === 'table') {
    if (selectedRest) {
      const tableParam = encodeURIComponent(tableNumber.trim() || '1');
      targetUrl = `${baseUrl}/restaurant/${selectedRest.id}?mesa=${tableParam}`;
      qrTitle = `${selectedRest.name} - Mesa ${tableNumber || '1'}`;
      qrSubtitle = `Escanea para pedir directo desde la Mesa ${tableNumber || '1'}`;
    }
  }

  // Generate QR Code
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    QRCode.toDataURL(targetUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating QR', err);
      });

    return () => {
      isMounted = false;
    };
  }, [targetUrl, isOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    toast.success('¡Enlace copiado al portapapeles!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    const filename = activeTab === 'app' 
      ? 'rayo-delivery-qr.png' 
      : `qr-${(selectedRest?.name || 'comercio').toLowerCase().replace(/\s+/g, '-')}${activeTab === 'table' ? `-mesa-${tableNumber}` : ''}.png`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Código QR descargado en alta calidad 📥');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: qrTitle,
          text: qrSubtitle,
          url: targetUrl
        });
        toast.success('¡Compartido con éxito!');
      } catch (e) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  const handlePrintFlyer = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Habilita los popups para imprimir el cartel');
      return;
    }

    const businessName = selectedRest?.name || 'Rayo Delivery';
    const subText = activeTab === 'table' 
      ? `Mesa: ${tableNumber}` 
      : activeTab === 'restaurant' 
      ? '¡Pide en línea fácil y rápido!' 
      : '¡Pide tu comida favorita al instante!';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cartel QR - ${businessName}</title>
          <style>
            @page {
              size: A5 portrait;
              margin: 10mm;
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 24px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              text-align: center;
              color: #111;
              background: #fff;
            }
            .card {
              border: 3px solid #111;
              border-radius: 28px;
              padding: 36px 28px;
              max-width: 420px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.06);
            }
            .badge {
              background: #FECC01;
              color: #000;
              font-weight: 900;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 2px;
              padding: 6px 16px;
              border-radius: 999px;
              display: inline-block;
              margin-bottom: 16px;
            }
            h1 {
              font-size: 28px;
              font-weight: 900;
              margin: 0 0 6px 0;
              text-transform: uppercase;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 15px;
              color: #555;
              font-weight: 600;
              margin-bottom: 24px;
            }
            .qr-box {
              background: #fff;
              border: 3px solid #FECC01;
              border-radius: 24px;
              padding: 16px;
              display: inline-block;
              box-shadow: 0 8px 20px rgba(254, 204, 1, 0.25);
            }
            .qr-box img {
              width: 250px;
              height: 250px;
              display: block;
            }
            .instructions {
              margin-top: 24px;
              font-size: 14px;
              font-weight: 700;
              color: #222;
              background: #F4F4F5;
              padding: 12px 18px;
              border-radius: 16px;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              font-weight: 800;
              color: #888;
              text-transform: uppercase;
              letter-spacing: 1.5px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">⚡ RAYO DELIVERY</div>
            <h1>${businessName}</h1>
            <div class="subtitle">${subText}</div>
            <div class="qr-box">
              <img src="${qrDataUrl}" alt="Código QR" />
            </div>
            <div class="instructions">
              📸 Abre la cámara de tu teléfono y escanea este código para ver el menú y ordenar
            </div>
            <div class="footer">
              Sin filas • Rápido • Directo a tu mesa
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[95vw] bg-[#0E0E11] text-white border-2 border-zinc-800 rounded-[2.5rem] p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
        <DialogHeader className="text-center space-y-2 pb-1">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FECC01]/10 border border-[#FECC01]/30 flex items-center justify-center text-[#FECC01] shadow-[0_0_20px_rgba(254,204,1,0.2)]">
            <QrCode size={26} />
          </div>
          <DialogTitle className="text-2xl font-black italic tracking-tight text-white uppercase">
            Código QR de Acceso
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 font-medium">
            Tus clientes y amigos pueden escanear este código con su celular para entrar de inmediato.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="flex bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800 gap-1 my-2">
          <button
            onClick={() => setActiveTab('app')}
            className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'app'
                ? 'bg-[#FECC01] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Smartphone size={14} />
            App Rayo
          </button>
          
          <button
            onClick={() => setActiveTab('restaurant')}
            className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'restaurant'
                ? 'bg-[#FECC01] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Store size={14} />
            Mi Local
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'table'
                ? 'bg-[#FECC01] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UtensilsCrossed size={14} />
            Mesa
          </button>
        </div>

        {/* Restaurant selector if in restaurant or table mode */}
        {(activeTab === 'restaurant' || activeTab === 'table') && restaurants.length > 1 && (
          <div className="space-y-1.5 my-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Seleccionar Local:
            </label>
            <select
              value={selectedRestId}
              onChange={(e) => setSelectedRestId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#FECC01]"
            >
              {restaurants.map(r => (
                <option key={r.id} value={r.id} className="bg-zinc-900 text-white">
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Table number input if table tab */}
        {activeTab === 'table' && (
          <div className="flex items-center gap-2 my-2 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/80">
            <div className="flex-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FECC01] block mb-1">
                Número o Nombre de Mesa:
              </span>
              <Input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Ej. 1, 2, Terraza, Barra..."
                className="bg-zinc-900 text-white border-zinc-700 h-9 text-xs rounded-xl font-bold"
              />
            </div>
            <div className="flex gap-1 shrink-0 pt-4">
              {['1', '2', '3', 'Barra'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setTableNumber(num)}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                    tableNumber === num ? 'bg-[#FECC01] text-black' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live QR Code Display Card */}
        <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-5 rounded-[2rem] border-2 border-zinc-800/90 flex flex-col items-center justify-center my-2 shadow-inner relative group">
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <Badge className="bg-[#FECC01]/10 text-[#FECC01] border-[#FECC01]/30 text-[9px] font-black uppercase">
              HD Scan
            </Badge>
          </div>

          <div className="bg-white p-4 rounded-3xl shadow-[0_10px_35px_rgba(0,0,0,0.6)] border-4 border-[#FECC01] flex items-center justify-center mb-3">
            {qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="QR Code" 
                className="w-52 h-52 sm:w-60 sm:h-60 rounded-xl block select-none"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-zinc-400">
                <QrCode size={48} className="animate-spin text-zinc-500" />
              </div>
            )}
          </div>

          <p className="font-black italic text-base text-white text-center leading-tight mb-1">
            {qrTitle}
          </p>
          <p className="text-[11px] text-zinc-400 font-bold text-center px-4 leading-snug">
            {qrSubtitle}
          </p>
        </div>

        {/* Target URL display with copy */}
        <div className="flex items-center gap-2 bg-zinc-900/80 p-2.5 rounded-2xl border border-zinc-800 text-xs">
          <span className="text-[11px] font-mono text-zinc-300 truncate flex-1 pl-1">
            {targetUrl}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyLink}
            className="h-8 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[10px] shrink-0"
          >
            {copied ? <Check size={14} className="text-green-400 mr-1" /> : <Copy size={14} className="mr-1" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
          <Button
            onClick={handleDownloadQr}
            className="bg-[#FECC01] hover:bg-[#FECC01]/90 text-black font-black uppercase tracking-wider text-xs rounded-2xl h-11 flex items-center justify-center gap-1.5 shadow-lg shadow-[#FECC01]/20 active:scale-95 transition-all"
          >
            <Download size={16} />
            Descargar
          </Button>

          <Button
            onClick={handlePrintFlyer}
            variant="outline"
            className="border-zinc-700 hover:border-zinc-500 bg-zinc-900 text-white font-black uppercase tracking-wider text-xs rounded-2xl h-11 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Printer size={16} className="text-[#FECC01]" />
            Imprimir
          </Button>

          <Button
            onClick={handleShare}
            variant="outline"
            className="col-span-2 sm:col-span-1 border-zinc-700 hover:border-zinc-500 bg-zinc-900 text-white font-black uppercase tracking-wider text-xs rounded-2xl h-11 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Share2 size={16} className="text-[#FECC01]" />
            Compartir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
