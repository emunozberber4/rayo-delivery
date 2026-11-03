import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Clock, Plus, ShoppingBag, Minus, Heart, Trash2, Edit2, Store, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/store';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Product } from '@/types';
import { db } from '@/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { AppQrModal } from '@/components/AppQrModal';

const RestaurantView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, cart, user, toggleFavoriteRestaurant, restaurants, addMenuItem, updateMenuItem, deleteMenuItem } = useApp();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productNotes, setProductNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [firestoreMenu, setFirestoreMenu] = useState<Product[]>([]);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    description: '',
    category: 'Comida',
    image: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
  const [editProductForm, setEditProductForm] = useState({
    name: '',
    price: '',
    description: '',
    category: 'Comida',
    image: ''
  });
  const [activeSubCategory, setActiveSubCategory] = useState('todo');

  const isFavorite = user?.favoriteRestaurants?.includes(id || '');
  const restaurant = restaurants.find(r => r.id === id);
  const isApproved = restaurant?.isApproved !== false || user?.role === 'super_admin';

  const userEmail = user?.email?.toLowerCase().trim();
  const isAllowedRayo = userEmail === 'emunozberber4@gmail.com' || userEmail === 'emunozberber@gmail.com';
  const isRayoBurguer = restaurant?.id === 'r_rayo_burguer' || restaurant?.name?.toLowerCase().includes('rayo burguer');

  const canManageRestaurant = Boolean(
    isRayoBurguer 
      ? isAllowedRayo
      : (
          user?.role === 'super_admin' || 
          (userEmail && restaurant?.ownerEmail?.toLowerCase() === userEmail) ||
          (userEmail && restaurant?.ownerEmails && restaurant.ownerEmails.map(e => e.toLowerCase()).includes(userEmail)) ||
          (user?.role === 'admin' && user?.restaurantId === restaurant?.id) ||
          user?.ownedRestaurantIds?.includes(restaurant?.id || '')
        )
  );

  const isOpen = () => {
    if (isRayoBurguer) return true;
    if (restaurant?.isOpen === false) return false;
    if (restaurant?.isOpen === true && (!restaurant?.openingTime || restaurant?.openingTime === '00:00')) return true;
    if (!restaurant?.openingTime || !restaurant?.closingTime) return true;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return currentTime >= restaurant.openingTime && currentTime <= restaurant.closingTime;
  };

  React.useEffect(() => {
    if (id && isApproved) {
      const unsub = onSnapshot(collection(db, 'restaurants', id, 'menu'), (snap) => {
        setFirestoreMenu(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      });
      return () => unsub();
    }
  }, [id, isApproved]);

  if (!restaurant || !isApproved) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-8 text-center gap-4 text-white">
      <div className="w-20 h-20 bg-zinc-900 rounded-[2.5rem] flex items-center justify-center text-[#FECC01] shadow-[0_0_15px_rgba(254,204,1,0.1)]">
        <Store size={40} />
      </div>
      <h2 className="text-xl font-black italic uppercase tracking-widest text-[#FECC01]">Comercio no disponible</h2>
      <p className="text-xs text-zinc-400 font-medium">Este comercio se encuentra en revisión o no está disponible en este momento.</p>
      <Button onClick={() => navigate('/explore')} className="rounded-3xl bg-[#FECC01] hover:bg-[#ebd534] text-black px-8 font-black uppercase text-xs">Volver a Restaurantes</Button>
    </div>
  );

  const displayMenu = [...(restaurant.menu || []), ...firestoreMenu];

  // Dynamically group items into categories to support Horizontal sub-selection bar
  const subCategories = ['todo', ...Array.from(new Set(displayMenu.map(p => p.category || 'Comida')))];

  const filteredMenu = displayMenu.filter(p => {
    if (activeSubCategory === 'todo') return true;
    return (p.category || 'Comida') === activeSubCategory;
  });

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductNotes('');
    setQuantity(1);
  };

  const handleConfirmAdd = () => {
    if (!selectedProduct) return;
    
    if (!isOpen()) {
      toast.error("El comercio está cerrado en este momento", {
        description: `Horario: ${restaurant.openingTime} - ${restaurant.closingTime}`
      });
      return;
    }
    
    // Add quantity count
    for(let i = 0; i < quantity; i++) {
      addToCart(selectedProduct, restaurant.id, restaurant.name, productNotes);
    }

    toast.success(`${selectedProduct.name} agregado x${quantity} 🍔`, {
      description: "Revisa tu carrito para procesar el pedido.",
    });

    setSelectedProduct(null);
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
        setNewProduct({ ...newProduct, image: reader.result as string });
        toast.success("Imagen cargada");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateProduct = async () => {
    if (!id || !newProduct.name || !newProduct.price) {
      toast.error("Nombre y precio son obligatorios");
      return;
    }
    setIsAddingProduct(true);
    try {
      await addMenuItem(id, {
        name: newProduct.name,
        price: parseFloat(newProduct.price),
        description: newProduct.description || 'Producto delicioso recién preparado.',
        category: newProduct.category || 'Comida',
        image: newProduct.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80'
      });
      toast.success("Producto agregado al menú");
      setNewProduct({ name: '', price: '', description: '', category: 'Comida', image: '' });
      setShowAddForm(false);
    } catch (error) {
      toast.error("Error al agregar producto");
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!id) return;
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    try {
      await deleteMenuItem(id, productId);
      toast.success("Producto eliminado");
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleEditImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) {
        toast.error("La imagen es muy pesada (máx 800KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditProductForm(prev => ({ ...prev, image: reader.result as string }));
        toast.success("Imagen cargada");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProduct = async () => {
    if (!id || !editingProduct || !editProductForm.name || !editProductForm.price) {
      toast.error("Nombre y precio son obligatorios");
      return;
    }
    const priceNum = parseFloat(editProductForm.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("El precio debe ser un número válido mayor a 0");
      return;
    }

    setIsUpdatingProduct(true);
    try {
      await updateMenuItem(id, editingProduct.id, {
        name: editProductForm.name,
        price: priceNum,
        description: editProductForm.description || editingProduct.description || 'Producto delicioso.',
        category: editProductForm.category || editingProduct.category || 'Comida',
        image: editProductForm.image || editingProduct.image
      });
      toast.success("¡Producto y precio actualizados con éxito! 🍔⚡");
      setEditingProduct(null);
    } catch (e) {
      toast.error("Error al actualizar producto");
    } finally {
      setIsUpdatingProduct(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#08080A] text-white pb-32">
      {/* Dynamic item configuration modal */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-zinc-850 bg-[#121214] text-white shadow-2xl">
          {selectedProduct && (
            <div className="flex flex-col text-white">
              <div className="h-48 relative">
                <img src={selectedProduct.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-4 left-6">
                  <DialogTitle className="text-white text-xl font-black italic">{selectedProduct.name}</DialogTitle>
                  <p className="text-zinc-300 text-xs font-medium line-clamp-1 mt-1">{selectedProduct.description}</p>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="product-notes" className="text-xs font-black uppercase text-zinc-400 tracking-widest ml-1">Instrucciones especiales</Label>
                  <Textarea 
                    id="product-notes"
                    placeholder="Ej / Sin cebolla, aderezo extra, bien cocido..."
                    value={productNotes}
                    onChange={(e) => setProductNotes(e.target.value)}
                    className="rounded-2xl border-zinc-850 bg-zinc-900 resize-none h-24 text-xs text-white placeholder-zinc-500 focus-visible:ring-[#FECC01]"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-3 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-850 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 rounded-xl hover:bg-zinc-800 text-white"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    >
                      <Minus size={16} />
                    </Button>
                    <span className="font-extrabold text-lg w-6 text-center text-[#FECC01]">{quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 rounded-xl hover:bg-zinc-800 text-[#FECC01]"
                      onClick={() => setQuantity(q => q + 1)}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>

                  <Button 
                    onClick={handleConfirmAdd}
                    className="flex-1 h-14 bg-[#FECC01] hover:bg-[#ebd534] text-black rounded-[1.25rem] flex justify-between px-6 font-extrabold text-base shadow-[0_4px_15px_rgba(254,204,1,0.2)] active:scale-95 transition-transform"
                  >
                    <span className="font-black italic">AGREGAR</span>
                    <span className="font-black">Q{(selectedProduct.price * quantity).toFixed(2)}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hero Header Area */}
      <div className="relative h-60">
        <img 
          src={restaurant.image} 
          alt={restaurant.name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-[#08080A]" />
        
        <div className="absolute top-6 left-6 right-6 flex justify-between z-20">
          <button 
            type="button"
            onClick={() => navigate('/explore')}
            className="w-10 h-10 bg-black/70 hover:bg-black/90 backdrop-blur-md rounded-full flex items-center justify-center border border-zinc-900 shadow-md text-white transition-transform active:scale-95"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>

          <button 
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            className="w-10 h-10 bg-black/70 hover:bg-black/90 backdrop-blur-md rounded-full flex items-center justify-center border border-zinc-900 shadow-md text-white hover:text-[#FECC01] transition-transform active:scale-90"
            title="Ver Código QR del Menú"
          >
            <QrCode size={18} />
          </button>

          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteRestaurant(restaurant.id);
            }}
            className={`w-10 h-10 bg-black/70 hover:bg-black/90 backdrop-blur-md rounded-full flex items-center justify-center border border-zinc-900 shadow-md transition-transform active:scale-90 ${isFavorite ? 'text-[#FECC01]' : 'text-zinc-400'}`}
          >
            <Heart size={18} className={isFavorite ? 'fill-current' : ''} />
          </button>
        </div>
      </div>

      {/* Info Card Panel */}
      <div className="px-5 -mt-16 relative z-10">
        <div className="bg-[#161619] rounded-[2.5rem] p-5.5 border border-zinc-900 shadow-2xl flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h1 className="text-xl font-black text-white leading-tight notranslate" translate="no">{restaurant.name}</h1>
              <div className="flex flex-wrap gap-2 items-center text-xs ml-0.5">
                <div className="flex items-center gap-1 text-yellow-400 font-bold">
                  <Star size={13} className="fill-current" />
                  <span>{restaurant.rating}</span>
                </div>
                <span className="text-zinc-700">•</span>
                <div className="flex items-center gap-1 text-zinc-400 font-medium">
                  <Clock size={13} className="text-[#FECC01]" />
                  <span>{restaurant.deliveryTime}</span>
                </div>
                <span className="text-zinc-700">•</span>
                <div className={`flex items-center gap-1 font-bold ${isOpen() ? 'text-emerald-500' : 'text-red-500'}`}>
                  <span>{isOpen() ? 'Abierto' : 'Cerrado'}</span>
                  {restaurant.openingTime && restaurant.closingTime && (
                    <span className="text-[9px] opacity-90 font-bold text-zinc-300">({restaurant.openingTime} - {restaurant.closingTime})</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-[#FECC01] text-black p-2.5 rounded-2xl shadow-inner shrink-0">
              <ShoppingBag size={20} />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-zinc-900">
            {restaurant.categories.map(c => (
              <span key={c} className="text-[9px] font-black uppercase bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-md tracking-wider">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Horizontal Sub-Category Navigation Bar */}
      <div className="flex gap-2.5 overflow-x-auto hide-scrollbar px-6 mt-6 pb-2 border-b border-zinc-900">
        {subCategories.map((sub) => {
          const isActive = activeSubCategory === sub;
          return (
            <button
              key={sub}
              onClick={() => setActiveSubCategory(sub)}
              className="relative py-1.5 px-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-wide transition-colors"
            >
              <span className={isActive ? 'text-[#FECC01]' : 'text-zinc-350 hover:text-white'}>
                {sub === 'todo' ? 'Todos los platos' : sub}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="activeSubcategoryUnderline"
                  className="absolute bottom-[-9px] left-0 right-0 h-[3px] bg-[#FECC01] rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Menu List */}
      <div className="mt-5 px-5 flex flex-col gap-6">
        <div>
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-[#FECC01] rounded-full" />
              Menú principal
            </h2>
            
            {canManageRestaurant && (
              <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
                <DialogTrigger
                  render={
                    <Button size="sm" className="rounded-full gap-1.5 bg-[#FECC01] hover:bg-[#ebd534] text-black h-8 px-3 text-[10px] font-black">
                      <Plus size={14} strokeWidth={3} /> AGREGAR ITEMS
                    </Button>
                  }
                />
                <DialogContent className="rounded-[2.5rem] bg-[#121214] border-zinc-850 text-white sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black italic text-white text-center">Nuevo Plato</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 p-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Nombre</Label>
                      <Input 
                        value={newProduct.name}
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                        className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Precio (Q)</Label>
                      <Input 
                        type="number"
                        value={newProduct.price}
                        onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                        className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Categoría</Label>
                      <Input 
                        value={newProduct.category}
                        onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                        placeholder="Ej: Hamburguesas, Bebidas..."
                        className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Descripción</Label>
                      <Textarea 
                        value={newProduct.description}
                        onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                        className="rounded-xl border-zinc-800 bg-zinc-900 text-white h-20 resize-none text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400 px-1">Imagen del Producto</Label>
                      <div className="flex gap-2 items-center">
                        <Input 
                          type="file"
                          accept="image/*"
                          onChange={handleImageFile}
                          className="rounded-xl border-zinc-800 bg-zinc-900 text-white flex-1 h-12 pt-3 text-xs"
                        />
                        {newProduct.image && <img src={newProduct.image} className="w-12 h-12 rounded-xl object-cover border-2 border-[#FECC01] shadow-sm shrink-0" referrerPolicy="no-referrer" />}
                      </div>
                    </div>
                    <Button 
                      onClick={handleCreateProduct} 
                      disabled={isAddingProduct}
                      className="w-full h-12 rounded-3xl bg-[#FECC01] hover:bg-[#ebd534] text-black font-extrabold uppercase tracking-widest mt-2"
                    >
                      {isAddingProduct ? 'Creando...' : 'Crear Producto'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Admin Edit Product and Price Dialog */}
            {canManageRestaurant && (
              <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] p-6 border-zinc-800 bg-[#121214] text-white shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-extrabold italic uppercase tracking-wider text-sm flex items-center gap-2 text-[#FECC01]">
                      <Edit2 size={16} />
                      Editar Plato y Precio
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Nombre del Plato</Label>
                      <Input 
                        value={editProductForm.name} 
                        onChange={e => setEditProductForm({...editProductForm, name: e.target.value})}
                        className="rounded-xl border-zinc-800 bg-zinc-900 text-white font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Precio en Quetzales (Q)</Label>
                      <Input 
                        type="number"
                        step="0.5"
                        value={editProductForm.price} 
                        onChange={e => setEditProductForm({...editProductForm, price: e.target.value})}
                        className="rounded-xl border-zinc-800 bg-zinc-900 text-white font-bold text-base"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Categoría</Label>
                      <Input 
                        value={editProductForm.category} 
                        onChange={e => setEditProductForm({...editProductForm, category: e.target.value})}
                        placeholder="Ej: Hamburguesas, Bebidas, Combos..."
                        className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Descripción</Label>
                      <Textarea 
                        value={editProductForm.description}
                        onChange={e => setEditProductForm({...editProductForm, description: e.target.value})}
                        className="rounded-xl border-zinc-800 bg-zinc-900 text-white h-20 resize-none text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-widest text-zinc-400 px-1">Imagen del Producto</Label>
                      <div className="flex gap-2 items-center">
                        <Input 
                          type="file"
                          accept="image/*"
                          onChange={handleEditImageFile}
                          className="rounded-xl border-zinc-800 bg-zinc-900 text-white flex-1 h-12 pt-3 text-xs"
                        />
                        {editProductForm.image && <img src={editProductForm.image} className="w-12 h-12 rounded-xl object-cover border-2 border-[#FECC01] shadow-sm shrink-0" referrerPolicy="no-referrer" />}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button 
                        onClick={handleUpdateProduct} 
                        disabled={isUpdatingProduct}
                        className="flex-1 h-12 rounded-2xl bg-[#FECC01] hover:bg-[#ebd534] text-black font-extrabold uppercase tracking-widest"
                      >
                        {isUpdatingProduct ? 'Guardando...' : 'Guardar Cambios ⚡'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setEditingProduct(null)}
                        className="h-12 rounded-2xl border-zinc-700 text-zinc-300 hover:text-white text-xs px-4"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          
          <div className="grid gap-3.5">
            {filteredMenu.map((product) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                onClick={() => handleOpenProduct(product)}
                className="flex gap-3.5 p-3.5 rounded-3xl bg-[#161619] border border-zinc-900 group cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden"
              >
                {/* Admin quick edit & delete options */}
                {canManageRestaurant && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProduct(product);
                        setEditProductForm({
                          name: product.name,
                          price: product.price.toString(),
                          description: product.description || '',
                          category: product.category || 'Comida',
                          image: product.image || ''
                        });
                      }}
                      className="p-2 bg-zinc-900/90 hover:bg-zinc-800 text-[#FECC01] rounded-full shadow-md transition-all border border-zinc-700/50"
                      title="Editar plato y precio"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteProduct(product.id, e)}
                      className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-full transition-all border border-red-500/30"
                      title="Eliminar plato"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
                
                <div className="w-22 h-22 rounded-2xl overflow-hidden shrink-0 relative bg-zinc-950">
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <div className="flex flex-col flex-1 justify-between py-0.5">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-zinc-100 leading-snug">{product.name}</h4>
                    <p className="text-[11px] text-zinc-300 font-medium line-clamp-2 leading-snug">{product.description}</p>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2.5">
                    <span className="font-black text-sm text-[#FECC01]">Q{product.price.toFixed(2)}</span>
                    <Button 
                      size="icon" 
                      variant="secondary"
                      className="rounded-full w-8 h-8 shadow-md bg-zinc-900 border border-zinc-800 text-[#FECC01] hover:bg-zinc-800 shrink-0"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}

            {filteredMenu.length === 0 && (
              <div className="py-12 text-center text-zinc-650">
                <p className="font-bold text-xs uppercase tracking-wider">No hay platos en esta categoría</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Dynamic bottom floating cart drawer */}
      {cart.length > 0 && (
        <div className="fixed bottom-24 left-6 right-6 z-40">
          <Button 
            onClick={() => navigate('/cart')}
            className="w-full h-14 bg-[#FECC01] hover:bg-[#ebd534] text-black rounded-3xl shadow-[0_4px_25px_rgba(254,204,1,0.3)] flex justify-between items-center px-6 transition-transform active:scale-95"
          >
            <div className="flex items-center gap-2">
              <div className="bg-black text-[#FECC01] w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs">
                {cart.reduce((acc, i) => acc + i.quantity, 0)}
              </div>
              <span className="font-black uppercase tracking-wide text-xs italic">Ver Carrito</span>
            </div>
            <span className="font-black text-base">
              Q{cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0).toFixed(2)}
            </span>
          </Button>
        </div>
      )}

      <AppQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        defaultTab="restaurant"
        currentRestaurant={restaurant}
        restaurants={restaurants}
      />
    </div>
  );
};

export default RestaurantView;
