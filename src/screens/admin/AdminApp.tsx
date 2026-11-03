import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Store, Package, CheckCircle, ChefHat, Star, TrendingUp, 
  MessageCircle, BarChart3, Settings, Calendar, 
  Clock, AlertTriangle, Users, Award, Zap, ArrowLeft, 
  Navigation, Volume2, Share2, Edit2, UserX, Landmark, 
  Search, Eye, EyeOff, X, QrCode, Smartphone, Sparkles, 
  Plus, Trash2, DollarSign, Bell, Shield, ShieldCheck, 
  LayoutDashboard, UserCheck
} from 'lucide-react';
import { useApp, isSuperAdminEmail, getWhatsAppOrderUrl } from '@/store';
import { db } from '@/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Product, Restaurant } from '@/types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import * as d3 from 'd3';
import { AppQrModal } from '@/components/AppQrModal';
import { PwaInstallGuideModal } from '@/components/PwaInstallGuideModal';
import { AuthModal } from '@/components/AuthModal';
import { NotificationSettingsCard } from '@/components/NotificationSettingsCard';
import { compressAndResizeImage, handleImageFile } from '@/lib/images';

export const AdminChart = ({ data }: { data: any[] }) => {
  const svgRef = React.useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 300 - margin.left - margin.right;
    const height = 150 - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .rangeRound([0, width])
      .padding(0.3)
      .domain(data.map(d => d.day));

    const y = d3.scaleLinear()
      .rangeRound([height, 0])
      .domain([0, d3.max(data, d => d.total) || 100]);

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr("color", "#94a3b8")
      .select(".domain").remove();

    g.append("g")
      .call(d3.axisLeft(y).ticks(3))
      .attr("color", "#94a3b8")
      .select(".domain").remove();

    g.selectAll(".bar")
      .data(data)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.day) || 0)
      .attr("y", height)
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("fill", "#E31B23")
      .attr("rx", 4)
      .transition()
      .duration(800)
      .attr("y", d => y(d.total))
      .attr("height", d => height - y(d.total));

  }, [data]);

  return <svg ref={svgRef} width="340" height="180" className="mx-auto" />;
};

