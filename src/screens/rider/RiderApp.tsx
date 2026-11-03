import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bike, Package, Zap, ChevronRight, Navigation, MapPin, 
  Store, User, MessageCircle, AlertTriangle, ArrowLeft, 
  LifeBuoy, Plus, UserX, Clock, Volume2, ShieldAlert
} from 'lucide-react';
import { useApp } from '@/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { NotificationSettingsCard } from '@/components/NotificationSettingsCard';
import { AuthModal } from '@/components/AuthModal';

export const RiderOrderDetails = ({ 
  order, 
  onAccept, 
  onUpdateStatus, 
  onClose 
}: { 
  order: any; 
  onAccept: (id: string) => void; 
  onUpdateStatus: (id: string, status: any) => void; 
  onClose: () => void; 
}) => {
  const { stopAlert, users } = useApp();
  const [securityCode, setSecurityCode] = React.useState('');
  const rider = users.find(u => u.uid === order.riderId);

  React.useEffect(() => {
    // Stop alert when rider opens order details for a new order
    if (order.status === 'recibido') {
      stopAlert();
    }
    // Auto Accept logic
    if (order.status === 'recibido' && rider?.autoAccept) {
      setTimeout(() => onAccept(order.id), 2000);
    }
  }, [order.id, order.status, stopAlert, rider?.autoAccept, onAccept]);

  const whatsappUrl = `https://wa.me/${order.userWhatsapp?.replace(/\D/g, '') || order.userPhone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${order.userName}, soy tu repartidor de Rayo Delivery. Llevo tu pedido #${order.shortId}.`)}`;
  const restaurantWhatsappUrl = `https://wa.me/${order.restaurantWhatsapp?.replace(/\D/g, '') || order.restaurantPhone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, soy el repartidor asignado al pedido #${order.shortId}.`)}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 z-[100] bg-[#09090b] text-white p-6 flex flex-col"
    >
      <div className="flex justify-between items-center mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="rounded-full bg-zinc-900 border border-zinc-800 text-white h-10 w-10 active:scale-95"
        >
          <ArrowLeft size={18} />
        </Button>
        <div className="text-center">
          <h3 className="font-black italic text-2xl text-white uppercase leading-none tracking-tight">PEDIDO #{order.shortId}</h3>
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">Detalles de Entrega Rayo</p>
        </div>
        <Badge className="bg-[#FECC01] text-black font-black uppercase text-[10px] tracking-wider px-3 py-1">
          {order.status}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-32 no-scrollbar">
        {/* Info Cards */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-[#161619] p-6 rounded-[2rem] border border-zinc-800/80 shadow-xl">
            <p className="text-[10px] font-black text-[#FECC01] uppercase tracking-widest mb-2 flex items-center gap-2">
              <User size={13} /> CLIENTE (WhatsApp Directo)
            </p>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xl font-black text-white italic">{order.userName || 'Cliente Rayo Delivery'}</p>
                <p className="text-xs text-zinc-300 font-bold mt-0.5">{order.userPhone || 'Sin teléfono'}</p>
              </div>
              <Button 
                size="icon"
                className="bg-emerald-500 hover:bg-emerald-600 text-black w-13 h-13 rounded-2xl shadow-xl active:scale-95 transition-transform"
                onClick={() => window.open(whatsappUrl, '_blank')}
                title="Abrir WhatsApp con cliente"
              >
                <MessageCircle size={22} className="text-black" />
              </Button>
            </div>
          </div>
          
          <div className="bg-[#161619] p-6 rounded-[2rem] border border-zinc-800/80 shadow-xl">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Store size={13} className="text-[#FECC01]" /> ORIGEN DEL PEDIDO
            </p>
            {order.payAtLocal && (
              <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 p-4 rounded-2xl flex items-center gap-3 mb-4 shadow-lg animate-pulse">
                <AlertTriangle size={22} className="text-amber-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 text-amber-400">¡AVISO CRÍTICO!</p>
                  <p className="text-xs font-bold leading-tight text-white">DEBES PAGAR EL TOTAL AL LOCAL ANTES DE SALIR.</p>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-black text-white italic">{order.restaurantName}</p>
                <p className="text-xs text-zinc-400 font-medium">{order.restaurantPhone || 'Sin teléfono'}</p>
              </div>
              <Button 
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-2xl border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-transform"
                onClick={() => window.open(restaurantWhatsappUrl, '_blank')}
                title="Abrir WhatsApp con comercio"
              >
                <MessageCircle size={20} />
              </Button>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="bg-[#161619] border border-zinc-800/80 p-6 rounded-[2rem] space-y-6 shadow-xl text-white">
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center">
                <Store size={16} className="text-zinc-400" />
              </div>
              <div className="w-0.5 flex-1 border-l-2 border-zinc-800 border-dashed" />
              <div className="w-8 h-8 bg-[#FECC01]/15 rounded-full flex items-center justify-center border border-[#FECC01]/30">
                <MapPin size={16} className="text-[#FECC01]" />
              </div>
            </div>
            <div className="flex-1 space-y-5 py-1">
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Recoger en:</p>
                <p className="text-sm font-bold text-white mt-0.5">{order.restaurantAddress || 'Dirección de Recolección'}</p>
                {order.restaurantAddressReference && (
                  <p className="text-[11px] text-[#FECC01] font-bold bg-[#FECC01]/10 border border-[#FECC01]/20 p-2 rounded-xl mt-1.5 font-mono uppercase">
                    REF LOCAL: {order.restaurantAddressReference}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Entregar en:</p>
                <p className="text-sm font-bold text-white mt-0.5">{order.deliveryAddress}</p>
                {order.deliveryReference && (
                  <p className="text-[11px] text-[#FECC01] font-bold bg-[#FECC01]/10 border border-[#FECC01]/20 p-2 rounded-xl mt-1.5 font-mono uppercase">
                    REF CLIENTE: {order.deliveryReference}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3.5">
            <Button 
              variant="outline"
              className="h-13 rounded-2xl font-black text-xs gap-2 border-zinc-750 bg-zinc-900 hover:bg-zinc-850 text-white shadow-sm active:scale-95 transition-transform uppercase"
              onClick={() => {
                const loc = order.restaurantLocation;
                const url = loc ? `https://www.google.com/maps/dir/?api=1&destination=${loc[0]},${loc[1]}`
                          : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.restaurantAddress)}`;
                window.open(url, '_blank');
              }}
            >
              <Store size={16} className="text-[#FECC01]" /> GPS LOCAL
            </Button>
            <Button 
              className="h-13 bg-[#FECC01] hover:bg-[#ebd534] rounded-2xl font-black text-xs gap-2 text-black shadow-lg shadow-[#FECC01]/20 active:scale-95 transition-transform uppercase"
              onClick={() => {
                const gps = order.deliveryGPS;
                const url = gps ? `https://www.google.com/maps/dir/?api=1&destination=${gps.lat},${gps.lng}`
                          : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.deliveryAddress)}`;
                window.open(url, '_blank');
              }}
            >
              <Navigation size={16} /> GPS CLIENTE
            </Button>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-[#161619] border border-zinc-800/80 p-6 rounded-[2rem] space-y-4 shadow-xl text-white">
          <h4 className="font-black italic text-xs uppercase text-zinc-300 tracking-widest flex items-center gap-2">
            <Package size={14} className="text-[#FECC01]" /> Detalle del Pedido
          </h4>
          <div className="space-y-3">
            {order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-zinc-850 last:border-b-0">
                <div className="flex gap-3 items-center">
                  <span className="font-black text-[#FECC01] text-base">{item.quantity}x</span>
                  <span className="font-bold text-white text-sm">{item.name}</span>
                </div>
                {item.price && (
                  <span className="text-xs font-bold text-zinc-400">Q{(item.price * item.quantity).toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>
          <Separator className="bg-zinc-800" />
          <div className="flex justify-between items-center pt-1">
            <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">PAGO: {order.paymentMethod?.toUpperCase()}</span>
            <span className="text-2xl font-black text-[#FECC01] italic">Q{order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#09090b] pt-4 border-t border-zinc-850">
        {order.status === 'recibido' && (
          <Button 
            onClick={() => onAccept(order.id)}
            className="w-full h-15 bg-[#FECC01] hover:bg-[#ebd534] text-black rounded-2xl font-black italic text-lg uppercase shadow-2xl active:scale-95 transition-transform"
          >
            ACEPTAR PEDIDO ⚡️
          </Button>
        )}
        {order.status === 'preparacion' && (
          <Button 
            onClick={() => onUpdateStatus(order.id, 'camino')}
            className="w-full h-15 bg-amber-500 hover:bg-amber-600 text-black rounded-2xl font-black italic text-lg uppercase shadow-2xl active:scale-95 transition-transform"
          >
            CONFIRMAR RECOLECCIÓN EN LOCAL
          </Button>
        )}
        {order.status === 'camino' && (
          <div className="space-y-4 px-1">
            <div className="bg-[#161619] border border-zinc-800 p-4 rounded-2xl text-center">
              <p className="text-[10px] font-black text-[#FECC01] uppercase tracking-widest mb-2">🔐 Ingrese Código del Cliente</p>
              <Input 
                value={securityCode}
                onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                className="h-14 text-center text-3xl font-black rounded-2xl border-zinc-700 bg-[#121215] text-[#FECC01] focus:border-[#FECC01]"
              />
            </div>
            <Button 
              onClick={() => {
                if (order.deliveryCode && securityCode !== order.deliveryCode) {
                  toast.error("Código de seguridad incorrecto. Solicítalo al cliente.");
                  return;
                }
                onUpdateStatus(order.id, 'entregado');
              }}
              className="w-full h-15 bg-emerald-500 hover:bg-emerald-600 text-black rounded-2xl font-black italic text-lg uppercase shadow-2xl active:scale-95 transition-transform"
            >
              FINALIZAR ENTREGA ✔️
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function RiderApp() {
  const navigate = useNavigate();
  const { 
    user, orders, messages, logout, updateUser, updateStatus, acceptOrder, releaseOrder,
    setRiderStatus, sendMessage, applyAsRider
  } = useApp();

  const [activeRiderTab, setActiveRiderTab] = React.useState<'inicio' | 'mensajes' | 'ajustes'>('inicio');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [msgInput, setMsgInput] = React.useState('');
  const [showAuthModal, setShowAuthModal] = React.useState(false);

  // If user is not logged in, prompt login
  if (!user || !user.isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white p-6 flex flex-col justify-center items-center text-center">
        <div className="w-20 h-20 bg-[#FECC01] text-black rounded-3xl flex items-center justify-center font-black mb-6 shadow-2xl shadow-[#FECC01]/30">
          <Bike size={40} />
        </div>
        <h2 className="text-3xl font-black italic uppercase text-white mb-2">Rayo Repartidores</h2>
        <p className="text-sm text-zinc-400 max-w-sm mb-8 font-medium">
          Inicia sesión con tu cuenta de repartidor autorizada para recibir pedidos, activar turnos y gestionar tus entregas.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button 
            onClick={() => setShowAuthModal(true)} 
            className="w-full h-14 bg-[#FECC01] hover:bg-[#ebd534] text-black font-black uppercase rounded-2xl text-base shadow-xl active:scale-95 transition-all"
          >
            Iniciar Sesión
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/explore')} 
            className="w-full h-12 border-zinc-800 text-zinc-300 hover:text-white rounded-2xl font-bold uppercase text-xs"
          >
            Ir a Rayo Clientes
          </Button>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  // If user is logged in but not a rider or not verified
  if (user.role !== 'rider' && user.role !== 'super_admin' && !user.isVerifiedRider) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white p-6 flex flex-col justify-center items-center text-center">
        <div className="w-20 h-20 bg-amber-500/20 border-2 border-amber-500 text-[#FECC01] rounded-3xl flex items-center justify-center font-black mb-6 shadow-2xl">
          <AlertTriangle size={38} className="animate-pulse" />
        </div>
        <h2 className="text-2xl font-black italic uppercase text-white mb-2">Acceso a Repartidores</h2>
        <p className="text-xs text-zinc-400 max-w-sm mb-6 font-medium leading-relaxed">
          Tu cuenta actual (<span className="text-[#FECC01]">{user.email}</span>) no tiene el rol de repartidor activo o se encuentra en revisión administrativa.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {user.role === 'client' && (
            <Button 
              onClick={async () => {
                await applyAsRider();
                toast.success("Solicitud enviada a revisión");
              }} 
              className="w-full h-14 bg-[#FECC01] hover:bg-[#ebd534] text-black font-black uppercase rounded-2xl text-sm shadow-xl active:scale-95 transition-all"
            >
              Postularme como Repartidor ⚡
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => navigate('/explore')} 
            className="w-full h-12 border-zinc-800 text-zinc-300 hover:text-white rounded-2xl font-bold uppercase text-xs"
          >
            Volver a Rayo Clientes
          </Button>
        </div>
      </div>
    );
  }

  const isEduardo = user.email?.toLowerCase() === 'emunozberber4@gmail.com' || 
                    user.email?.toLowerCase() === 'emunozberber@gmail.com' || 
                    user.name?.toLowerCase().includes('eduardo') ||
                    user.role === 'super_admin';

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 flex flex-col relative space-y-6">
      {/* Rider Header */}
      <div className="flex justify-between items-center relative z-10 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-[#FECC01] text-black flex items-center justify-center font-black shadow-[0_0_15px_rgba(254,204,1,0.3)]">
            <Bike size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black italic uppercase text-white leading-none">PANEL REPARTIDOR</h2>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{user.name || 'Repartidor Rayo'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-4 py-1.5 rounded-full border transition-all duration-300 ${user.riderStatus === 'repartiendo' ? 'border-[#FECC01]/50 bg-[#FECC01]/10 text-[#FECC01]' : 'border-zinc-800 bg-[#161619] text-zinc-400'}`}>
            <span className="text-[10px] font-black italic uppercase tracking-wider">
              {user.riderStatus === 'repartiendo' ? '⚡ EN LÍNEA' : '💤 OFFLINE'}
            </span>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-2xl w-11 h-11 bg-[#161619] hover:bg-zinc-800 border border-zinc-800 text-white shadow-sm active:scale-95"
            onClick={() => setActiveRiderTab('ajustes')}
          >
            <div className="flex flex-col gap-1 items-end">
              <div className="w-5 h-0.5 bg-[#FECC01]" />
              <div className="w-3.5 h-0.5 bg-white" />
              <div className="w-5 h-0.5 bg-[#FECC01]" />
            </div>
          </Button>
        </div>
      </div>

      {/* Notification and Audio Configuration Card */}
      <NotificationSettingsCard />

      {/* Available Orders List for Riders */}
      <div className="flex-1 space-y-5">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-black italic text-sm text-white uppercase tracking-widest flex items-center gap-2">
            <Package size={17} className="text-[#FECC01]" />
            PEDIDOS DISPONIBLES
          </h3>
          <Badge className="bg-[#FECC01]/15 text-[#FECC01] border border-[#FECC01]/30 text-[9px] font-black uppercase px-2.5 py-0.5">
            {(orders || []).filter(o => o.status === 'recibido' && (o.riderId === 'SYSTEM' || !o.riderId)).length} ALERTAS
          </Badge>
        </div>

        {/* Verification Guard: Check if authorized */}
        {!isEduardo ? (
          <div className="bg-[#161619] border border-amber-500/30 p-8 rounded-[2.5rem] shadow-2xl text-center space-y-3.5 my-2">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-[#FECC01] flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black italic text-white uppercase tracking-wider">CUENTA EN ESTADO PENDIENTE DE ASIGNACIÓN ⏳</h4>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Por el momento las entregas están asignadas exclusivamente al piloto principal. Se te habilitarán pedidos en cuanto tu cuenta sea activada por la administración.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {(orders || []).filter(o => o.status === 'recibido' && (o.riderId === 'SYSTEM' || !o.riderId)).length === 0 ? (
              <div className="bg-[#161619] rounded-[2.5rem] p-10 text-center border-2 border-dashed border-zinc-800 flex flex-col items-center gap-4 shadow-xl">
                <div className="w-20 h-20 bg-[#121215] border border-zinc-800 rounded-full flex items-center justify-center">
                  <Zap size={34} className="text-[#FECC01] animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="font-black italic text-white uppercase text-xs tracking-widest">Sin pedidos pendientes en este momento</p>
                  <p className="text-[11px] text-zinc-400 font-bold">Tu celular sonará y notificará automáticamente cuando ingrese un nuevo pedido ⚡️</p>
                </div>
              </div>
            ) : (
              (orders || []).filter(o => o.status === 'recibido' && (o.riderId === 'SYSTEM' || !o.riderId)).map(order => (
                <motion.div 
                  key={order.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-[#161619] p-6 rounded-[2.5rem] shadow-xl border border-zinc-800/80 flex flex-col gap-4 group hover:border-[#FECC01]/50 transition-all cursor-pointer text-white"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[#FECC01] font-black italic text-xl">#{order.shortId}</span>
                        <Badge className="bg-[#FECC01] text-black border-none text-[8px] font-black uppercase px-2">NUEVO</Badge>
                      </div>
                      <p className="text-base font-black text-white italic tracking-wide">{order.restaurantName}</p>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium mt-1">
                        <MapPin size={13} className="text-[#FECC01] shrink-0" />
                        <span className="truncate">{order.restaurantAddress?.slice(0, 32)}...</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 font-bold mt-2 bg-[#121215] p-2.5 rounded-xl border border-zinc-800">
                        <Navigation size={13} className="text-[#FECC01] shrink-0" />
                        <span className="truncate">ENTREGA: {order.deliveryAddress?.slice(0, 30)}...</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-2xl text-[#FECC01] italic">Q{order.total.toFixed(2)}</p>
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{order.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="flex gap-2.5 border-t border-zinc-800 pt-4">
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        acceptOrder(order.id);
                      }}
                      disabled={orders.some(o => o.riderId === user.uid && o.status !== 'entregado' && o.status !== 'cancelado')}
                      className={`flex-1 ${orders.some(o => o.riderId === user.uid && o.status !== 'entregado' && o.status !== 'cancelado') ? 'bg-zinc-800 text-zinc-500 opacity-60 cursor-not-allowed' : 'bg-[#FECC01] hover:bg-[#ebd534] text-black shadow-lg shadow-[#FECC01]/20'} h-13 rounded-2xl font-black italic text-sm tracking-wider uppercase active:scale-95 transition-all`}
                    >
                      {orders.some(o => o.riderId === user.uid && o.status !== 'entregado' && o.status !== 'cancelado') ? "ENTREGA EN CURSO" : "ACEPTAR PEDIDO ⚡️"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="w-13 h-13 rounded-2xl border-zinc-800 bg-[#121215] text-white hover:bg-zinc-800 active:scale-95 transition-transform"
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* My ongoing orders section */}
        {(orders || []).filter(o => o.riderId === user.uid && o.status !== 'entregado' && o.status !== 'cancelado').length > 0 && (
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <h3 className="font-black italic text-xs text-white uppercase tracking-widest px-1">MIS ENTREGAS ACTIVAS</h3>
            {(orders || []).filter(o => o.riderId === user.uid && o.status !== 'entregado' && o.status !== 'cancelado').map(order => (
              <div 
                key={order.id}
                className="bg-[#161619] border border-zinc-800 p-5 rounded-[2rem] text-white flex justify-between items-center group cursor-pointer shadow-lg"
              >
                <div className="flex items-center gap-4 flex-1" onClick={() => setSelectedOrder(order)}>
                  <div className="w-12 h-12 bg-[#FECC01]/10 border border-[#FECC01]/20 rounded-2xl flex items-center justify-center animate-pulse">
                    <Bike className="text-[#FECC01]" size={24} />
                  </div>
                  <div>
                    <p className="font-black italic text-white text-sm">#{order.shortId} - {order.restaurantName}</p>
                    <Badge className="bg-[#FECC01]/20 text-[#FECC01] border border-[#FECC01]/30 text-[8px] font-black uppercase mt-0.5">{order.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={order.releaseRequested}
                    onClick={(e) => {
                      e.stopPropagation();
                      if(confirm(order.releaseRequested ? "Ya has solicitado liberar este pedido. Espera la autorización del administrador." : "¿Estás seguro de que deseas solicitar la liberación de este pedido? Un administrador deberá autorizarlo.")) {
                        releaseOrder(order.id);
                      }
                    }}
                    className={`w-10 h-10 rounded-xl ${order.releaseRequested ? 'text-zinc-500 bg-zinc-800' : 'text-rose-400 hover:bg-rose-500/10'}`}
                    title={order.releaseRequested ? "Liberación Solicitada" : "Solicitar liberación"}
                  >
                    {order.releaseRequested ? <Clock size={16} className="animate-pulse" /> : <UserX size={18} />}
                  </Button>
                  <ChevronRight className="text-zinc-400 group-hover:text-[#FECC01] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shift Toggle & Help Buttons */}
      <div className="mt-auto pt-6 flex justify-between items-end">
        <div className="flex-1" />
        
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[8px] font-black text-zinc-400 mb-3 uppercase tracking-[0.2em] italic">Toca para conectar</p>
          <Button 
            onClick={() => {
               const nextStatus = user.riderStatus === 'repartiendo' ? 'no repartiendo' : 'repartiendo';
               setRiderStatus(nextStatus);
            }}
            className={`w-full max-w-[240px] h-20 rounded-3xl shadow-2xl transition-all duration-500 flex items-center justify-center gap-4 relative overflow-hidden group ${user.riderStatus === 'repartiendo' ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' : 'bg-[#FECC01] hover:bg-[#ebd534] text-black font-black scale-105 shadow-[0_4px_25px_rgba(254,204,1,0.3)]'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Zap size={28} className={`transition-transform duration-500 ${user.riderStatus === 'repartiendo' ? 'rotate-12' : 'animate-pulse'}`} />
            <span className="text-2xl font-black italic uppercase tracking-tighter">
              {user.riderStatus === 'repartiendo' ? 'DETENER' : 'COMENZAR'}
            </span>
          </Button>
        </div>

        <div className="flex-1 flex justify-end pb-2">
          <Button 
            onClick={() => {
              sendMessage("Hola, necesito asistencia humana inmediata con mi entrega.");
              setActiveRiderTab('mensajes');
            }}
            className="w-15 h-15 rounded-full bg-[#161619] hover:bg-zinc-800 shadow-xl border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-[#FECC01] hover:scale-105 active:scale-95 transition-all"
            title="Soporte y Ayuda"
          >
            <LifeBuoy size={26} />
          </Button>
        </div>
      </div>

      {/* Order overlay if one is selected */}
      <AnimatePresence>
        {selectedOrder && (
          <RiderOrderDetails 
            order={selectedOrder} 
            onAccept={(id) => {
              acceptOrder(id);
              setSelectedOrder(null);
            }}
            onUpdateStatus={(id, status) => {
              updateStatus(id, status);
              const updatedOrder = orders.find(o => o.id === id);
              if (status === 'entregado') setSelectedOrder(null);
              else if (updatedOrder) setSelectedOrder({...updatedOrder, status});
            }}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </AnimatePresence>

      {/* Support / Settings overlay */}
      {(activeRiderTab === 'ajustes' || activeRiderTab === 'mensajes') && (
        <motion.div 
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          className="fixed inset-0 z-[110] bg-[#09090b] text-white p-6 flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" onClick={() => setActiveRiderTab('inicio')} className="font-black italic text-sm text-[#FECC01] hover:bg-zinc-800 rounded-xl">
              <ArrowLeft className="mr-2" /> VOLVER
            </Button>
            <h3 className="font-black italic uppercase text-white text-base">
              {activeRiderTab === 'ajustes' ? 'Configuración de Repartidor' : 'Soporte Directo Rayo'}
            </h3>
          </div>
          
          <ScrollArea className="flex-1">
            {activeRiderTab === 'ajustes' ? (
              <div className="space-y-5">
                 {/* Audio & Notification settings */}
                 <NotificationSettingsCard />

                 <div className="bg-[#161619] border border-zinc-800 p-6 rounded-3xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-black text-white text-sm">Auto-Aceptación de Pedidos</p>
                        <p className="text-[11px] text-zinc-400 font-medium">Aceptar nuevos pedidos de entrega automáticamente</p>
                      </div>
                      <button 
                        onClick={() => updateUser({ autoAccept: !user.autoAccept })}
                        className={`w-13 h-7 rounded-full relative transition-colors ${user.autoAccept ? 'bg-[#FECC01]' : 'bg-zinc-800 border border-zinc-700'}`}
                      >
                        <div className={`absolute top-1 w-5 h-5 rounded-full ${user.autoAccept ? 'bg-black right-1' : 'bg-zinc-400 left-1'} transition-all`} />
                      </button>
                    </div>
                 </div>

                 <div className="bg-[#161619] border border-zinc-800 p-6 rounded-3xl space-y-2">
                    <p className="text-[10px] font-black text-[#FECC01] uppercase tracking-widest">WhatsApp de Contacto</p>
                    <Input 
                      value={user.whatsapp || ''} 
                      onChange={e => updateUser({ whatsapp: e.target.value })}
                      placeholder="+502"
                      className="rounded-xl h-12 bg-[#121215] text-white border-zinc-700 focus:border-[#FECC01]"
                    />
                 </div>

                 <Button 
                   onClick={() => {
                     logout();
                     navigate('/explore');
                   }}
                   variant="destructive"
                   className="w-full h-14 rounded-2xl font-black italic uppercase text-sm tracking-wider"
                 >
                   CERRAR SESIÓN
                 </Button>
              </div>
            ) : (
              <div className="space-y-4">
                 <div className="bg-[#161619] p-5 rounded-3xl border border-[#FECC01]/20 mb-4">
                    <p className="text-sm font-black text-[#FECC01] mb-1">Canal de Soporte Directo ⚡️</p>
                    <p className="text-[11px] text-zinc-300">Nuestros agentes y administración están listos para asistirte en tiempo real.</p>
                 </div>
                 {(messages || []).filter(m => m.senderId === 'system' || m.senderId === user.uid).map(msg => (
                   <div key={msg.id} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-bold ${msg.senderId === user.uid ? 'bg-[#FECC01] text-black font-bold' : 'bg-[#161619] text-white border border-zinc-800'}`}>
                         {msg.text}
                      </div>
                   </div>
                 ))}
                 <div className="pt-4 flex gap-2">
                   <Input 
                     placeholder="Escribe tu mensaje a soporte..." 
                     value={msgInput}
                     onChange={e => setMsgInput(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && (sendMessage(msgInput), setMsgInput(''))}
                     className="h-12 rounded-xl bg-[#121215] text-white border-zinc-700 focus:border-[#FECC01]"
                   />
                   <Button onClick={() => (sendMessage(msgInput), setMsgInput(''))} className="h-12 w-12 rounded-xl shrink-0 bg-[#FECC01] text-black hover:bg-[#ebd534]">
                     <Plus />
                   </Button>
                 </div>
              </div>
            )}
          </ScrollArea>
        </motion.div>
      )}
    </div>
  );
}
