import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from '@/store';
import { Toaster } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import AdminApp from '@/screens/admin/AdminApp';
import { playOrderChime } from '@/lib/notifications';

const AdminAudioListener = () => {
  const { orders } = useApp();
  const [lastCount, setLastCount] = React.useState(orders.length);

  React.useEffect(() => {
    if (orders.length > lastCount) {
      playOrderChime();
    }
    setLastCount(orders.length);
  }, [orders.length, lastCount]);

  return null;
};

const QuotaWarning = () => {
  const { quotaExceeded } = useApp();
  if (!quotaExceeded) return null;

  return (
    <div className="bg-orange-600 text-white px-4 py-3 text-[11px] font-bold flex flex-col gap-2 shadow-2xl z-[100] sticky top-0 border-b-2 border-orange-400">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell size={16} className="animate-pulse" />
          <span className="uppercase tracking-tight">Capacidad diaria agotada (Google Free Tier)</span>
        </div>
        <Badge variant="outline" className="text-[9px] border-white text-white font-black">RESET @ 12AM PST ⏳</Badge>
      </div>
      <p className="opacity-90 leading-tight">
        La base de datos gratuita ha llegado a su límite de lectura por hoy.
      </p>
    </div>
  );
};

export default function AdminAppContainer() {
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <AppProvider>
      <BrowserRouter>
        <AdminAudioListener />
        <div className="min-h-screen bg-[#09090b] text-white">
          <QuotaWarning />
          <Routes>
            <Route path="*" element={<AdminApp />} />
          </Routes>
        </div>
        <Toaster position="top-center" />
      </BrowserRouter>
    </AppProvider>
  );
}
