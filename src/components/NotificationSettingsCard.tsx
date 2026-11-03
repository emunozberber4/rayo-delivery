import React from 'react';
import { Bell, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  testNotificationAndSound 
} from '@/lib/notifications';

export const NotificationSettingsCard = () => {
  const [permission, setPermission] = React.useState<NotificationPermission>(() => getNotificationPermission());
  const [testing, setTesting] = React.useState(false);

  const handleEnable = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      toast.success("¡Notificaciones activadas con éxito! ⚡️");
      testNotificationAndSound();
    } else {
      toast.error("Notificaciones no autorizadas en este navegador o celular");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    await testNotificationAndSound();
    setPermission(getNotificationPermission());
    toast.success("Sonido de timbre y alerta de prueba activados 🔔");
    setTimeout(() => setTesting(false), 1200);
  };

  return (
    <div className="bg-[#161619] border border-zinc-850 rounded-[2rem] p-5 shadow-2xl text-white space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#FECC01]/15 text-[#FECC01] flex items-center justify-center border border-[#FECC01]/30 shrink-0 shadow-[0_0_15px_rgba(254,204,1,0.15)]">
            <Bell size={22} className="animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              Alertas en Celular y Navegador
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            </h4>
            <p className="text-[10px] text-zinc-400 font-medium leading-relaxed mt-0.5">
              Notifica con sonido y vibración cuando entra un nuevo pedido, incluso con la pantalla apagada o en otra pestaña.
            </p>
          </div>
        </div>
        <Badge className={`text-[8px] font-black uppercase px-2.5 py-1 border shrink-0 ${
          permission === 'granted' 
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        }`}>
          {permission === 'granted' ? 'Activo ✔️' : 'Sin permiso'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2.5 pt-1">
        {permission !== 'granted' ? (
          <Button
            onClick={handleEnable}
            className="flex-1 bg-[#FECC01] hover:bg-[#ebd534] text-black h-12 rounded-2xl font-black italic text-xs uppercase tracking-wider shadow-lg shadow-[#FECC01]/20 active:scale-95 transition-all"
          >
            <Bell size={15} className="mr-2" /> Activar Notificaciones del Celular
          </Button>
        ) : null}

        <Button
          onClick={handleTest}
          disabled={testing}
          variant="outline"
          className="flex-1 bg-[#121215] hover:bg-zinc-800 border-zinc-700/80 text-white h-12 rounded-2xl font-black italic text-xs uppercase tracking-wider active:scale-95 transition-all"
        >
          <Volume2 size={15} className="mr-2 text-[#FECC01]" /> Probar Timbre y Alerta
        </Button>
      </div>
    </div>
  );
};