export const SuperAdminPanel = () => {
  const { 
    user, orders, restaurants, users, updateStatus, updateRiderVerification, 
    registerRestaurant, approveRestaurant, addMenuItem, deleteMenuItem, 
    updateMenuItem, updateRestaurant, deleteRestaurant, deleteOrder, 
    centralWhatsApp, setCentralWhatsApp 
  } = useApp();
  
  const [centralPhoneInput, setCentralPhoneInput] = React.useState(centralWhatsApp);
  const [showPwaGuide, setShowPwaGuide] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'orders' | 'riders' | 'restaurants' | 'reports' | 'settings' | 'users-mgmt' | 'all-products' | 'quick-festin' | 'quick-gauchitos' | 'quick-tacobell' | 'quick-wendys' | 'quick-papajohns'>('overview');
  const [orderFilter, setOrderFilter] = React.useState<'hoy' | 'ayer' | 'todos'>('hoy');
  const [selectedRestId, setSelectedRestId] = React.useState<string | null>(null);
  const [selectedRestMenu, setSelectedRestMenu] = React.useState<Product[]>([]);
  const [isAddingProduct, setIsAddingProduct] = React.useState(false);
  const [isAddingRestaurant, setIsAddingRestaurant] = React.useState(false);
  const [editingRestaurantId, setEditingRestaurantId] = React.useState<string | null>(null);
  const [restForm, setRestForm] = React.useState({ 
    name: '', 
    image: '', 
    category: 'Comida', 
    address: '', 
    phone: '', 
    whatsapp: '', 
    lat: '', 
    lng: '', 
    addressReference: '',
    openingTime: '08:00',
    closingTime: '22:00',
    payAtLocal: false,
    isAdminCreated: true 
  });
  const [isGettingLocation, setIsGettingLocation] = React.useState(false);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalización no soportada");
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRestForm(prev => ({ 
          ...prev, 
          lat: position.coords.latitude.toString(), 
          lng: position.coords.longitude.toString() 
        }));
        setIsGettingLocation(false);
        toast.success("Ubicación GPS capturada");
      },
      () => {
        setIsGettingLocation(false);
        toast.error("No se pudo obtener la ubicación");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const [productForm, setProductForm] = React.useState({ name: '', price: '', category: 'Comida', description: '', image: '' });
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [allProducts, setAllProducts] = React.useState<{product: Product, restaurantId: string, restaurantName: string}[]>([]);
  const [editingGlobalProduct, setEditingGlobalProduct] = React.useState<{product: Product, restaurantId: string} | null>(null);
  const [productSearch, setProductSearch] = React.useState('');
  
  const [festinItems, setFestinItems] = React.useState([
    { name: 'Quesadillas de birria', price: 35.00, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80' },
    { name: 'Ramen de birria', price: 35.00, image: 'https://images.unsplash.com/photo-1512058560566-42724afbc2aa?auto=format&fit=crop&w=500&q=80' },
    { name: 'Pan de birria', price: 47.00, image: 'https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?auto=format&fit=crop&w=500&q=80' },
    { name: 'Birria papas', price: 35.00, image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=500&q=80' },
    { name: '4 tortillas extras doradas con queso', price: 17.00, image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=500&q=80' }
  ]);

  const [papaJohnsItems, setPapaJohnsItems] = React.useState([
    { name: 'All The Meats', price: 79.00, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=80' },
    { name: 'The Works', price: 85.00, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=500&q=80' },
    { name: 'Super Pepperoni', price: 70.00, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=500&q=80' },
    { name: 'Six Cheese', price: 79.00, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1548365328-8c6db3220e4c?auto=format&fit=crop&w=500&q=80' },
    { name: 'Chicken BBQ', price: 99.00, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=500&q=80' },
    { name: 'Margarita', price: 55.00, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1574071318508-1cdbad80ad38?auto=format&fit=crop&w=500&q=80' },
    { name: 'Hawaiana', price: 70.00, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865ef4?auto=format&fit=crop&w=500&q=80' },
    { name: 'Papa\'s Favorite', price: 99.00, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=80' },
    { name: 'Rolls de jamón (8)', price: 20.00, category: 'Entradas', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=500&q=80' },
    { name: 'Rolls de pepperoni (8)', price: 20.00, category: 'Entradas', image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=500&q=80' },
    { name: 'Cheesesticks (8)', price: 30.00, category: 'Entradas', image: 'https://images.unsplash.com/photo-1531496730074-83b638c0a7ac?auto=format&fit=crop&w=500&q=80' },
    { name: 'Chicken poppers (10)', price: 65.00, category: 'Pollo', image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=500&q=80' },
    { name: 'Alitas (10)', price: 80.00, category: 'Pollo', image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=500&q=80' },
    { name: 'Rolls de canela (8)', price: 30.00, category: 'Postres', image: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=500&q=80' },
    { name: 'Pepsi 2L', price: 25.00, category: 'Bebidas', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=500&q=80' }
  ]);

  const updatePapaJohnsItem = (index: number, updates: any) => {
    const newItems = [...papaJohnsItems];
    newItems[index] = { ...newItems[index], ...updates };
    setPapaJohnsItems(newItems);
  };

  // Build menu listener when restaurant is selected
  React.useEffect(() => {
    if (!selectedRestId) {
      setSelectedRestMenu([]);
      return;
    }
    const q = query(collection(db, 'restaurants', selectedRestId, 'menu'));
    const unsub = onSnapshot(q, (snap) => {
      const prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setSelectedRestMenu(prods);
    }, (err) => {
      console.warn("Error fetching menu:", err);
      const rest = restaurants.find(r => r.id === selectedRestId);
      if (rest) setSelectedRestMenu(rest.menu || []);
    });
    return () => unsub();
  }, [selectedRestId, restaurants]);

  // Aggregate stats
  const totalSales = orders.reduce((acc, o) => acc + (o.total || 0), 0);
  const activeOrdersCount = orders.filter(o => o.status !== 'entregado' && o.status !== 'cancelado').length;
  const verifiedRidersCount = users.filter(u => u.role === 'rider' && u.isVerifiedRider).length;

  const chartData = [
    { day: 'Lun', total: totalSales * 0.12 },
    { day: 'Mar', total: totalSales * 0.15 },
    { day: 'Mie', total: totalSales * 0.18 },
    { day: 'Jue', total: totalSales * 0.14 },
    { day: 'Vie', total: totalSales * 0.22 },
    { day: 'Sab', total: totalSales * 0.28 },
    { day: 'Dom', total: totalSales * 0.25 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-black p-6 rounded-[2.5rem] border border-[#FECC01]/30 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#FECC01] text-black font-black uppercase text-[10px]">PANEL MAESTRO</Badge>
            <span className="text-xs text-zinc-400 font-bold">Rayo Delivery Guatemala</span>
          </div>
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tight">Super Administración</h2>
        </div>

        {/* Global Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'orders', label: 'Pedidos', icon: Package },
            { id: 'restaurants', label: 'Comercios', icon: Store },
            { id: 'riders', label: 'Repartidores', icon: Users },
            { id: 'settings', label: 'Ajustes', icon: Settings },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-2xl text-xs font-black uppercase flex items-center gap-2 transition-all ${
                  isActive 
                    ? 'bg-[#FECC01] text-black shadow-lg shadow-[#FECC01]/20 scale-105' 
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#161619] border border-zinc-850 p-5 rounded-[2rem] shadow-xl">
              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Ventas Totales</p>
              <h3 className="text-2xl font-black italic text-[#FECC01] mt-1">Q{totalSales.toFixed(2)}</h3>
              <p className="text-[9px] text-zinc-500 mt-1 font-bold">Total acumulado en plataforma</p>
            </div>
            <div className="bg-[#161619] border border-zinc-850 p-5 rounded-[2rem] shadow-xl">
              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Pedidos Activos</p>
              <h3 className="text-2xl font-black italic text-white mt-1">{activeOrdersCount}</h3>
              <p className="text-[9px] text-emerald-400 mt-1 font-bold">En curso o pendientes</p>
            </div>
            <div className="bg-[#161619] border border-zinc-850 p-5 rounded-[2rem] shadow-xl">
              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Comercios</p>
              <h3 className="text-2xl font-black italic text-white mt-1">{restaurants.length}</h3>
              <p className="text-[9px] text-zinc-500 mt-1 font-bold">Restaurantes afiliados</p>
            </div>
            <div className="bg-[#161619] border border-zinc-850 p-5 rounded-[2rem] shadow-xl">
              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Repartidores Activos</p>
              <h3 className="text-2xl font-black italic text-[#FECC01] mt-1">{verifiedRidersCount}</h3>
              <p className="text-[9px] text-zinc-500 mt-1 font-bold">Pilotos verificados</p>
            </div>
          </div>

          {/* D3 Chart Card */}
          <div className="bg-[#161619] border border-zinc-850 p-6 rounded-[2.5rem] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black italic uppercase text-white tracking-wider flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#FECC01]" /> Rendimiento Semanal (D3)
                </h4>
                <p className="text-[10px] text-zinc-400 font-bold mt-0.5">Volumen estimado de órdenes por día</p>
              </div>
              <Badge className="bg-[#FECC01]/10 text-[#FECC01] border-[#FECC01]/30 text-[9px] font-black uppercase">
                En Vivo ⚡
              </Badge>
            </div>
            <div className="overflow-x-auto flex justify-center py-2">
              <AdminChart data={chartData} />
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-[#161619] border border-zinc-850 p-6 rounded-[2.5rem] shadow-xl space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <h3 className="text-base font-black italic uppercase text-white flex items-center gap-2">
              <Package size={18} className="text-[#FECC01]" /> Registro Maestro de Pedidos ({orders.length})
            </h3>
            <div className="flex gap-2">
              {(['hoy', 'ayer', 'todos'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setOrderFilter(f)}
                  className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase ${
                    orderFilter === f ? 'bg-[#FECC01] text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {orders.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">No hay pedidos registrados en la plataforma.</p>
            ) : (
              orders.map(o => (
                <div key={o.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black italic text-[#FECC01]">#{o.shortId}</span>
                      <Badge className="bg-zinc-800 text-zinc-300 text-[9px] font-bold uppercase">{o.status}</Badge>
                      <span className="text-xs text-zinc-400 font-medium">Cliente: {o.userName || 'Cliente'}</span>
                    </div>
                    <p className="text-xs font-bold text-white mt-1">{o.restaurantName} • Destino: {o.deliveryAddress}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-black italic text-[#FECC01]">Q{o.total.toFixed(2)}</span>
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`¿Eliminar permanentemente el pedido #${o.shortId}?`)) {
                          deleteOrder(o.id);
                        }
                      }}
                      className="border-rose-900 text-rose-400 hover:bg-rose-900/20 text-xs h-8 px-2 rounded-xl"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Restaurants Tab */}
      {activeTab === 'restaurants' && (
        <div className="bg-[#161619] border border-zinc-850 p-6 rounded-[2.5rem] shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-black italic uppercase text-white flex items-center gap-2">
              <Store size={18} className="text-[#FECC01]" /> Gestión de Comercios ({restaurants.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {restaurants.map(r => (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex justify-between items-start gap-3">
                <div className="flex gap-3 min-w-0">
                  <img src={r.image} className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-zinc-800" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-black italic text-white truncate notranslate" translate="no">{r.name}</h4>
                    <p className="text-[10px] text-zinc-400 truncate">{r.address}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={r.isApproved ? "bg-emerald-500/20 text-emerald-400 text-[8px]" : "bg-amber-500/20 text-amber-400 text-[8px]"}>
                        {r.isApproved ? "Aprobado ✔️" : "Pendiente ⏳"}
                      </Badge>
                      <span className="text-[9px] text-zinc-500 font-bold">{r.menu?.length || 0} platos</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button 
                    size="sm"
                    onClick={() => approveRestaurant(r.id, !r.isApproved)}
                    className="bg-[#FECC01] text-black hover:bg-[#ebd534] text-[10px] font-black uppercase h-8 px-2.5 rounded-xl"
                  >
                    {r.isApproved ? "Desactivar" : "Aprobar"}
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`¿Eliminar el comercio ${r.name}?`)) {
                        deleteRestaurant(r.id);
                      }
                    }}
                    className="border-zinc-800 text-rose-400 hover:bg-rose-900/20 text-[10px] font-bold h-8 px-2.5 rounded-xl"
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Riders Tab */}
      {activeTab === 'riders' && (
        <div className="bg-[#161619] border border-zinc-850 p-6 rounded-[2.5rem] shadow-xl space-y-4">
          <h3 className="text-base font-black italic uppercase text-white flex items-center gap-2">
            <Users size={18} className="text-[#FECC01]" /> Control y Verificación de Repartidores
          </h3>

          <div className="space-y-3 pt-2">
            {users.filter(u => u.role === 'rider').length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">No hay cuentas de repartidor registradas aún.</p>
            ) : (
              users.filter(u => u.role === 'rider').map(u => (
                <div key={u.uid} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center gap-3">
                  <div>
                    <p className="text-sm font-black text-white italic">{u.name || 'Sin nombre'}</p>
                    <p className="text-xs text-zinc-400">{u.email}</p>
                    <Badge className={u.isVerifiedRider ? "bg-emerald-500/20 text-emerald-400 text-[8px] mt-1" : "bg-amber-500/20 text-amber-400 text-[8px] mt-1"}>
                      {u.isVerifiedRider ? "Piloto Verificado ✔️" : "Pendiente de Autorización ⏳"}
                    </Badge>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => updateRiderVerification(u.uid, !u.isVerifiedRider)}
                    className="bg-[#FECC01] text-black hover:bg-[#ebd534] text-xs font-black uppercase rounded-xl h-9"
                  >
                    {u.isVerifiedRider ? "Revocar Acceso" : "Autorizar Piloto"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-[#161619] border border-zinc-850 p-6 rounded-[2.5rem] shadow-xl space-y-6">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-[#FECC01]" />
            <h3 className="text-base font-black italic uppercase text-white">Configuración del Sistema</h3>
          </div>

          {/* Central WhatsApp Number */}
          <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 space-y-3">
            <p className="text-xs font-black uppercase text-zinc-300">WhatsApp Central para Despacho de Pedidos</p>
            <div className="flex gap-2">
              <Input 
                value={centralPhoneInput}
                onChange={e => setCentralPhoneInput(e.target.value)}
                placeholder="+502..."
                className="bg-black border-zinc-700 text-white rounded-xl h-11"
              />
              <Button 
                onClick={() => {
                  setCentralWhatsApp(centralPhoneInput);
                  toast.success("WhatsApp central guardado exitosamente");
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase text-xs rounded-xl h-11 px-5"
              >
                Guardar
              </Button>
            </div>
            <p className="text-[10px] text-zinc-500">Central actual: +{centralWhatsApp}</p>
          </div>

          <NotificationSettingsCard />
        </div>
      )}
    </div>
  );
};

export const MerchantAdminPanel = () => {
  const navigate = useNavigate();
  const { 
    user, orders, restaurants, switchActiveRestaurant, 
    addMenuItem, updateMenuItem, deleteMenuItem, updateRestaurant,
    updateStatus
  } = useApp();

  const [activeAdminTab, setActiveAdminTab] = React.useState<'pedidos' | 'menu' | 'perfil'>('pedidos');
  const [productForm, setProductForm] = React.useState({ name: '', price: '', category: 'Comida', description: '', image: '' });
  const [editingMerchantProduct, setEditingMerchantProduct] = React.useState<Product | null>(null);
  const [adminMenu, setAdminMenu] = React.useState<Product[]>([]);
  const [isAddingProduct, setIsAddingProduct] = React.useState(false);
  const [isGettingLocation, setIsGettingLocation] = React.useState(false);

  // Stores owned by user
  const myRestaurants = React.useMemo(() => {
    if (!user) return [];
    const userEmail = user.email?.toLowerCase().trim();
    const isAllowedRayo = userEmail === 'emunozberber4@gmail.com' || userEmail === 'emunozberber@gmail.com';

    if (user.role === 'super_admin') {
      return restaurants;
    }
    return restaurants.filter(r => {
      if (r.id === 'r_rayo_burguer' || r.name.toLowerCase().includes('rayo burguer')) {
        return isAllowedRayo;
      }
      return (
        r.ownerId === user.uid ||
        (userEmail && r.ownerEmail && r.ownerEmail.toLowerCase() === userEmail) ||
        r.id === user.restaurantId ||
        user.ownedRestaurantIds?.includes(r.id)
      );
    });
  }, [restaurants, user]);

  const currentAdminRestaurant = React.useMemo(() => {
    return restaurants.find(r => r.id === user?.restaurantId) || myRestaurants[0] || null;
  }, [restaurants, user?.restaurantId, myRestaurants]);

  const [editPartnerData, setEditPartnerData] = React.useState({ 
    name: '', 
    categories: '', 
    image: '',
    address: '', 
    addressReference: '',
    whatsapp: '',
    location: [14.6349, -90.5069] as [number, number],
    openingTime: '08:00',
    closingTime: '22:00',
    openingDays: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
    isOpen: true
  });

  React.useEffect(() => {
    if (currentAdminRestaurant) {
      setEditPartnerData({
        name: currentAdminRestaurant.name,
        categories: (currentAdminRestaurant.categories || []).join(', '),
        image: currentAdminRestaurant.image,
        address: currentAdminRestaurant.address || '',
        addressReference: currentAdminRestaurant.addressReference || '',
        whatsapp: currentAdminRestaurant.whatsapp || currentAdminRestaurant.phone || '',
        location: currentAdminRestaurant.location || [14.6349, -90.5069],
        openingTime: currentAdminRestaurant.openingTime || '08:00',
        closingTime: currentAdminRestaurant.closingTime || '22:00',
        openingDays: currentAdminRestaurant.openingDays || ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
        isOpen: currentAdminRestaurant.isOpen ?? true
      });
    }
  }, [currentAdminRestaurant]);

  // Sync menu for this active store
  React.useEffect(() => {
    if (!currentAdminRestaurant?.id) return;
    const restId = currentAdminRestaurant.id;
    const q = query(collection(db, 'restaurants', restId, 'menu'));
    const unsub = onSnapshot(q, (snap) => {
      const prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const baseMenu = currentAdminRestaurant.menu || [];
      const combined = [...prods];
      baseMenu.forEach(bm => {
        if (!combined.some(p => p.id === bm.id)) {
          combined.push(bm);
        }
      });
      setAdminMenu(combined);
    }, (err) => {
      console.warn("Firestore menu notice:", err);
      setAdminMenu(currentAdminRestaurant.menu || []);
    });
    return () => unsub();
  }, [currentAdminRestaurant?.id, currentAdminRestaurant?.menu]);

  const handleAddProduct = async () => {
    if (!currentAdminRestaurant?.id) {
      toast.error("No se encontró el local activo.");
      return;
    }
    if (!productForm.name) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }
    const priceValue = parseFloat(productForm.price);
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error("El precio debe ser un número mayor a 0");
      return;
    }

    setIsAddingProduct(true);
    try {
      await addMenuItem(currentAdminRestaurant.id, {
        name: productForm.name,
        price: priceValue,
        description: productForm.description || 'Producto delicioso recién preparado.',
        category: productForm.category || 'Comida',
        image: productForm.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80'
      });
      setProductForm({ name: '', price: '', category: 'Comida', description: '', image: '' });
      toast.success("¡Producto agregado al menú con éxito! 🍔⚡");
    } catch (e: any) {
      toast.error("Error al publicar el producto.");
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleUpdatePartner = async () => {
    if (!currentAdminRestaurant?.id) return;
    await updateRestaurant(currentAdminRestaurant.id, {
      name: editPartnerData.name,
      categories: (editPartnerData.categories || '').split(',').map(s => s.trim()),
      image: editPartnerData.image,
      address: editPartnerData.address,
      addressReference: editPartnerData.addressReference,
      whatsapp: editPartnerData.whatsapp,
      location: editPartnerData.location,
      openingTime: editPartnerData.openingTime,
      closingTime: editPartnerData.closingTime,
      openingDays: editPartnerData.openingDays,
      isOpen: editPartnerData.isOpen
    });
    toast.success("¡Datos del comercio guardados correctamente!");
  };

  const restaurantOrders = orders.filter(o => o.restaurantId === currentAdminRestaurant?.id);

  return (
    <div className="space-y-6">
      {/* Active Store Banner */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-black p-6 rounded-[2.5rem] border border-[#FECC01]/30 shadow-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#FECC01] text-black flex items-center justify-center font-black shrink-0 shadow-[0_0_20px_rgba(254,204,1,0.3)]">
            <Store size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-[#FECC01] tracking-widest">Panel del Comercio</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">Activo ⚡</Badge>
            </div>
            <h3 className="text-xl font-black italic text-white truncate notranslate" translate="no">
              {currentAdminRestaurant?.name || 'Mi Comercio'}
            </h3>
            <p className="text-xs text-zinc-400">{currentAdminRestaurant?.address || 'Dirección registrada'}</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2">
          {(['pedidos', 'menu', 'perfil'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveAdminTab(tab)}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase transition-all ${
                activeAdminTab === tab 
                  ? 'bg-[#FECC01] text-black shadow-lg shadow-[#FECC01]/20 scale-105' 
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {tab === 'pedidos' ? '📦 Pedidos' : tab === 'menu' ? '🍔 Menú' : '⚙️ Perfil'}
            </button>
          ))}
        </div>
      </div>

      <NotificationSettingsCard />

      {/* Orders Tab */}
      {activeAdminTab === 'pedidos' && (
        <div className="bg-[#161619] border border-zinc-850 p-6 rounded-[2.5rem] shadow-xl space-y-4">
          <h4 className="text-base font-black italic uppercase text-white flex items-center gap-2">
            <Package size={18} className="text-[#FECC01]" /> Pedidos de este Local ({restaurantOrders.length})
          </h4>
          <div className="space-y-3 pt-2">
            {restaurantOrders.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">No hay pedidos asignados a este local por el momento.</p>
            ) : (
              restaurantOrders.map(o => (
                <div key={o.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black italic text-[#FECC01]">#{o.shortId}</span>
                      <Badge className="bg-[#FECC01] text-black text-[9px] font-black uppercase">{o.status}</Badge>
                      <span className="text-xs text-zinc-400 font-bold">{o.userName}</span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1">
                      {o.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-[#FECC01] italic">Q{o.total.toFixed(2)}</span>
                    {o.status === 'recibido' && (
                      <Button 
                        size="sm"
                        onClick={() => updateStatus(o.id, 'preparacion')}
                        className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-black uppercase rounded-xl h-9"
                      >
                        Pasar a Preparación 👨‍🍳
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Menu Tab */}
      {activeAdminTab === 'menu' && (
        <div className="bg-[#161619] border border-zinc-850 p-6 rounded-[2.5rem] shadow-xl space-y-6">
          <h4 className="text-base font-black italic uppercase text-white flex items-center gap-2">
            <ChefHat size={18} className="text-[#FECC01]" /> Menú y Productos del Local ({adminMenu.length})
          </h4>

          {/* Add Product Form */}
          <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 space-y-3">
            <h5 className="text-xs font-black uppercase text-[#FECC01]">Agregar Nuevo Plato</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input 
                placeholder="Nombre del producto (ej: Hamburguesa Especial)"
                value={productForm.name}
                onChange={e => setProductForm({...productForm, name: e.target.value})}
                className="bg-black border-zinc-700 text-white rounded-xl h-11"
              />
              <Input 
                placeholder="Precio en Quetzales (ej: 45.00)"
                type="number"
                value={productForm.price}
                onChange={e => setProductForm({...productForm, price: e.target.value})}
                className="bg-black border-zinc-700 text-white rounded-xl h-11"
              />
              <Input 
                placeholder="Categoría (ej: Combos, Bebidas, Postres)"
                value={productForm.category}
                onChange={e => setProductForm({...productForm, category: e.target.value})}
                className="bg-black border-zinc-700 text-white rounded-xl h-11"
              />
              <Input 
                placeholder="URL de imagen o carga archivo abajo"
                value={productForm.image}
                onChange={e => setProductForm({...productForm, image: e.target.value})}
                className="bg-black border-zinc-700 text-white rounded-xl h-11"
              />
            </div>
            <div className="flex gap-3 items-center">
              <Input 
                type="file"
                accept="image/*"
                onChange={e => handleImageFile(e, (base64) => setProductForm(prev => ({...prev, image: base64})))}
                className="bg-black border-zinc-700 text-white rounded-xl h-11 flex-1"
              />
              <Button 
                onClick={handleAddProduct}
                disabled={isAddingProduct}
                className="bg-[#FECC01] hover:bg-[#ebd534] text-black font-black uppercase text-xs rounded-xl h-11 px-6 shadow-md"
              >
                + Guardar Producto
              </Button>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {adminMenu.map(p => (
              <div key={p.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={p.image} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white truncate">{p.name}</p>
                    <span className="text-xs font-bold text-[#FECC01]">Q{p.price.toFixed(2)}</span>
                  </div>
                </div>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (currentAdminRestaurant?.id && confirm(`¿Eliminar ${p.name}?`)) {
                      deleteMenuItem(currentAdminRestaurant.id, p.id);
                    }
                  }}
                  className="border-zinc-800 text-rose-400 hover:bg-rose-900/20 text-xs h-8 px-2 rounded-xl"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile & Business Info Tab */}
      {activeAdminTab === 'perfil' && (
        <div className="bg-[#161619] border border-zinc-850 p-6 rounded-[2.5rem] shadow-xl space-y-4">
          <h4 className="text-base font-black italic uppercase text-white flex items-center gap-2">
            <Store size={18} className="text-[#FECC01]" /> Ajustes de Sucursal y Horarios
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-400">Nombre del Local</label>
              <Input 
                value={editPartnerData.name}
                onChange={e => setEditPartnerData({...editPartnerData, name: e.target.value})}
                className="bg-black border-zinc-700 text-white rounded-xl h-11"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-400">WhatsApp para Pedidos</label>
              <Input 
                value={editPartnerData.whatsapp}
                onChange={e => setEditPartnerData({...editPartnerData, whatsapp: e.target.value})}
                placeholder="+502..."
                className="bg-black border-zinc-700 text-white rounded-xl h-11"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-400">Dirección Física</label>
              <Input 
                value={editPartnerData.address}
                onChange={e => setEditPartnerData({...editPartnerData, address: e.target.value})}
                className="bg-black border-zinc-700 text-white rounded-xl h-11"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-400">Referencia de Llegada</label>
              <Input 
                value={editPartnerData.addressReference}
                onChange={e => setEditPartnerData({...editPartnerData, addressReference: e.target.value})}
                className="bg-black border-zinc-700 text-white rounded-xl h-11"
              />
            </div>
          </div>

          <Button 
            onClick={handleUpdatePartner}
            className="w-full h-12 bg-[#FECC01] hover:bg-[#ebd534] text-black font-black uppercase rounded-2xl text-xs shadow-lg mt-4"
          >
            Guardar Cambios de la Sucursal ⚡
          </Button>
        </div>
      )}
    </div>
  );
};

export default function AdminApp() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [showAuthModal, setShowAuthModal] = React.useState(false);

  // If user is not logged in, prompt login
  if (!user || !user.isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white p-6 flex flex-col justify-center items-center text-center">
        <div className="w-20 h-20 bg-[#FECC01] text-black rounded-3xl flex items-center justify-center font-black mb-6 shadow-2xl shadow-[#FECC01]/30">
          <Shield size={40} />
        </div>
        <h2 className="text-3xl font-black italic uppercase text-white mb-2">Rayo Administración</h2>
        <p className="text-sm text-zinc-400 max-w-sm mb-8 font-medium">
          Acceso exclusivo para administradores de plataforma y propietarios de comercios afiliados.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button 
            onClick={() => setShowAuthModal(true)} 
            className="w-full h-14 bg-[#FECC01] hover:bg-[#ebd534] text-black font-black uppercase rounded-2xl text-base shadow-xl active:scale-95 transition-all"
          >
            Iniciar Sesión Administrativa
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

  const isSuperAdmin = user.role === 'super_admin' || user.isSuperAdmin || isSuperAdminEmail(user.email);
  const isMerchantAdmin = user.role === 'admin' || !!user.restaurantId || (user.ownedRestaurantIds && user.ownedRestaurantIds.length > 0);

  // If user is neither super admin nor merchant admin
  if (!isSuperAdmin && !isMerchantAdmin) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white p-6 flex flex-col justify-center items-center text-center">
        <div className="w-20 h-20 bg-rose-500/20 border-2 border-rose-500 text-rose-400 rounded-3xl flex items-center justify-center font-black mb-6 shadow-2xl">
          <ShieldCheck size={38} />
        </div>
        <h2 className="text-2xl font-black italic uppercase text-white mb-2">Acceso Denegado</h2>
        <p className="text-xs text-zinc-400 max-w-sm mb-6 font-medium leading-relaxed">
          Tu cuenta actual (<span className="text-[#FECC01]">{user.email}</span>) no posee privilegios administrativos o no está asociada a ningún comercio registrado.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
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

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Navbar */}
        <div className="flex justify-between items-center border-b border-zinc-850 pb-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/explore')}
              className="rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-bold uppercase"
            >
              <ArrowLeft size={16} className="mr-1.5" /> Clientes
            </Button>
            <Separator orientation="vertical" className="h-4 bg-zinc-800" />
            <span className="text-xs font-black uppercase text-[#FECC01]">
              {isSuperAdmin ? 'SUPER ADMIN RAYO' : 'PORTAL COMERCIO'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 font-medium hidden sm:inline">{user.email}</span>
            <Badge className="bg-[#FECC01] text-black font-black uppercase text-[10px]">
              {user.role}
            </Badge>
          </div>
        </div>

        {/* View Mode Router */}
        {isSuperAdmin ? (
          <SuperAdminPanel />
        ) : (
          <MerchantAdminPanel />
        )}
      </div>
    </div>
  );
}
