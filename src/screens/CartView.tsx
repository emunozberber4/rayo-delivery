import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ShoppingCart, ArrowRight, Minus, Plus, MessageSquare, Ticket, MapPin, Navigation, Clock, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useApp } from '@/store';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const COUPONS: Record<string, number> = {
  'BIRRIA2GO': 0.5, // 50% discount
  'BIENVENIDO': 5, // Q5 discount
  'RAYO50': 0.5, // 50% discount
};

const CartView = () => {
  const navigate = useNavigate();
  const { cart, removeFromCart, addToCart, placeOrder, isStoreOpen } = useApp();
  const [orderNotes, setOrderNotes] = React.useState('');
  const [couponCode, setCouponCode] = React.useState('');
  const [discount, setDiscount] = React.useState(0);
  const [appliedCoupon, setAppliedCoupon] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<'efectivo'>('efectivo');
  const [deliveryReference, setDeliveryReference] = React.useState('');
  const [deliveryAddress, setDeliveryAddress] = React.useState('');
  const [deliveryGPS, setDeliveryGPS] = React.useState<{ lat: number, lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = React.useState(false);
  const [userPhone, setUserPhone] = React.useState('');
  const [userWhatsapp, setUserWhatsapp] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  const isRayoInCart = cart.some(item => item.restaurantId === 'r_rayo_burguer' || (item as any).restaurantName?.toLowerCase().includes('rayo burguer'));
  const isOpen = isRayoInCart ? true : isStoreOpen();
  const { user, updateUser } = useApp();

  React.useEffect(() => {
    if (user?.address) {
      setDeliveryAddress(user.address);
    }
    if (user?.phone) {
      setUserPhone(user.phone);
    }
    if (user?.whatsapp) {
      setUserWhatsapp(user.whatsapp);
    } else if (user?.phone) {
      setUserWhatsapp(user.phone);
    }
  }, [user]);

  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const deliveryFee = 0; // Sin cobro de envío según lo solicitado
  const total = Math.max(0, subtotal - discount);
  
  const handleApplyCoupon = () => {
    const code = couponCode.toUpperCase().trim();
    if (COUPONS[code]) {
      let calcDiscount = COUPONS[code];
      if (calcDiscount < 1) {
        calcDiscount = subtotal * calcDiscount;
      }
      setDiscount(calcDiscount);
      setAppliedCoupon(code);
      toast.success(`¡Cupón ${code} aplicado exitosamente! 💥`);
    } else {
      toast.error("Cupón inválido");
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalización no soportada en este navegador");
      return;
    }
    
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryGPS({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsGettingLocation(false);
        toast.success("Ubicación GPS capturada con precisión 🛰️");
      },
      (error) => {
        console.error(error);
        setIsGettingLocation(false);
        toast.error("No se pudo obtener la ubicación exacta");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleCheckout = async () => {
    if (!isOpen) {
      toast.error("Rayo Delivery está cerrado actualmente. Abrimos mañana a las 6:00 AM ⚡️", {
        icon: '🌙'
      });
      return;
    }

    if (!deliveryAddress.trim()) {
      toast.error("Por favor ingresa una dirección de entrega");
      return;
    }
    if (!userPhone.trim()) {
      toast.error("Por favor ingresa tu número de teléfono");
      return;
    }

    setIsProcessing(true);

    try {
      if (userPhone !== user?.phone || userWhatsapp !== user?.whatsapp) {
        await updateUser({ phone: userPhone, whatsapp: userWhatsapp });
      }

      await placeOrder(orderNotes, deliveryReference, discount, appliedCoupon, paymentMethod, deliveryGPS || undefined, deliveryAddress);
      
      toast.success("¡Pedido realizado con éxito!");

      navigate('/tracking/latest');
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      toast.error("Error al procesar el pedido");
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#08080A] text-white pt-24 pb-32 px-6 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center mb-6 text-[#FECC01] shadow-[0_0_20px_rgba(254,204,1,0.1)]">
          <ShoppingBag size={40} />
        </div>
        <h2 className="text-xl font-black italic mb-2 uppercase text-white">Tu carrito está vacío</h2>
        <p className="text-zinc-500 text-xs mb-8 max-w-[240px]">¡Agrega comidas deliciosas e ingredientes frescos para empezar tu pedido!</p>
        <Button 
          onClick={() => navigate('/explore')}
          className="bg-[#FECC01] uppercase tracking-wider text-black rounded-3xl px-12 h-12 font-black text-xs hover:bg-[#ebd534]"
        >
          VER RESTAURANTES
        </Button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8 pb-32 bg-[#08080A] text-white min-h-screen">
      {/* View Title */}
      <div className="flex items-center gap-4 mb-7">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/explore')}
          className="rounded-full bg-zinc-900 border border-zinc-850 text-white shrink-0 h-10 w-10 active:scale-95"
        >
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">Mi Carrito</h1>
      </div>

      {/* Closed warning */}
      {!isOpen && (
        <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-3xl mb-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-orange-500/20 rounded-2xl flex items-center justify-center shrink-0">
            <Clock className="text-[#FECC01]" size={20} />
          </div>
          <div className="flex-1">
            <p className="font-black italic text-[#FECC01] text-[10px] uppercase tracking-widest leading-none mb-1">Cerrado Temporalmente 🌙</p>
            <p className="text-[10px] font-bold text-zinc-400 leading-tight">Rayo Delivery opera con retraso de madrugada. Horario: 6AM - 11PM.</p>
          </div>
        </div>
      )}
      
      {/* Cart rows */}
      <div className="flex flex-col gap-3.5">
        <AnimatePresence>
          {cart.map((item) => (
            <motion.div 
              key={item.product.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#161619] p-4 rounded-3xl border border-zinc-900/60 shadow-sm flex gap-3.5 relative overflow-hidden"
            >
              <img 
                src={item.product.image} 
                alt={item.product.name} 
                className="w-18 h-18 rounded-2xl object-cover shrink-0 bg-zinc-950"
                referrerPolicy="no-referrer"
              />
              <div className="flex flex-col flex-1 justify-between py-0.5">
                <div>
                  <div className="flex justify-between items-start">
                    <h4 className="font-extrabold text-sm text-zinc-100 leading-tight">{item.product.name}</h4>
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-zinc-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-300">{item.product.category}</span>
                  {item.notes && (
                    <p className="text-[10px] text-[#FECC01] font-bold italic mt-1 bg-[#FECC01]/5 px-2 py-0.5 rounded-lg w-fit">
                      "{item.notes}"
                    </p>
                  )}
                </div>
                
                <div className="flex justify-between items-center mt-2.5">
                  <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-850 px-2.5 py-1.5 rounded-xl shrink-0">
                    <button className="text-zinc-400 hover:text-white" onClick={() => removeFromCart(item.product.id)}>
                      <Minus size={12} />
                    </button>
                    <span className="font-extrabold text-xs text-white">{item.quantity}</span>
                    <button 
                      className="text-[#FECC01] hover:text-[#ebd534]"
                      onClick={() => addToCart(item.product, item.restaurantId, '')}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="font-black text-sm text-[#FECC01]">Q{(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Coupon Application Card */}
      <div className="mt-6 bg-[#161619] rounded-3xl p-5 border border-zinc-900">
        <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest mb-3.5 flex items-center gap-2">
          <Ticket size={14} className="text-[#FECC01]" /> Código de descuento
        </h3>
        <div className="flex gap-2.5">
          <Input 
            placeholder="Introduce código (ej: RAYO50)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            disabled={!!appliedCoupon}
            className="rounded-2xl border-zinc-850 bg-zinc-900 text-white placeholder-zinc-500 h-11 text-xs focus-visible:ring-[#FECC01]"
          />
          <Button 
            variant={appliedCoupon ? "outline" : "default"}
            onClick={handleApplyCoupon}
            disabled={!!appliedCoupon}
            className="h-11 rounded-2xl px-5 bg-[#FECC01] text-black hover:bg-[#ebd534] font-extrabold text-xs uppercase"
          >
            {appliedCoupon ? "Aplicado ✓" : "Aplicar"}
          </Button>
        </div>
      </div>

      {/* Checkout Forms Panel */}
      <div className="mt-6 space-y-5">
        <div className="bg-[#161619] rounded-3xl p-5 border border-zinc-900 space-y-5.5">
          {/* General instructions */}
          <div>
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
              <MessageSquare size={14} className="text-[#FECC01]" /> Instrucciones de entrega generales
            </h3>
            <Input 
              placeholder="Ej: Portón negro, tocar timbre dos veces..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="rounded-2xl border-zinc-850 bg-zinc-900 text-white placeholder-zinc-500 h-11 text-xs focus-visible:ring-[#FECC01]"
            />
          </div>
          
          <Separator className="bg-zinc-900" />

          {/* Contact settings */}
          <div>
            <h3 className="text-xs font-black uppercase text-zinc-450 tracking-widest mb-3 flex items-center gap-2">
              <PhoneContactHelper />
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Teléfono Móvil</p>
                <Input 
                  placeholder="+502"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  className="rounded-2xl border-zinc-850 bg-zinc-900 text-white placeholder-zinc-500 h-11 text-xs"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">WhatsApp Chat</p>
                <Input 
                  placeholder="+502"
                  value={userWhatsapp}
                  onChange={(e) => setUserWhatsapp(e.target.value)}
                  className="rounded-2xl border-zinc-850 bg-zinc-900 text-white placeholder-zinc-500 h-11 text-xs"
                />
              </div>
            </div>
          </div>

          <Separator className="bg-zinc-900" />

          {/* Delivery destination */}
          <div>
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
              <MapPin size={14} className="text-[#FECC01]" /> Dirección de entrega <span className="text-emerald-500 font-extrabold">*</span>
            </h3>
            <Input 
              placeholder="Ej / Barrio El Centro, diagonal 4-12..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 h-11 text-xs focus:border-[#FECC01]"
            />
          </div>

          {/* GPS Location validation banner */}
          <div>
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
              <Navigation size={14} className="text-[#FECC01]" /> GPS Incorporado <span className="text-[9px] font-medium text-zinc-550 lowercase">(opcional)</span>
            </h3>
            
            <Button 
              type="button"
              variant={deliveryGPS ? "secondary" : "outline"}
              onClick={handleGetCurrentLocation}
              disabled={isGettingLocation}
              className={`w-full h-14 rounded-2xl flex items-center gap-3 active:scale-98 transition-all ${
                !deliveryGPS 
                  ? 'border border-dashed border-[#FECC01]/40 bg-[#FECC01]/5 text-[#FECC01]' 
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              }`}
            >
              <Navigation size={18} className={isGettingLocation ? "animate-pulse mt-0.5" : "mt-0.5"} />
              <div className="text-left flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase leading-none">
                  {isGettingLocation ? "Conectando al satélite..." : deliveryGPS ? "GPS CAPTURADO CON ÉXITO ✓" : "CAPTURAR MI UBICACIÓN GPS"}
                </p>
                <p className="text-[9px] opacity-75 font-bold uppercase tracking-tighter mt-1 truncate">
                  {deliveryGPS ? `${deliveryGPS.lat.toFixed(6)}, ${deliveryGPS.lng.toFixed(6)}` : "Permite fijar un punto exacto en el mapa"}
                </p>
              </div>
              {deliveryGPS && (
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-black font-extrabold text-[10px] shadow-sm">
                  ✓
                </div>
              )}
            </Button>
          </div>

          {/* Delivery references */}
          <div>
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
              <Navigation size={14} className="text-[#FECC01]" /> Referencia de la vivienda
            </h3>
            <Input 
              placeholder="Ej / Frente a tienda Sabor Latino..."
              value={deliveryReference}
              onChange={(e) => setDeliveryReference(e.target.value)}
              className="rounded-2xl border-zinc-850 bg-zinc-900 text-white placeholder-zinc-500 h-11 text-xs focus-visible:ring-[#FECC01]"
            />
          </div>
        </div>
      </div>

      {/* Invoice summary cards */}
      <div className="mt-5 bg-[#161619] rounded-3xl p-5 border border-zinc-900/65 flex flex-col gap-3">
        <div className="flex justify-between items-center text-xs font-bold text-zinc-400 uppercase tracking-wider">
          <span>Subtotal de productos</span>
          <span className="text-white">Q{subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between items-center text-xs font-black text-emerald-500 uppercase tracking-widest">
            <span>Deducción cupón ({appliedCoupon})</span>
            <span>-Q{discount.toFixed(2)}</span>
          </div>
        )}
        <Separator className="my-1.5 bg-zinc-900" />
        <div className="flex justify-between items-center">
          <span className="text-sm font-extrabold uppercase text-white tracking-widest">Total a pagar</span>
          <span className="text-2xl font-black text-[#FECC01] shadow-inner">Q{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Checkout actions */}
      <div className="mt-7">
        <h3 className="text-xs font-black text-zinc-450 uppercase tracking-widest mb-3 ml-1.5">
          💵 Método de Pago habilitado
        </h3>
        <div className="grid grid-cols-1 mb-5">
          <div className="p-4 rounded-3xl border border-[#FECC01]/35 bg-[#FECC01]/5 text-left flex items-center gap-3">
            <span className="text-2xl">💵</span>
            <div>
              <p className="text-xs font-black text-[#FECC01] uppercase tracking-wide">Pago en Efectivo</p>
              <p className="text-[10px] text-zinc-300 uppercase font-bold mt-0.5">Cancela al recibir tu entrega</p>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={handleCheckout}
          disabled={!isOpen || isProcessing}
          className={`w-full h-14 ${
            !isOpen 
              ? 'bg-zinc-850 text-zinc-500 cursor-not-allowed border border-zinc-800' 
              : 'bg-[#FECC01] hover:bg-[#ebd534] text-black shadow-[0_4px_25px_rgba(254,204,1,0.35)]'
          } rounded-3xl font-black text-sm flex items-center justify-between px-8 duration-200 active:scale-98 transition-all`}
        >
          <span className="font-extrabold italic uppercase tracking-wider">
            {isProcessing ? 'PROCESANDO TRANSACCIÓN...' : !isOpen ? 'COMERCIO CERRADO POR EL MOMENTO' : 'PROCESAR PEDIDO'}
          </span>
          {!isProcessing && isOpen && <ArrowRight size={16} strokeWidth={3} />}
          {!isOpen && <Clock size={16} />}
        </Button>
      </div>
    </div>
  );
};

// Simple visual helpers to enhance layout modularity
const PhoneContactHelper = () => (
  <>
    <span>📞</span>
    <span>Números de Contacto</span>
    <span className="text-stone-500 font-extrabold ml-1">*</span>
  </>
);

export default CartView;
