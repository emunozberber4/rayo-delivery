import React, { useState } from 'react';
import { Search, MapPin, Star, Clock, Home, Briefcase, ChevronDown, Filter, Zap, Heart, ShoppingBag, Timer, Edit2, Shield, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@/data';
import { Input } from '@/components/ui/input';
import { useApp } from '@/store';
import { motion } from 'motion/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Restaurant } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { AppQrModal } from '@/components/AppQrModal';

const Explore = () => {
  const navigate = useNavigate();
  const { user, loading, updateUser, restaurants, updateRestaurant, isStoreOpen } = useApp();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('todos');
  const [activeFilter, setActiveFilter] = useState<'all' | 'top' | 'fast' | 'free'>('all');
  const isGlobalOpen = isStoreOpen();
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Restaurant>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleEditRestaurant = (res: Restaurant, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRestaurant(res);
    setEditFormData({
      name: res.name,
      image: res.image,
      address: res.address,
      openingTime: res.openingTime,
      closingTime: res.closingTime,
      deliveryTime: res.deliveryTime
    });
  };

  const handleSaveRestaurant = async () => {
    if (!editingRestaurant) return;
    setIsSaving(true);
    try {
      await updateRestaurant(editingRestaurant.id, editFormData);
      setEditingRestaurant(null);
    } catch (error) {
      toast.error("Error al guardar cambios");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) {
        toast.error("La imagen es muy pesada (máx 800KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditFormData({ ...editFormData, image: reader.result as string });
        toast.success("Imagen cargada");
      };
      reader.readAsDataURL(file);
    }
  };

  const isOpen = (res: any) => {
    if (res?.id === 'r_rayo_burguer' || res?.name?.toLowerCase().includes('rayo burguer')) return true;
    if (res?.isOpen === false) return false;
    if (res?.isOpen === true && (!res?.openingTime || res?.openingTime === '00:00')) return true;
    if (!res?.openingTime || !res?.closingTime) return true;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return currentTime >= res.openingTime && currentTime <= res.closingTime;
  };

  const handleAddressSelect = (addr: string) => {
    updateUser({ address: addr });
    toast.success("Ubicación actualizada 📍");
  };

  const useGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const coords = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
        updateUser({ address: `Mi Ubicación (${coords})` });
        toast.success("Ubicación GPS actualizada 📍");
      });
    } else {
      toast.error("GPS no disponible");
    }
  };

  const filteredRestaurants = restaurants
    .filter(r => 
      (user?.role === 'super_admin' || (r.isApproved !== false && r.isHidden !== true)) &&
      (r.name || '').toLowerCase().includes(search.toLowerCase()) &&
      (activeCategory === 'todos' || (r.categories || []).includes(activeCategory))
    )
    .filter(r => {
      if (activeFilter === 'top') return r.rating >= 4.5;
      if (activeFilter === 'fast') {
        const minTime = parseInt((r.deliveryTime || '0').split('-')[0]);
        return minTime <= 20;
      }
      if (activeFilter === 'free') return r.deliveryFee === 0;
      return true;
    });

  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-4 pt-6 pb-24 bg-[#08080A] min-h-screen text-white">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20 bg-zinc-850" />
          <Skeleton className="h-6 w-48 bg-zinc-850" />
        </div>
        <Skeleton className="h-12 w-full rounded-2xl bg-zinc-850" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-16 min-w-16 rounded-2xl bg-zinc-850" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-3xl bg-zinc-850" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 bg-zinc-850" />
          <Skeleton className="h-64 w-full rounded-[2rem] bg-zinc-850" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-24 bg-[#08080A] min-h-screen text-white">
      {/* Header / Ubicación & QR Code */}
      <div className="flex items-center justify-between gap-3 step-address">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase text-[#FECC01] tracking-widest truncate">Coatepeque, Quetzaltenango</span>
          <Sheet>
            <SheetTrigger
              render={
                <button className="flex items-center gap-1.5 text-white hover:text-zinc-200 group cursor-pointer w-full text-left truncate">
                  <MapPin size={15} className="text-[#FECC01] shrink-0" />
                  <span className="font-extrabold text-sm truncate flex-1">{user?.address || 'Seleccionar ubicación'}</span>
                  <ChevronDown size={14} className="text-[#FECC01] shrink-0" />
                </button>
              }
            />
            <SheetContent side="bottom" className="rounded-t-[2.5rem] bg-[#121214] border-t border-zinc-900 p-8 text-white">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-black italic text-white flex items-center gap-2">
                  ¿A dónde enviamos hoy? ⚡️
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Mis Direcciones Guardadas</p>
                  <div className="space-y-2.5">
                    <Button 
                      variant="ghost" 
                      onClick={useGPS}
                      className="w-full justify-start h-auto p-4 rounded-3xl border border-zinc-800 bg-zinc-900/40 text-white hover:bg-zinc-900"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FECC01] text-black rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(254,204,1,0.2)] animate-pulse">
                          <MapPin size={18} />
                        </div>
                        <div className="text-left">
                          <p className="font-extrabold text-sm">Usar mi GPS</p>
                          <p className="text-xs text-zinc-400">Detectar mi ubicación actual</p>
                        </div>
                      </div>
                    </Button>
                    
                    <Separator className="my-2 bg-zinc-900" />

                    {user?.address && (
                      <Button 
                        variant="ghost" 
                        onClick={() => handleAddressSelect(user.address)}
                        className="w-full justify-start h-auto p-4 rounded-3xl border border-zinc-850 bg-zinc-900 text-white hover:bg-zinc-850"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-800 text-[#FECC01] rounded-2xl flex items-center justify-center">
                            <MapPin size={18} />
                          </div>
                          <div className="text-left">
                            <p className="font-extrabold text-sm">Dirección Actual</p>
                            <p className="text-xs text-zinc-400 truncate max-w-[200px]">{user.address}</p>
                          </div>
                        </div>
                      </Button>
                    )}

                    {user?.favorites?.map(fav => (
                      <Button 
                        key={fav.id}
                        variant="ghost" 
                        onClick={() => handleAddressSelect(fav.address)}
                        className="w-full justify-start h-auto p-4 rounded-3xl border border-zinc-850 bg-zinc-900 text-white hover:bg-zinc-850"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-800 text-[#FECC01] rounded-2xl flex items-center justify-center">
                            {fav.label.toLowerCase() === 'casa' ? <Home size={18} /> : 
                             fav.label.toLowerCase() === 'trabajo' ? <Briefcase size={18} /> : 
                             <MapPin size={18} />}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm">{fav.label}</p>
                            <p className="text-xs text-zinc-400">{fav.address}</p>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
                <Button onClick={() => navigate('/profile')} className="w-full h-12 rounded-3xl bg-[#FECC01] hover:bg-[#ebd534] text-black font-extrabold uppercase text-xs tracking-widest">
                  Gestionar direcciones
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Prominent QR Button */}
        <button
          onClick={() => setIsQrModalOpen(true)}
          className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-[#FECC01] text-white px-3 py-2 rounded-2xl shrink-0 transition-all shadow-md group active:scale-95"
          title="Ver Código QR para entrar al app"
        >
          <div className="w-7 h-7 rounded-xl bg-[#FECC01] text-black flex items-center justify-center font-black group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(254,204,1,0.3)]">
            <QrCode size={15} />
          </div>
          <div className="text-left leading-tight hidden xs:block">
            <span className="text-[9px] font-black uppercase text-[#FECC01] block">Código</span>
            <span className="text-[11px] font-black uppercase text-white block">QR App</span>
          </div>
        </button>
      </div>

      {/* Buscar comida */}
      <div className="relative step-search-bar">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FECC01]">
          <Search size={18} />
        </div>
        <Input 
          placeholder="Buscar restaurantes o comida..." 
          className="pl-11 pr-4 h-12 bg-zinc-900 border-zinc-850 hover:border-zinc-800 rounded-2xl text-white placeholder-zinc-500 focus-visible:ring-[#FECC01] focus-visible:ring-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Global Hours Warning Banner */}
      {!isGlobalOpen && (
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-3xl flex items-center gap-4">
          <div className="w-11 h-11 bg-orange-500/20 rounded-2xl flex items-center justify-center shrink-0">
            <Clock className="text-orange-500" size={20} />
          </div>
          <div className="flex-1">
            <p className="font-black italic text-[#FECC01] text-xs uppercase tracking-widest mb-1">LOCAL OPERA CON RETRASO 🌙</p>
            <p className="text-[10px] font-bold text-zinc-400 uppercase leading-snug">Rayo Delivery abre a las 6:00 AM. Actualmente experimentamos demoras.</p>
          </div>
        </div>
      )}

      {/* Categories Horizontal Selector */}
      <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-2.5 step-categories">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex flex-col items-center gap-1.5 min-w-[68px] transition-transform active:scale-95 ${
                isActive ? 'scale-102' : 'opacity-80'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl transition-all border ${
                isActive ? 'bg-[#FECC01] border-[#FECC01] text-black' : 'bg-zinc-900 border-zinc-850 text-white'
              }`}>
                {cat.icon}
              </div>
              <span className={`text-[10px] uppercase font-black tracking-wider ${isActive ? 'text-[#FECC01]' : 'text-zinc-300'}`}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2.5 overflow-x-auto hide-scrollbar -mx-4 px-4">
        {[
          { id: 'all', label: 'Todos', icon: Filter },
          { id: 'top', label: '⭐ 4.5 o más', icon: Heart },
          { id: 'fast', label: '⏱️ 20 min', icon: Clock },
          { id: 'free', label: 'Envío gratis', icon: Zap },
        ].map((f) => {
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as any)}
              className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-full border text-xs font-extrabold tracking-tight whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-[#FECC01] text-black border-[#FECC01] shadow-md shadow-[#FECC01]/10' 
                  : 'bg-zinc-900 text-zinc-400 border-zinc-850 hover:border-zinc-800'
              }`}
            >
              <f.icon size={13} className={isActive ? 'text-black' : 'text-zinc-500'} />
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Promotional RAYO FLASH Banner */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 rounded-3xl p-5 border border-zinc-800/80 text-white relative overflow-hidden shadow-2xl flex items-center justify-between group">
        {/* Background lightning bolt */}
        <div className="absolute right-[-15px] bottom-[-25px] opacity-15 pointer-events-none text-[#FECC01] group-hover:scale-105 transition-transform duration-500">
          <Zap size={150} fill="#FECC01" />
        </div>
        
        <div className="relative z-10 flex flex-col gap-1.5 max-w-[70%]">
          <div className="flex items-center gap-1.5">
            <span className="bg-[#FECC01] text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">PROMO</span>
            <span className="font-extrabold text-xs tracking-wider text-[#FECC01] uppercase">RAYO FLASH ⚡️</span>
          </div>
          <h3 className="text-xl font-black italic uppercase italic leading-tight tracking-tight">50% DE DESCUENTO EN TU PRIMER PEDIDO</h3>
          <p className="text-[10px] text-zinc-400 font-medium">Aplica cargando código de descuento en el Checkout.</p>
          <button 
            type="button"
            onClick={() => toast.success("Código RAYO50 copiado al portapapeles ⚡️")}
            className="mt-2.5 bg-[#FECC01] hover:bg-[#ebd534] text-black text-[9px] font-black px-4 py-2.5 rounded-full w-fit uppercase tracking-widest transition-transform active:scale-95"
          >
            APROVECHAR
          </button>
        </div>
        
        <div className="w-[80px] h-[80px] shrink-0 rounded-2xl border-2 border-[#FECC01]/30 overflow-hidden relative shadow-inner">
          <img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80" alt="Burgers promo" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Quick link button for logged-in super admin */}
      {user?.role === 'super_admin' && (
        <div className="bg-zinc-900/90 rounded-3xl p-5 flex items-center justify-between border-2 border-[#FECC01]/40 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="bg-[#FECC01] p-2.5 rounded-xl text-black shadow-inner shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-[#FECC01] uppercase tracking-widest leading-none">Super Administrador</p>
              <h4 className="font-black text-sm text-white mt-1">Consola Central de Control</h4>
            </div>
          </div>
          <Button onClick={() => navigate('/profile')} className="rounded-xl h-10 bg-[#FECC01] text-black hover:bg-[#ebd534] px-4 font-black text-xs uppercase tracking-wider shrink-0">
            GESTIONAR
          </Button>
        </div>
      )}

      {/* Restaurants Feed */}
      <div className="flex flex-col gap-4 mt-1">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-black uppercase text-white tracking-tight">Restaurantes cerca de ti</h2>
          <button className="text-[#FECC01] text-xs font-black uppercase tracking-wider hover:underline">Ver todos</button>
        </div>
        
        <div className="grid gap-5">
          {filteredRestaurants.map((res) => (
            <motion.div
              whileTap={{ scale: 0.98 }}
              key={res.id}
              onClick={() => navigate(`/restaurant/${res.id}`)}
              className="bg-[#161619] rounded-3xl overflow-hidden shadow-md border border-zinc-900/80 group cursor-pointer transition-all hover:border-zinc-800"
            >
              <div className="relative h-44 overflow-hidden">
                <img 
                  src={res.image} 
                  alt={res.name} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-102"
                  referrerPolicy="no-referrer"
                />
                
                {/* Score badge & Hidden/Oculto badge */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {res.isHidden && (
                    <div className="bg-red-600 backdrop-blur-md px-2.5 py-1 rounded-xl flex items-center border border-red-500 shadow-xl">
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">Oculto</span>
                    </div>
                  )}
                  <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl flex items-center gap-1 border border-zinc-800 shadow-xl">
                    <Star size={13} className="text-[#FECC01] fill-[#FECC01]" />
                    <span className="text-xs font-extrabold text-white">{res.rating}</span>
                  </div>
                </div>

                {/* Edit Button for admins & owners */}
                {(user?.role === 'super_admin' || (user?.email && res.ownerEmail?.toLowerCase() === user.email.toLowerCase()) || (user?.role === 'admin' && user?.restaurantId === res.id)) && (
                  <button 
                    onClick={(e) => handleEditRestaurant(res, e)}
                    className="absolute top-4 left-4 bg-[#FECC01] text-black p-2 rounded-xl shadow-lg border-2 border-zinc-900 transition-transform active:scale-90"
                  >
                    <Edit2 size={14} strokeWidth={3} />
                  </button>
                )}

                {/* Closed overlay */}
                {!isOpen(res) && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-xs">
                    <div className="bg-red-600 text-white px-5 py-1.5 rounded-full font-black text-sm shadow-2xl uppercase tracking-widest -rotate-6 border border-red-500 scale-102">
                      CERRADO MIENTRAS TANTO
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4.5 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <h3 className="text-base font-extrabold text-white leading-tight notranslate" translate="no">{res.name}</h3>
                  <div className="flex items-center gap-1 text-zinc-400 text-xs font-bold bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-850">
                    <Clock size={12} className="text-[#FECC01]" />
                    <span>{res.deliveryTime}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <div className="flex flex-wrap gap-1">
                    {(res.categories || []).filter(c => c !== 'comida').map(c => (
                      <span key={c} className="text-[9px] font-black uppercase bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md capitalize">
                        {c}
                      </span>
                    ))}
                  </div>
                  {res.openingTime && res.closingTime && (
                    <span className="text-[9px] text-[#FECC01] font-black uppercase bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md tracking-wider">
                      Abierto: {res.openingTime} - {res.closingTime}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {filteredRestaurants.length === 0 && (
            <div className="py-12 text-center text-zinc-500">
              <ShoppingBag className="mx-auto text-zinc-650 opacity-40 mb-3" size={40} />
              <p className="font-bold text-sm uppercase tracking-wider">No se encontraron comercios</p>
              <p className="text-xs text-zinc-650 mt-1">Prueba seleccionando otra categoría o limpiando filtros</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Restaurant Dialog */}
      <Dialog open={!!editingRestaurant} onOpenChange={(open) => !open && setEditingRestaurant(null)}>
        <DialogContent className="rounded-[2.5rem] bg-[#121214] border-zinc-850 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic text-white">Modificar Comercio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-2 overflow-y-auto max-h-[60vh] hide-scrollbar text-white">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Nombre del Local</Label>
              <Input 
                value={editFormData.name}
                onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400 px-1">Imagen de Portada</Label>
              <div className="flex gap-2 items-center">
                <Input 
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="rounded-xl border-zinc-800 bg-zinc-900 text-white flex-1 h-12 pt-3 text-xs"
                />
                {editFormSubImage(editFormData.image)}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Dirección</Label>
              <Input 
                value={editFormData.address}
                onChange={e => setEditFormData({...editFormData, address: e.target.value})}
                className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Apertura</Label>
                <Input 
                  type="time"
                  value={editFormData.openingTime}
                  onChange={e => setEditFormData({...editFormData, openingTime: e.target.value})}
                  className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Cierre</Label>
                <Input 
                  type="time"
                  value={editFormData.closingTime}
                  onChange={e => setEditFormData({...editFormData, closingTime: e.target.value})}
                  className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Tiempo de Entrega</Label>
              <Input 
                value={editFormData.deliveryTime}
                onChange={e => setEditFormData({...editFormData, deliveryTime: e.target.value})}
                placeholder="20-30 min"
                className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
              />
            </div>
            <Button 
              onClick={handleSaveRestaurant} 
              disabled={isSaving}
              className="w-full h-12 rounded-3xl bg-[#FECC01] hover:bg-[#ebd534] text-black font-extrabold uppercase tracking-widest mt-2"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AppQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        restaurants={restaurants}
      />
    </div>
  );
};

// Simple helper to avoid code duplication in image display
const editFormSubImage = (image: string | undefined) => {
  if (!image) return null;
  return <img src={image} className="w-12 h-12 rounded-xl object-cover border-2 border-[#FECC01] shadow-sm shrink-0" referrerPolicy="no-referrer" />;
};

export default Explore;
