import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Bike, ChefHat, CheckCircle, ChevronLeft, Phone, MessageSquare, MapPin, Store, Timer, MessageCircle, Star, Sparkles, RefreshCw } from 'lucide-react';
import { useApp, getWhatsAppOrderUrl } from '@/store';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { ChatWindow } from '@/components/ChatWindow';
import { Map, Marker } from 'pigeon-maps';

const TrackingView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, orders, updateStatus } = useApp();
  const [showChat, setShowChat] = useState(false);
  const [riderPos, setRiderPos] = useState<[number, number]>([14.8398, -91.8592]);
  const [userPos, setUserPos] = useState<[number, number]>([14.8450, -91.8680]);
  const [timeLeft, setTimeLeft] = useState(900); // 15 mins in seconds

  const order = id === 'latest' ? orders[0] : orders.find(o => o.id === id);
  const restPos: [number, number] = order?.restaurantLocation || [14.8398, -91.8592];

  useEffect(() => {
    let timer: any;
    if (order?.status !== 'entregado') {
      timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [order?.status]);

  const formatTimeMinutes = () => {
    if (order?.status === 'entregado') return 'Completado';
    if (order?.status === 'recibido') return '20 - 25 min';
    if (order?.status === 'preparacion') return '15 - 20 min';
    return '10 - 15 min';
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserPos([position.coords.latitude, position.coords.longitude]);
      });
    }
  }, []);

  // Update simulated movements for rider on route
  useEffect(() => {
    let interval: any;
    if (order?.status === 'camino') {
      let t = 0;
      interval = setInterval(() => {
        t += 0.05;
        if (t > 1) t = 0; // Loop simulation path
        const lat = restPos[0] + (userPos[0] - restPos[0]) * t;
        const lng = restPos[1] + (userPos[1] - restPos[1]) * t;
        setRiderPos([lat, lng]);
      }, 800);
    } else {
      setRiderPos(restPos);
    }
    return () => clearInterval(interval);
  }, [order?.status, userPos, restPos]);

  if (!order) return <div className="p-8 text-center text-zinc-500 bg-[#08080A] min-h-screen">Pedido no encontrado</div>;

  const steps = [
    { key: 'recibido', label: 'Recibido', sub: 'El comercio ha aceptado tu pedido', icon: Package },
    { key: 'preparacion', label: 'En preparación', sub: 'Cocinando con velocidad Rayo', icon: ChefHat },
    { key: 'camino', label: 'En camino', sub: 'El repartidor va hacia ti', icon: Bike },
    { key: 'entregado', label: 'Entregado!', sub: '¡Buen provecho, disfruta tu comida!', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === order.status);

  return (
    <div className="flex flex-col min-h-screen bg-[#08080A] text-white pb-24">
      <AnimatePresence>
        {showChat && (
          <ChatWindow orderId={order.id} onClose={() => setShowChat(false)} />
        )}
      </AnimatePresence>

      {/* Floating Simulation Helper (as in image bottom bar "Simulación (solo pruebas): [1] [2] [3] [4] [C] ") */}
      <div className="fixed bottom-24 left-4 right-4 z-40 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-2.5 rounded-2xl flex items-center justify-between shadow-2xl">
         <div className="flex items-center gap-1.5">
           <span className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">Simulación</span>
           <span className="text-[10px] text-[#FECC01]">⚡️</span>
         </div>
         <div className="flex gap-1">
           {steps.map((step, i) => (
             <Button 
               key={i} 
               size="xs" 
               variant={order.status === step.key ? 'default' : 'secondary'}
               className={`h-7 w-7 rounded-lg text-xs font-bold p-0 ${
                 order.status === step.key ? 'bg-[#FECC01] text-black' : 'bg-zinc-800 text-zinc-400'
               }`}
               onClick={() => {
                 updateStatus(order.id, step.key as any);
                 toast.info(`Estado simulado: ${step.label} ⚡️`);
               }}
             >
               {i + 1}
             </Button>
           ))}
           <Button 
             size="xs" 
             variant="destructive"
             className="h-7 w-7 rounded-lg text-[9px] font-black p-0"
             onClick={() => {
               updateStatus(order.id, 'cancelado');
               toast.error("Pedido Cancelado");
             }}
           >
             ✖
           </Button>
         </div>
      </div>

      {/* Interactive Geonavigator Map Panel */}
      <div className="h-[42vh] bg-zinc-950 relative overflow-hidden border-b border-zinc-900">
        <Map 
          center={userPos} 
          defaultZoom={13}
        >
          {/* User delivery pin */}
          <Marker width={35} anchor={userPos}>
            <div className="relative flex items-center justify-center w-10 h-10 bg-black border-2 border-[#FECC01] rounded-full text-[#FECC01] shadow-lg">
              <MapPin size={18} />
              <div className="absolute -bottom-1 w-2.5 h-2.5 bg-black border-r-2 border-b-2 border-[#FECC01] rotate-45" />
            </div>
          </Marker>

          {/* Restaurant / Merchant pin */}
          <Marker width={35} anchor={restPos}>
            <div className="relative flex items-center justify-center w-10 h-10 bg-black border-2 border-emerald-500 rounded-full text-emerald-500 shadow-lg animate-pulse">
              <Store size={18} />
            </div>
          </Marker>

          {/* Rider simulated movement pin */}
          {(order.status === 'camino' || order.status === 'preparacion') && (
            <Marker width={35} anchor={riderPos}>
              <div className="relative flex items-center justify-center w-9 h-9 bg-[#FECC01] text-black rounded-full shadow-2xl border-2 border-zinc-950">
                <Bike size={18} strokeWidth={2.5} />
              </div>
            </Marker>
          )}
        </Map>
        
        {/* Back navigation button */}
        <button 
          onClick={() => navigate('/explore')}
          className="absolute top-5 left-5 w-10 h-10 bg-black/80 hover:bg-black backdrop-blur-md rounded-full flex items-center justify-center border border-zinc-800 shadow-xl z-30 text-white"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>

        {/* Floating maximize indicator icon */}
        <div className="absolute top-5 right-5 w-10 h-10 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-zinc-800 shadow-xl z-30 text-zinc-400 text-xs font-bold">
          🛰️
        </div>
      </div>

      {/* Main Stats and Steps Details */}
      <div className="px-5 -mt-6 relative z-10 flex flex-col gap-4">
        
        {/* Destination Info header */}
        <div className="bg-[#161619] rounded-[2rem] p-4.5 border border-zinc-900 flex items-center gap-3 shadow-2xl">
           <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center text-[#FECC01] border border-zinc-850 shrink-0">
             <MapPin size={20} />
           </div>
           <div className="flex-1 overflow-hidden">
             <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none">Mi Ubicación de Entrega</p>
             <p className="font-extrabold text-xs text-white truncate mt-1">{order.deliveryAddress || 'Cargando...'}</p>
           </div>
        </div>

        {/* WhatsApp Notification confirmation & shortcut */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-[2rem] p-4 flex items-center justify-between gap-3 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center text-emerald-400 shrink-0">
              <MessageCircle size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Aviso por WhatsApp</p>
              </div>
              <p className="text-xs font-black text-white mt-0.5">
                +502 41070444
              </p>
              <p className="text-[9px] text-zinc-400 font-medium">Pedido transmitido a WhatsApp</p>
            </div>
          </div>
          <Button 
            size="sm"
            onClick={() => window.open(getWhatsAppOrderUrl(order, "50241070444"), '_blank')}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-wider rounded-xl h-9 px-3.5 shrink-0 shadow-lg flex items-center gap-1.5"
          >
            <MessageSquare size={13} />
            Ver Chat
          </Button>
        </div>

        {/* Core Status Card */}
        <div className="bg-[#161619] rounded-[2.5rem] p-6 border border-zinc-900 shadow-3xl space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black uppercase text-zinc-500 tracking-wider">
            <span>PEDIDO #{order.shortId || order.id.slice(-4).toUpperCase()}</span>
            <span className="text-[#FECC01]">Q{order.total.toFixed(2)}</span>
          </div>
          
          <Separator className="bg-zinc-900" />
          
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-[#FECC01] uppercase tracking-widest flex items-center gap-1">
                <span>En camino a ti</span>
                <span className="animate-pulse">⚡️</span>
              </p>
              <h2 className="text-xl font-black italic text-white uppercase tracking-tight">
                {steps[currentStepIndex]?.label || 'Procesando'}
              </h2>
            </div>
            <div className="w-14 h-14 bg-zinc-900 border border-zinc-850 rounded-2xl flex items-center justify-center text-[#FECC01] shadow-inner shrink-0">
              {React.createElement(steps[currentStepIndex]?.icon || Package, { size: 26, strokeWidth: 2.2 })}
            </div>
          </div>

          {/* Delivery Code verification section (matches Image 2 Screen 5: "Código de entrega : 5 9 1 4") */}
          {order.deliveryCode && order.status !== 'entregado' && (
            <div className="bg-zinc-950 p-4 rounded-3xl flex flex-col items-center justify-center space-y-2 border border-zinc-900">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Código de entrega</p>
              <p className="text-[9px] text-zinc-550 leading-relaxed text-center px-4">Comparte este código con el repartidor al recibir tu comida para validar tu pedido.</p>
              
              <div className="flex gap-2.5 pt-1.5">
                {order.deliveryCode.split('').map((char, i) => (
                  <span key={i} className="w-9 h-9 bg-zinc-900 border border-zinc-800 text-[#FECC01] rounded-xl flex items-center justify-center text-lg font-black shadow-inner">
                    {char}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Progress bar line */}
          <div className="flex gap-1.5 h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
             {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-full flex-1 transition-all duration-500 rounded-full ${
                    i <= currentStepIndex ? 'bg-[#FECC01]' : 'bg-zinc-900'
                  }`} 
                />
             ))}
          </div>

          <div className="text-center bg-zinc-900/50 py-2.5 px-3 rounded-2xl border border-zinc-900/80">
            {order.status === 'entregado' ? (
              <span className="flex items-center justify-center gap-1 text-emerald-450 font-extrabold text-xs uppercase tracking-wider"><CheckCircle size={14} /> ¡Pedido entregado con éxito!</span>
            ) : (
              <p className="text-xs text-zinc-400 font-bold flex items-center justify-center gap-2">
                <Timer size={13} className="text-[#FECC01] animate-pulse" />
                <span>Tiempo de entrega estimado: <span className="font-extrabold text-white text-sm">{formatTimeMinutes()}</span></span>
              </p>
            )}
          </div>
        </div>

        {/* Order Notes (If specified) */}
        {order.notes && (
          <div className="bg-zinc-900/50 rounded-3xl p-4.5 border border-zinc-900 flex items-start gap-3">
            <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center text-[#FECC01] shrink-0 border border-zinc-850">
              <MessageSquare size={16} />
            </div>
            <div>
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">Referencias ingresadas</p>
              <p className="text-xs text-zinc-300 italic mt-1.5">"{order.notes}"</p>
            </div>
          </div>
        )}

        {/* Order Menu Items Breakdown */}
        <div className="bg-[#161619] rounded-[2rem] p-5.5 border border-zinc-900">
           <div className="flex justify-between items-center mb-4.5">
             <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
               <Package size={14} className="text-[#FECC01]" /> Detalle del pedido
             </h3>
             <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-900 px-3 py-1 rounded-full text-zinc-400 text-[9px] font-black uppercase tracking-wider">
               <span>PAGO:</span>
               <span className="text-[#FECC01] font-black">💵 Efectivo</span>
             </div>
           </div>
           
           <div className="space-y-3">
             {order.items.map((item: any, i: number) => (
               <div key={i} className="flex justify-between items-center text-xs">
                 <div className="flex items-center gap-2 text-zinc-200">
                   <span className="font-black text-[#FECC01]">{item.quantity}x</span>
                   <div className="flex flex-col">
                     <span className="font-bold">{item.name}</span>
                     {item.notes && <span className="text-[10px] text-zinc-500 italic">"{item.notes}"</span>}
                   </div>
                 </div>
                 <span className="font-black text-white">Q{(item.price * item.quantity).toFixed(2)}</span>
               </div>
             ))}
           </div>
        </div>

        {/* Steps Timeline Track history */}
        <div className="bg-[#161619] rounded-[2rem] p-5 border border-zinc-900">
          <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest mb-5 ml-1 flex items-center gap-1.5">
            <Sparkles size={13} className="text-[#FECC01]" /> Estado del pedido
          </h3>
          <div className="space-y-6">
            {steps.map((step, index) => {
              const isDone = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <div key={step.key} className="flex gap-4 relative">
                  {index < steps.length - 1 && (
                    <div className={`absolute left-4 top-8 bottom-[-16px] w-[2px] ${
                      index < currentStepIndex ? 'bg-[#FECC01]' : 'bg-zinc-900'
                    }`} />
                  )}
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-colors ${
                    isCurrent ? 'bg-[#FECC01] text-black scale-110 shadow-[0_0_15px_rgba(254,204,1,0.25)] font-bold' : 
                    isDone ? 'bg-[#FECC01]/10 text-[#FECC01]' : 'bg-zinc-950 text-zinc-650'
                  }`}>
                    {isDone ? <CheckCircle size={15} /> : <div className="w-2.5 h-2.5 rounded-full bg-current" />}
                  </div>
                  
                  <div className={isDone ? 'opacity-100 flex-1' : 'opacity-30 flex-1'}>
                    <p className={`text-xs font-black uppercase tracking-wide ${isCurrent ? 'text-[#FECC01]' : 'text-zinc-200'}`}>{step.label}</p>
                    <p className="text-[11px] text-zinc-450 font-medium leading-relaxed mt-0.5">{step.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Rider Contact Card (Matches Image 2 Screen 5: "Carlos M. / Tu repartidor / 4.8 / Chat on air - Chat en vivo / WhatsApp, Call buttons") */}
        {(order.status === 'camino' || order.status === 'entregado' || (order.status === 'preparacion' && order.riderId)) && (
          <div className="bg-zinc-900 border border-zinc-850 rounded-[2rem] p-4 flex items-center gap-3.5 text-white shadow-2xl">
            {/* Avatar block with yellow gold profile accent */}
            <div className="w-12 h-12 bg-[#FECC01] text-black rounded-2xl overflow-hidden shrink-0 flex flex-col items-center justify-center font-black text-sm border-2 border-zinc-800 shadow-xl">
              <span>{order.riderName ? order.riderName.charAt(0).toUpperCase() : "R"}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-extrabold text-sm text-zinc-100 truncate">{order.riderName || "Simón G."}</p>
                <div className="flex items-center gap-0.5 text-[#FECC01] text-[10px] font-black">
                  <Star size={10} className="fill-current" />
                  <span>4.8</span>
                </div>
              </div>
              <p className="text-[10px] font-medium text-emerald-500 mt-0.5 uppercase tracking-wider flex items-center gap-1">
                <span>●</span> Chat en vivo habilitado
              </p>
            </div>
            
            <div className="flex gap-2">
              {/* Live Chat bubble */}
              <button 
                type="button"
                onClick={() => setShowChat(true)}
                className="w-10 h-10 bg-zinc-820 rounded-xl flex items-center justify-center border border-zinc-800 text-[#FECC01] hover:bg-zinc-800 shadow-sm transition-transform active:scale-90"
              >
                <MessageSquare size={17} />
              </button>

              {/* WhatsApp direct */}
              <button 
                type="button"
                onClick={() => {
                  const phone = order.riderPhone || '50255555555';
                  window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, soy el cliente del pedido #${order.shortId}.`)}`, '_blank');
                }}
                className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 rounded-xl flex items-center justify-center text-black border border-emerald-450 shadow-sm transition-transform active:scale-90"
              >
                <MessageCircle size={17} className="fill-current text-black" />
              </button>
              
              {/* Direct call */}
              <a 
                href={`tel:${order.riderPhone || '50255555555'}`}
                className="w-10 h-10 bg-[#FECC01] hover:bg-[#ebd534] rounded-xl flex items-center justify-center text-black shadow-sm transition-transform active:scale-90"
              >
                <Phone size={17} className="fill-current" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingView;
