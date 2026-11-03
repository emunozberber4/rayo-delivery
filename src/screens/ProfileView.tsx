import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, MapPin, CreditCard, Bell, Shield, ShieldCheck, 
  LogOut, ChevronRight, Plus, Trash2, Home, Briefcase, 
  Store, Bike, DollarSign, Package, CheckCircle, RefreshCcw, 
  ChefHat, Star, Moon, Sun, Heart, History, TrendingUp, 
  MessageCircle, LayoutDashboard, Settings, Calendar, 
  Sparkles, Scan, QrCode, AlertTriangle, X 
} from 'lucide-react';
import { useApp } from '@/store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { AppQrModal } from '@/components/AppQrModal';
import { PwaInstallGuideModal } from '@/components/PwaInstallGuideModal';
import { AuthModal } from '@/components/AuthModal';
import { FaceScanModal } from '@/components/FaceScanModal';
import { compressAndResizeImage } from '@/lib/images';

export const ProfileView = () => {
  const navigate = useNavigate();
  const { 
    user, login, orders, logout, updateUser, reorder, 
    toggleTheme, restaurants, registerRestaurant, 
    applyAsRider, saveFaceVerification
  } = useApp();

  const [newLabel, setNewLabel] = React.useState('');
  const [newAddr, setNewAddr] = React.useState('');
  const [showPartnerForm, setShowPartnerForm] = React.useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = React.useState(false);
  const [qrModalTab, setQrModalTab] = React.useState<'app' | 'restaurant' | 'table'>('app');
  const [showMainPwaGuide, setShowMainPwaGuide] = React.useState(false);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [showFaceModal, setShowFaceModal] = React.useState(false);

  const [partnerData, setPartnerData] = React.useState({ 
    name: '', 
    image: '', 
    category: 'comida',
    address: '',
    addressReference: '',
    location: [14.6349, -90.5069] as [number, number],
    openingTime: '08:00',
    closingTime: '22:00'
  });

  const handleRegisterPartner = async () => {
    if (!partnerData.name || !partnerData.image || !partnerData.address) {
      toast.error("Nombre, imagen y dirección son obligatorios");
      return;
    }
    
    await registerRestaurant({
      name: partnerData.name,
      image: partnerData.image,
      categories: [partnerData.category],
      address: partnerData.address,
      addressReference: partnerData.addressReference,
      location: partnerData.location,
      openingTime: partnerData.openingTime,
      closingTime: partnerData.closingTime
    });
    setShowPartnerForm(false);
    toast.success("¡Comercio registrado con éxito!");
  };

  const handlePartnerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressAndResizeImage(file);
        setPartnerData(prev => ({ ...prev, image: compressed }));
        toast.success("Imagen de comercio lista ✨");
      } catch (err) {
        toast.error("Error al procesar la imagen");
      }
    }
  };

  const handleAddAddress = () => {
    if (!newLabel || !newAddr) {
      toast.error("Debes ingresar una etiqueta y la dirección");
      return;
    }
    const currentFavs = user?.favorites || [];
    const newFav = { id: Date.now().toString(), label: newLabel, address: newAddr };
    updateUser({ favorites: [...currentFavs, newFav] });
    setNewLabel('');
    setNewAddr('');
    toast.success("Dirección favorita guardada ✔️");
  };

  const handleDeleteAddress = (id: string) => {
    const currentFavs = user?.favorites || [];
    updateUser({ favorites: currentFavs.filter(f => f.id !== id) });
    toast.success("Dirección eliminada");
  };

  if (!user || !user.isLoggedIn) {
    return (
      <div className="px-6 pt-16 pb-32 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 text-[#FECC01] rounded-3xl flex items-center justify-center mb-6 shadow-xl">
          <User size={36} />
        </div>
        <h2 className="text-2xl font-black italic text-white uppercase mb-2">Mi Cuenta Rayo</h2>
        <p className="text-xs text-zinc-400 max-w-xs mb-8 font-medium">
          Inicia sesión para guardar tus direcciones favoritas, repetir pedidos y gestionar tu perfil.
        </p>
        <Button
          onClick={() => setShowAuthModal(true)}
          className="w-full max-w-xs h-14 bg-[#FECC01] hover:bg-[#ebd534] text-black font-black uppercase rounded-2xl text-sm shadow-xl active:scale-95 transition-all"
        >
          Iniciar Sesión / Registrarme
        </Button>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  const favoriteRestaurants = restaurants.filter(r => (user.favoriteRestaurantIds || []).includes(r.id));
  const myOrders = orders.filter(o => o.userId === user.uid);
  const isPrivilegedUser = user.role === 'super_admin' || user.role === 'admin' || !!user.restaurantId;
  const isRiderUser = user.role === 'rider';

  return (
    <div className="px-6 pt-12 pb-32 dark:bg-gray-950 min-h-screen transition-colors duration-300">
      {/* User Header Profile */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative">
          <Avatar className="w-24 h-24 border-4 border-zinc-800 shadow-xl overflow-hidden">
            <AvatarImage src={user.facePhotoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} referrerPolicy="no-referrer" className="object-cover" />
            <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="absolute bottom-0 right-0 bg-[#FECC01] text-black p-1.5 rounded-full border-2 border-zinc-900 shadow-lg">
            {user.role === 'super_admin' ? <Shield size={14} /> : user.role === 'admin' ? <Store size={14} /> : user.role === 'rider' ? <Bike size={14} /> : <User size={14} />}
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white italic">{user.name}</h2>
            <Badge variant="secondary" className="capitalize text-[10px] font-bold tracking-widest">{user.role}</Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{user.email}</p>

          {/* Biometric Verification Badge */}
          <div className="w-full max-w-sm mx-auto mt-4">
            {user.faceVerified && user.facePhotoUrl ? (
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-emerald-400 shrink-0">
                    <img src={user.facePhotoUrl} alt="Face ID" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black uppercase text-emerald-300 flex items-center gap-1">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      Rostro Identificado
                    </span>
                    <p className="text-[9px] text-zinc-400 font-mono">
                      {user.faceBiometricId || 'BIO-VERIFICADO'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFaceModal(true)}
                  className="border-emerald-500/40 text-emerald-300 hover:text-white hover:bg-emerald-900/30 text-[10px] font-bold h-8 rounded-xl"
                >
                  <Scan size={12} className="mr-1" />
                  Actualizar
                </Button>
              </div>
            ) : (
              <div className="bg-[#FECC01]/10 border border-[#FECC01]/40 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 text-left">
                  <div className="w-9 h-9 rounded-xl bg-[#FECC01]/20 text-[#FECC01] flex items-center justify-center shrink-0">
                    <Scan size={18} className="animate-pulse" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase text-[#FECC01]">
                      Rostro no verificado
                    </span>
                    <p className="text-[9px] text-zinc-400">Escanea para mayor seguridad</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowFaceModal(true)}
                  className="bg-[#FECC01] text-black hover:bg-[#ebd534] text-[10px] font-black h-8 rounded-xl uppercase"
                >
                  Verificar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role Navigation Cards */}
      {isPrivilegedUser && (
        <div 
          onClick={() => navigate('/admin')}
          className="bg-gradient-to-r from-zinc-900 to-zinc-950 border-2 border-[#FECC01] p-5 rounded-[2rem] shadow-xl mb-6 flex items-center justify-between gap-4 cursor-pointer hover:scale-[1.02] transition-transform active:scale-95"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FECC01] text-black flex items-center justify-center font-black shrink-0 shadow-[0_0_15px_rgba(254,204,1,0.3)]">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h4 className="font-black italic text-white text-sm uppercase leading-tight">
                Panel de Administración ⚡
              </h4>
              <p className="text-[10px] font-bold text-zinc-400">
                Gestionar pedidos, menú, sucursales y finanzas
              </p>
            </div>
          </div>
          <ChevronRight className="text-[#FECC01]" />
        </div>
      )}

      {isRiderUser && (
        <div 
          onClick={() => navigate('/rider')}
          className="bg-gradient-to-r from-zinc-900 to-zinc-950 border-2 border-emerald-500/50 p-5 rounded-[2rem] shadow-xl mb-6 flex items-center justify-between gap-4 cursor-pointer hover:scale-[1.02] transition-transform active:scale-95"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-black flex items-center justify-center font-black shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <Bike size={24} />
            </div>
            <div>
              <h4 className="font-black italic text-white text-sm uppercase leading-tight">
                Panel de Repartidor ⚡
              </h4>
              <p className="text-[10px] font-bold text-zinc-400">
                Activar turno, aceptar pedidos y entregas
              </p>
            </div>
          </div>
          <ChevronRight className="text-emerald-400" />
        </div>
      )}

      {/* Client Quick Action Cards */}
      {user.role === 'client' && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button 
            variant="outline"
            onClick={async () => {
              await applyAsRider();
              toast.success("Solicitud de repartidor enviada a revisión");
            }}
            className="h-24 rounded-[2rem] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-800 bg-zinc-900 hover:border-[#FECC01]/50 text-white transition-all"
          >
            <Bike className="text-[#FECC01]" size={24} />
            <span className="text-[10px] font-black uppercase">Ser Repartidor</span>
          </Button>

          <Button 
            variant="outline"
            onClick={() => setShowPartnerForm(true)}
            className="h-24 rounded-[2rem] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#FECC01]/40 bg-[#FECC01]/5 text-[#FECC01] hover:bg-[#FECC01]/10 transition-all"
          >
            <Store className="text-[#FECC01]" size={24} />
            <span className="text-[10px] font-black uppercase text-center leading-tight">Registrar Mi Negocio</span>
          </Button>
        </div>
      )}

      {/* QR Code App Quick Access */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[2rem] shadow-xl mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#FECC01] text-black flex items-center justify-center font-black shrink-0">
            <QrCode size={24} />
          </div>
          <div>
            <h4 className="font-black italic text-white text-sm uppercase leading-tight">
              Código QR de la App
            </h4>
            <p className="text-[10px] font-bold text-zinc-400">
              Escanea para ordenar desde tu móvil
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setQrModalTab('app');
            setIsQrModalOpen(true);
          }}
          className="bg-[#FECC01] hover:bg-[#FECC01]/90 text-black font-black text-xs uppercase rounded-xl h-10 px-3 shrink-0 shadow-md active:scale-95 transition-all"
        >
          Ver QR ⚡
        </Button>
      </div>

      {/* Favorite Restaurants */}
      {favoriteRestaurants.length > 0 && (
        <div className="space-y-4 mb-8">
          <h3 className="font-black italic px-2 text-white flex items-center gap-2">
            <Heart size={18} className="text-[#FECC01] fill-current" /> Restaurantes Favoritos
          </h3>
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex gap-4">
              {favoriteRestaurants.map(rest => (
                <div 
                  key={rest.id} 
                  onClick={() => navigate(`/restaurant/${rest.id}`)}
                  className="w-40 shrink-0 bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-sm cursor-pointer hover:border-[#FECC01]/50 transition-all"
                >
                  <img src={rest.image} className="h-24 w-full object-cover" referrerPolicy="no-referrer" />
                  <div className="p-3">
                    <p className="font-bold text-xs truncate text-white notranslate" translate="no">{rest.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={10} className="fill-yellow-500 text-yellow-500" />
                      <span className="text-[10px] font-bold text-zinc-300">{rest.rating}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Favorite Addresses */}
      <div className="space-y-4 mb-8">
        <h3 className="font-black italic px-2 text-white">Direcciones Favoritas</h3>
        <div className="bg-zinc-900 rounded-[2rem] p-6 shadow-sm border border-zinc-800 space-y-4">
          <div className="space-y-3">
            {(user.favorites || []).map(fav => (
              <div key={fav.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">
                    {fav.label.toLowerCase() === 'casa' ? <Home size={16} /> : 
                     fav.label.toLowerCase() === 'trabajo' ? <Briefcase size={16} /> : 
                     <MapPin size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{fav.label}</p>
                    <p className="text-[10px] text-zinc-400">{fav.address}</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleDeleteAddress(fav.id)}
                  className="text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>

          <Separator className="bg-zinc-800" />

          {/* Add Address Form */}
          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Agregar Nueva Dirección</p>
            <div className="grid grid-cols-2 gap-2">
              <Input 
                placeholder="Etiqueta (ej: Casa, Trabajo)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="bg-black border-zinc-700 text-white rounded-xl h-10 text-xs"
              />
              <Input 
                placeholder="Dirección completa"
                value={newAddr}
                onChange={e => setNewAddr(e.target.value)}
                className="bg-black border-zinc-700 text-white rounded-xl h-10 text-xs"
              />
            </div>
            <Button 
              onClick={handleAddAddress}
              className="w-full bg-[#FECC01] hover:bg-[#ebd534] text-black font-black uppercase text-xs rounded-xl h-10"
            >
              + Guardar Dirección
            </Button>
          </div>
        </div>
      </div>

      {/* Order History */}
      {myOrders.length > 0 && (
        <div className="space-y-4 mb-8">
          <h3 className="font-black italic px-2 text-white flex items-center gap-2">
            <History size={18} className="text-[#FECC01]" /> Historial de Mis Pedidos
          </h3>
          <div className="space-y-3">
            {myOrders.slice(0, 5).map(o => (
              <div key={o.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black italic text-[#FECC01]">#{o.shortId}</span>
                    <Badge className="bg-zinc-800 text-zinc-300 text-[8px] font-bold uppercase">{o.status}</Badge>
                  </div>
                  <p className="text-xs font-bold text-white mt-1">{o.restaurantName}</p>
                  <p className="text-[10px] text-zinc-400">Total: Q{o.total.toFixed(2)}</p>
                </div>
                <Button 
                  size="sm"
                  onClick={() => reorder(o.id)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-[#FECC01] font-black text-xs rounded-xl h-9"
                >
                  <RefreshCcw size={12} className="mr-1" /> Repetir
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WhatsApp Contact Setup */}
      <div className="bg-zinc-900 rounded-[2.5rem] shadow-sm border border-zinc-800 p-6 mb-8">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle size={18} className="text-[#FECC01]" />
          <h3 className="font-black italic text-sm text-white uppercase">Contacto WhatsApp</h3>
        </div>
        <p className="text-[10px] text-zinc-400 mb-4 font-bold leading-tight">
          Número para recibir confirmaciones de tus pedidos por WhatsApp:
        </p>
        <div className="relative">
          <Input 
            placeholder="Número de WhatsApp (con 502)"
            value={user.whatsapp || ''}
            onChange={(e) => updateUser({ whatsapp: e.target.value })}
            className="h-12 rounded-2xl bg-black border-zinc-700 text-xs font-bold text-white"
          />
        </div>
      </div>

      {/* PWA Phone Installation Widget */}
      <div className="bg-gradient-to-br from-[#FECC01]/15 via-zinc-900 to-zinc-950 p-5 rounded-[2.5rem] border-2 border-[#FECC01]/40 shadow-xl space-y-3 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FECC01] text-black flex items-center justify-center font-black shadow-md shadow-[#FECC01]/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="font-black italic text-sm text-white uppercase tracking-tight">
                Instalar App en Celular 📲
              </h4>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                Acceso Permanente en Pantalla
              </p>
            </div>
          </div>
          <Badge className="bg-[#FECC01] text-black text-[9px] font-black uppercase">PWA</Badge>
        </div>
        <Button
          onClick={() => setShowMainPwaGuide(true)}
          className="w-full bg-[#FECC01] hover:bg-[#FECC01]/90 text-black font-black uppercase tracking-wider text-xs rounded-2xl h-11 flex items-center justify-center gap-2 shadow-lg shadow-[#FECC01]/20 active:scale-95 transition-all"
        >
          📲 Ver Cómo Instalar en Teléfono
        </Button>
      </div>

      {/* Logout Button */}
      <Button 
        variant="ghost" 
        onClick={() => logout()}
        className="w-full h-14 rounded-2xl text-rose-500 font-bold flex items-center justify-center gap-2 hover:bg-rose-950/20"
      >
        <LogOut size={20} />
        Cerrar Sesión
      </Button>

      {/* Partner Registration Modal */}
      <AnimatePresence>
        {showPartnerForm && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-zinc-900 p-6 rounded-[2.5rem] shadow-2xl border-2 border-[#FECC01]/30 w-full max-w-lg my-8 space-y-4 max-h-[90vh] overflow-y-auto text-white"
            >
              <div className="flex justify-between items-center border-b pb-3 border-zinc-800">
                <div className="flex items-center gap-2">
                  <Store className="text-[#FECC01]" size={22} />
                  <h3 className="font-black italic uppercase tracking-tight">Registro de Nuevo Comercio</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowPartnerForm(false)} className="rounded-full text-zinc-400">
                  <X size={20} />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase text-zinc-400">Nombre del Local</p>
                  <Input 
                    placeholder="Ej: Taquería El Rayo" 
                    value={partnerData.name}
                    onChange={e => setPartnerData({ ...partnerData, name: e.target.value })}
                    className="h-11 rounded-xl bg-black border-zinc-700 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase text-zinc-400">Dirección Física</p>
                  <Input 
                    placeholder="Ej: 3ra Calle 4-12, Zona 1" 
                    value={partnerData.address}
                    onChange={e => setPartnerData({ ...partnerData, address: e.target.value })}
                    className="h-11 rounded-xl bg-black border-zinc-700 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase text-zinc-400">Foto de Portada</p>
                  <Input 
                    type="file"
                    accept="image/*"
                    onChange={handlePartnerImageUpload}
                    className="h-11 rounded-xl bg-black border-zinc-700 text-white"
                  />
                </div>

                <Button 
                  onClick={handleRegisterPartner} 
                  className="w-full h-14 rounded-2xl bg-[#FECC01] hover:bg-[#ebd534] text-black font-black text-base uppercase tracking-wider shadow-xl active:scale-95 transition-transform mt-4"
                >
                  Guardar y Registrar Negocio ⚡
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AppQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        defaultTab={qrModalTab}
        restaurants={restaurants}
      />

      <PwaInstallGuideModal
        isOpen={showMainPwaGuide}
        onClose={() => setShowMainPwaGuide(false)}
      />

      <FaceScanModal
        isOpen={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        onSuccess={(photo) => saveFaceVerification(photo)}
        userName={user?.name || 'Usuario'}
        userEmail={user?.email}
      />
    </div>
  );
};

export default ProfileView;
