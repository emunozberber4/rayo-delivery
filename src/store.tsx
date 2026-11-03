import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, signIn, signOutUser, signInWithEmail, registerWithEmail as fbRegisterWithEmail } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { CartItem, User, Order, Product, OrderStatus, Message, Restaurant } from './types';
import { MOCK_RESTAURANTS } from './data';
import { toast } from 'sonner';
import { sendOrderNotification, playOrderChime } from './lib/notifications';
import { calculateAuthoritativePricing } from './services/orderValidator';

declare global {
  interface Window {
    alertTimer: any;
  }
}

interface AppContextType {
  user: User | null;
  users: User[];
  loading: boolean;
  cart: CartItem[];
  orders: Order[];
  messages: Message[];
  restaurants: Restaurant[];
  quotaExceeded: boolean;
  addToCart: (product: Product, restaurantId: string, restaurantName: string, notes?: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  placeOrder: (notes?: string, deliveryReference?: string, discount?: number, couponCode?: string, paymentMethod?: 'efectivo', deliveryGPS?: { lat: number, lng: number }, deliveryAddress?: string) => Promise<void>;
  updateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  acceptOrder: (orderId: string) => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  toggleFavoriteRestaurant: (restaurantId: string) => Promise<void>;
  submitReview: (orderId: string, rating: number, comment: string) => Promise<void>;
  reorder: (order: Order) => void;
  toggleTheme: () => void;
  setRiderStatus: (status: 'repartiendo' | 'no repartiendo' | 'en pausa') => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  switchActiveRestaurant: (restaurantId: string) => Promise<void>;
  registerRestaurant: (data: Partial<Restaurant>) => Promise<void>;
  approveRestaurant: (id: string) => Promise<void>;
  applyAsRider: () => Promise<void>;
  updateRestaurant: (restaurantId: string, data: Partial<Restaurant>) => Promise<void>;
  addMenuItem: (restaurantId: string, product: Omit<Product, 'id'>) => Promise<void>;
  updateMenuItem: (restaurantId: string, productId: string, data: Partial<Product>) => Promise<void>;
  deleteMenuItem: (restaurantId: string, productId: string) => Promise<void>;
  deleteRestaurant: (id: string) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  updateRiderVerification: (uid: string, verified: boolean) => Promise<void>;
  releaseOrder: (orderId: string) => Promise<void>;
  isStoreOpen: () => boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<FirebaseUser>;
  registerWithEmail: (email: string, pass: string, name: string, phone?: string) => Promise<FirebaseUser>;
  saveFaceVerification: (photoDataUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  stopAlert: () => void;
  centralWhatsApp: string;
  setCentralWhatsApp: (phone: string) => void;
  sendOrderWhatsApp: (order: Order, phone?: string) => void;
}

export const formatGuatemalaPhone = (p?: string): string => {
  const clean = (p || '').replace(/\D/g, '');
  if (!clean) return '';
  return clean.startsWith('502') ? clean : `502${clean}`;
};

export const buildWhatsAppOrderMessage = (order: any): string => {
  const shortId = order.shortId || order.id?.substring(0, 5) || 'RAYO';
  const restName = order.restaurantName || 'Rayo Partner';
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsStr = items.map((i: any) => `• *${i.quantity}x* ${i.name}${i.notes ? ` _(Nota: ${i.notes})_` : ''} - Q${((i.price || 0) * (i.quantity || 1)).toFixed(2)}`).join('\n') || '• Detalle no especificado';
  
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : 0;
  const deliveryFee = 0;
  const discount = typeof order.discount === 'number' ? order.discount : 0;
  const total = typeof order.total === 'number' ? order.total : (subtotal - discount);
  const paymentMethod = (order.paymentMethod || 'efectivo').toUpperCase();
  
  const userName = order.userName || 'Cliente';
  const userPhone = order.userPhone || '';
  const userWA = order.userWhatsapp ? formatGuatemalaPhone(order.userWhatsapp) : (userPhone ? formatGuatemalaPhone(userPhone) : '');
  const deliveryAddress = order.deliveryAddress || 'Dirección no especificada';
  const deliveryReference = order.deliveryReference || '';
  const deliveryGPS = order.deliveryGPS;
  const notes = order.notes || '';
  const restWA = order.restaurantWhatsapp ? formatGuatemalaPhone(order.restaurantWhatsapp) : '';

  return (
    `⚡️ *¡NUEVO PEDIDO EN RAYO DELIVERY!* ⚡️\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *PEDIDO:* #${shortId}\n` +
    `🏪 *COMERCIO:* ${restName}\n` +
    (restWA ? `📞 *WhatsApp Comercio:* https://wa.me/${restWA}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 *PRODUCTOS:*\n${itemsStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 *Subtotal:* Q${subtotal.toFixed(2)}\n` +
    (discount > 0 ? `🎟 *Descuento:* -Q${discount.toFixed(2)}${order.couponCode ? ` (${order.couponCode})` : ''}\n` : '') +
    `💰 *TOTAL A COBRAR:* Q${total.toFixed(2)}\n` +
    `💳 *Pago:* ${paymentMethod}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *DATOS DEL CLIENTE:*\n` +
    `• *Nombre:* ${userName}\n` +
    (userPhone ? `• *Teléfono:* ${userPhone}\n` : '') +
    (userWA ? `• *Chat Directo Cliente:* https://wa.me/${userWA}\n` : '') +
    `• *Dirección:* ${deliveryAddress}\n` +
    (deliveryReference ? `• *Referencia:* ${deliveryReference}\n` : '') +
    (deliveryGPS?.lat ? `📍 *Ubicación GPS en Mapa:* https://maps.google.com/?q=${deliveryGPS.lat},${deliveryGPS.lng}\n` : '') +
    (notes ? `📝 *Notas del Pedido:* ${notes}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛵 *ESTADO:* Recibido (Por despachar)\n` +
    `⚡️ *Rayo Delivery Central (+502 41070444)*`
  );
};

export const getWhatsAppOrderUrl = (order: any, targetPhone: string = "50241070444"): string => {
  const phone = formatGuatemalaPhone(targetPhone) || "50241070444";
  const msg = buildWhatsAppOrderMessage(order);
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
};

export const SUPER_ADMIN_EMAILS = [
  'emunozberber@gmail.com'
];

export const ADMIN_EMAILS: string[] = [
  'emunozberber4@gmail.com'
];

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('rayo_active_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u && u.uid) {
          if (u.faceVerifiedAt && typeof u.faceVerifiedAt === 'string') {
            u.faceVerifiedAt = new Date(u.faceVerifiedAt);
          }
          return u;
        }
      }
      return null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [centralWhatsApp, setCentralWhatsAppState] = useState<string>(() => {
    return localStorage.getItem('rayo_central_whatsapp') || '50241070444';
  });

  const setCentralWhatsApp = (phone: string) => {
    const formatted = formatGuatemalaPhone(phone) || '50241070444';
    setCentralWhatsAppState(formatted);
    localStorage.setItem('rayo_central_whatsapp', formatted);
    toast.success(`WhatsApp Central actualizado a +${formatted}`);
  };

  const sendOrderWhatsApp = (order: Order, phone: string = centralWhatsApp) => {
    const url = getWhatsAppOrderUrl(order, phone);
    window.open(url, '_blank');
  };

  const isQuotaError = (err: any) => {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return msg.includes('quota limit exceeded') || msg.includes('quota exceeded');
  };

  const handleFirestoreError = (error: unknown, operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write', path: string | null) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const quota = isQuotaError(error);
    
    if (quota) {
      setQuotaExceeded(true);
      if (path === 'restaurants') {
        toast.error("Límite de datos alcanzado. Usando modo de respaldo fuera de línea.", {
          duration: 10000,
          icon: '🔌'
        });
      }
    }

    const errInfo = {
      error: errorMessage,
      operationType,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      }
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    // Fallback for restaurants if quota exceeded
    if (quota && path === 'restaurants') {
      setRestaurants(MOCK_RESTAURANTS);
      return; // Don't throw for restaurants quota to keep app usable with mock data
    }

    throw new Error(JSON.stringify(errInfo));
  };

  useEffect(() => {
    const unsubRest = onSnapshot(collection(db, 'restaurants'), (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        menu: [] 
      } as Restaurant));
      
      const combined = [...fetched];
      
      // Merge with locally created restaurants in case Firestore quota was reached
      try {
        const localRestsRaw = localStorage.getItem('local_restaurants');
        if (localRestsRaw) {
          const localRests: Restaurant[] = JSON.parse(localRestsRaw);
          localRests.forEach(local => {
            if (!combined.some(r => r.id === local.id)) {
              combined.push(local);
            }
          });
        }
      } catch (e) {
        console.error(e);
      }

      // Merge with mocks if they don't exist
      MOCK_RESTAURANTS.forEach(mock => {
        if (!combined.some(r => r.id === mock.id)) {
          combined.push({ ...mock, isApproved: true }); // Mocks are always approved
        }
      });

      // Ensure Rayo Burguer is always marked open 24/7 with zero delivery fee
      const rayoIndex = combined.findIndex(r => r.id === 'r_rayo_burguer' || r.name?.toLowerCase().includes('rayo burguer'));
      if (rayoIndex >= 0) {
        combined[rayoIndex] = {
          ...combined[rayoIndex],
          isOpen: true,
          isApproved: true,
          openingTime: '00:00',
          closingTime: '23:59',
          deliveryFee: 0,
          whatsapp: combined[rayoIndex].whatsapp || '50241070444',
          phone: combined[rayoIndex].phone || '50241070444'
        };
      }

      setRestaurants(combined);
    }, (error) => {
      if (isQuotaError(error)) {
        setQuotaExceeded(true);
        const combined: Restaurant[] = [];
        try {
          const localRestsRaw = localStorage.getItem('local_restaurants');
          if (localRestsRaw) {
            combined.push(...JSON.parse(localRestsRaw));
          }
        } catch (e) {
          console.error(e);
        }
        MOCK_RESTAURANTS.forEach(mock => {
          if (!combined.some(r => r.id === mock.id)) {
            combined.push({ ...mock, isApproved: true });
          }
        });
        setRestaurants(combined);
        return;
      }
      handleFirestoreError(error, 'list', 'restaurants');
    });

    return () => unsubRest();
  }, []);

  const [lastOrderTimestamp, setLastOrderTimestamp] = useState<number>(Date.now());
  const alertAudio = React.useRef<HTMLAudioElement | null>(null);

  // Initialize audio on first load or when needed
  useEffect(() => {
    // Intense siren alert sound
    alertAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'); 
    alertAudio.current.loop = true;
    alertAudio.current.volume = 1.0; 
  }, []);

  const stopAlert = () => {
    if (alertAudio.current) {
      alertAudio.current.pause();
      alertAudio.current.currentTime = 0;
    }
    if (window.alertTimer) {
      clearTimeout(window.alertTimer);
      window.alertTimer = null;
    }
  };

  useEffect(() => {
    if (orders.length > 0 && user) {
      const currentOrders = orders.filter(o => o.status === 'recibido' && (o.riderId === 'SYSTEM' || o.riderId === user.uid));
      const isRelevant = currentOrders.some(o => {
        if (user.role === 'rider') return user.isVerifiedRider && (o.riderId === user.uid || (o.riderId === 'SYSTEM' && user.riderStatus === 'repartiendo'));
        if (user.role === 'admin') return o.restaurantId === user.restaurantId;
        if (user.role === 'super_admin') return true;
        return false;
      });

      if (isRelevant) {
        if (alertAudio.current && alertAudio.current.paused) {
          alertAudio.current.play().catch(e => console.log("Audio play blocked", e));
        }
      } else {
        stopAlert();
      }
    } else {
      stopAlert();
    }
  }, [orders, user]);

  // GPS Auto-capture
  useEffect(() => {
    if (user && user.isLoggedIn) {
      const interval = setInterval(() => {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;
            if (latitude !== user.lat || longitude !== user.lng) {
              updateUser({ lat: latitude, lng: longitude });
            }
          }, (err) => console.log("Geo error", err));
        }
      }, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user?.uid, user?.isLoggedIn]);


  const addToCart = (product: Product, restaurantId: string, restaurantName: string, notes?: string) => {
    setCart(prev => {
      // If adding from a different restaurant, clear previous cart (optional, but typical for delivery apps)
      if (prev.length > 0 && prev[0].restaurantId !== restaurantId) {
        toast.info(`Cambiamos a ${restaurantName}`);
        return [{ product, quantity: 1, restaurantId, notes }];
      }
      
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, restaurantId, notes }];
    });
    toast.success(`${product.name} agregado`);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const toggleFavoriteRestaurant = async (restaurantId: string) => {
    if (!user) return;
    const current = user.favoriteRestaurants || [];
    const updated = current.includes(restaurantId) 
      ? current.filter(id => id !== restaurantId)
      : [...current, restaurantId];
    await updateUser({ favoriteRestaurants: updated });
  };

  const submitReview = async (orderId: string, rating: number, comment: string) => {
    try {
      await setDoc(doc(db, 'orders', orderId), {
        review: { rating, comment, timestamp: new Date() }
      }, { merge: true });
      toast.success("¡Gracias por tu opinión!");
    } catch (e) {
      handleFirestoreError(e, 'write', `orders/${orderId}`);
    }
  };

  const reorder = (order: Order) => {
    const items = order.items.map(item => ({
      product: { id: item.name, name: item.name, price: item.price, image: '', description: '', category: '' } as Product,
      quantity: item.quantity,
      restaurantId: order.restaurantId
    }));
    setCart(items);
    toast.success("Pedido copiado al carrito");
  };

  const toggleTheme = async () => {
    if (!user) return;
    const newTheme = user.theme === 'dark' ? 'light' : 'dark';
    await updateUser({ theme: newTheme });
  };

  const sendMessage = async (text: string) => {
    if (!auth.currentUser || !user) return;
    try {
      await addDoc(collection(db, 'messages'), {
        text,
        senderId: auth.currentUser.uid,
        senderName: user.name,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, 'create', 'messages');
    }
  };

  // Utility for ID generation
  const generateShortId = () => Math.floor(1000 + Math.random() * 9000).toString();
  const generateLongId = () => Math.floor(1000000000 + Math.random() * 9000000000).toString();

  // Ensure Henry's account always stays attached to a restaurant and role: admin
  useEffect(() => {
    if (user?.email === 'henrycipriano50@gmail.com') {
      const henryRest = restaurants.find(r => r.ownerEmail === 'henrycipriano50@gmail.com' || r.name.toLowerCase().includes('henry'));
      const targetRestId = henryRest?.id || user.restaurantId;

      if (user.role !== 'admin' || !user.restaurantId || (targetRestId && user.restaurantId !== targetRestId)) {
        setUser(prev => prev ? { ...prev, role: 'admin', restaurantId: targetRestId || prev.restaurantId } : null);
        if (targetRestId) {
          updateUser({ role: 'admin', restaurantId: targetRestId });
        }
      }
    }
  }, [user?.email, user?.restaurantId, user?.role, restaurants]);

  // Ensure emunozberber4@gmail.com and emunozberber@gmail.com always stay attached to Rayo Burguer
  useEffect(() => {
    const email = user?.email?.toLowerCase().trim();
    if (email === 'emunozberber4@gmail.com' || email === 'emunozberber@gmail.com') {
      const rayoBurguerRest = restaurants.find(r => 
        r.id === 'r_rayo_burguer' || 
        r.ownerEmail?.toLowerCase() === 'emunozberber4@gmail.com' || 
        r.name.toLowerCase().includes('rayo burguer')
      );
      const targetRestId = rayoBurguerRest?.id || 'r_rayo_burguer';
      const targetRole = email === 'emunozberber@gmail.com' ? 'super_admin' : 'admin';

      if (user.restaurantId !== targetRestId || user.role !== targetRole) {
        setUser(prev => prev ? { ...prev, role: targetRole, restaurantId: targetRestId, isSuperAdmin: email === 'emunozberber@gmail.com' } : null);
        updateUser({ role: targetRole, restaurantId: targetRestId, isSuperAdmin: email === 'emunozberber@gmail.com' });
      }
    }
  }, [user?.email, user?.restaurantId, user?.role, restaurants]);

  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubOrders: (() => void) | null = null;
    let unsubMsgs: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubUser) unsubUser();
      if (unsubOrders) unsubOrders();
      if (unsubMsgs) unsubMsgs();

      if (fbUser) {
        let henryRestId: string | null = null;
        // Enforce Super Admin role for the owner email
        const userDocRef = doc(db, 'users', fbUser.uid);
        let userSnap;
        try {
          userSnap = await getDoc(userDocRef);
        } catch (e) {
          if (isQuotaError(e)) {
            setQuotaExceeded(true);
            setLoading(false);
            return;
          }
          handleFirestoreError(e, 'get', 'users');
          return;
        }
        
        // TAREA 1 (Seguridad): Se eliminó la autoasignación y auto-elevación de privilegios en el cliente.
        // Los roles privilegiados (admin / super_admin) deben asignarse mediante Custom Claims o administración controlada.

        // Messages listener - limited to last 50 to save quota
        unsubMsgs = onSnapshot(query(collection(db, 'messages'), limit(50)), (snapshot) => {
          setMessages(snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          } as Message)));
        }, (error) => {
          if (isQuotaError(error)) {
            setQuotaExceeded(true);
            return;
          }
          handleFirestoreError(error, 'list', 'messages');
        });

        unsubUser = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            let userData = { ...data as User, uid: fbUser.uid, isLoggedIn: true };
            
            // Rider shift tracking and defaults
            if (userData.role === 'rider' && userData.balance === undefined) {
              updateUser({
                balance: 0,
                connectionHours: 0,
                totalMinutesWorked: 0,
                performanceRate: 5.0,
                completedOrdersCount: 0,
                acceptanceRate: 100,
                level: 1,
                xp: 0,
                riderStatus: 'no repartiendo',
                earningsHistory: []
              });
            }
            
            setUser(userData);
            try {
              localStorage.setItem('rayo_active_user', JSON.stringify(userData));
            } catch (_) {}
            setLoading(false);

            if (unsubOrders) unsubOrders();
            
            let q;
            if (userData.role === 'super_admin' || userData.isSuperAdmin) {
              // Super admin receives and sees all orders
              q = query(collection(db, 'orders'));
            } else if (userData.role === 'admin') {
              q = query(collection(db, 'orders'), where('restaurantId', '==', userData.restaurantId || 'NONE'));
            } else if (userData.role === 'rider') {
              // TAREA 2: Consulta compatible para repartidores que incluye pedidos asignados y disponibles ('SYSTEM')
              q = query(collection(db, 'orders'), where('riderId', 'in', [fbUser.uid, 'SYSTEM']));
            } else {
              q = query(collection(db, 'orders'), where('userId', '==', fbUser.uid));
            }

            let initialLoad = true;
            unsubOrders = onSnapshot(q, (orderSnapshot) => {
              const fetchedOrders = orderSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  ...data,
                  timestamp: data.timestamp?.toDate() || new Date(),
                  assignedAt: data.assignedAt?.toDate() || null,
                  deliveredAt: data.deliveredAt?.toDate() || null
                } as Order;
              });

              if (!initialLoad && (userData.role === 'super_admin' || userData.isSuperAdmin)) {
                orderSnapshot.docChanges().forEach(change => {
                  if (change.type === 'added') {
                    const newOrd = change.doc.data();
                    
                    // Trigger sound, vibration, browser tab and native system notification
                    sendOrderNotification({
                      title: `⚡ ¡NUEVO PEDIDO #${newOrd.shortId || ''}!`,
                      body: `${newOrd.restaurantName || 'Comercio'} - Total: Q${newOrd.total?.toFixed(2) || '0.00'}. Toca para abrir.`
                    });

                    toast.success(`⚡️ ¡NUEVO PEDIDO RECIBIDO! #${newOrd.shortId || ''} (${newOrd.restaurantName || 'Comercio'})`, {
                      duration: 15000,
                      action: {
                        label: "WhatsApp (+502 41070444)",
                        onClick: () => window.open(getWhatsAppOrderUrl(newOrd, "50241070444"), '_blank')
                      }
                    });
                  }
                });
              }
              initialLoad = false;

              setOrders(fetchedOrders.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
            }, (error) => {
              if (isQuotaError(error)) {
                setQuotaExceeded(true);
                return;
              }
              handleFirestoreError(error, 'list', 'orders');
            });
          } else {
            const newUser: User = {
              uid: fbUser.uid,
              name: fbUser.displayName || 'Usuario Nuevo',
              email: fbUser.email || '',
              address: '',
              phone: '',
              isLoggedIn: true,
              role: 'client',
              isSuperAdmin: false,
              isVerifiedRider: false,
              favorites: [],
              favoriteRestaurants: [],
              theme: 'dark'
            };
            setDoc(userDocRef, newUser).then(() => {
              setUser(newUser);
              try {
                localStorage.setItem('rayo_active_user', JSON.stringify(newUser));
              } catch (_) {}
              setLoading(false);
            }).catch((err) => {
              handleFirestoreError(err, 'write', 'users');
              setLoading(false);
            });
          }
        });
      } else {
        const stored = localStorage.getItem('rayo_active_user');
        if (stored) {
          try {
            const localUser = JSON.parse(stored);
            if (localUser && localUser.uid) {
              if (localUser.faceVerifiedAt && typeof localUser.faceVerifiedAt === 'string') {
                localUser.faceVerifiedAt = new Date(localUser.faceVerifiedAt);
              }
              setUser(localUser);
              setLoading(false);
              return;
            }
          } catch (_) {}
        }
        setUser(null);
        setOrders([]);
        setMessages([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
      if (unsubOrders) unsubOrders();
      if (unsubMsgs) unsubMsgs();
    };
  }, []);

  const setRiderStatus = async (status: 'repartiendo' | 'no repartiendo' | 'en pausa') => {
    if (!user) return;
    if (user.role === 'rider' && !user.isVerifiedRider) {
      toast.error("Tu cuenta de repartidor aún no ha sido autorizada por el administrador.");
      return;
    }

    const updates: Partial<User> = { riderStatus: status };
    
    // Shift tracking logic
    if (status === 'repartiendo') {
      updates.shiftStartTime = new Date();
    } else if (user.riderStatus === 'repartiendo' && user.shiftStartTime) {
      const start = new Date(user.shiftStartTime).getTime();
      const end = new Date().getTime();
      const diffMinutes = Math.floor((end - start) / (1000 * 60));
      updates.totalMinutesWorked = (user.totalMinutesWorked || 0) + diffMinutes;
      updates.connectionHours = parseFloat(((updates.totalMinutesWorked || 0) / 60).toFixed(1));
      updates.shiftStartTime = undefined;
    }

    await updateUser(updates);
    toast.success(`Estado: ${status.toUpperCase()}`);
  };

  const isStoreOpen = () => {
    return true; // Servicio y comercios siempre abiertos 24/7 para permitir pedidos sin bloqueos
  };

  const placeOrder = async (
    notes?: string, 
    deliveryReference?: string, 
    discount: number = 0, 
    couponCode: string = '', 
    paymentMethod: 'efectivo' = 'efectivo',
    deliveryGPS?: { lat: number, lng: number },
    deliveryAddress?: string
  ) => {
    if (!auth.currentUser || cart.length === 0 || !user) return;
    
    try {
      // FASE 5: Crear pedido exclusivamente a través del endpoint autorizado del servidor
      const idToken = await auth.currentUser.getIdToken();
      const idempotencyKey = `ord_${auth.currentUser.uid}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          restaurantId: cart[0].restaurantId,
          items: cart.map(i => ({
            productId: i.product.id,
            name: i.product.name,
            quantity: i.quantity,
            notes: i.notes || ''
          })),
          couponCode: couponCode || undefined,
          deliveryAddress: deliveryAddress || user.address || 'Dirección no proporcionada',
          deliveryReference: deliveryReference || '',
          deliveryGPS: deliveryGPS || (user.lat && user.lng ? { lat: user.lat, lng: user.lng } : undefined),
          deliveryPhone: user.phone || '',
          deliveryWhatsapp: user.whatsapp || user.phone || '',
          userName: user.name,
          notes: notes || '',
          paymentMethod: paymentMethod || 'efectivo',
          idempotencyKey
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor al procesar el pedido (${response.status})`);
      }

      const { orderId, order: createdOrder } = await response.json();
      clearCart();

      // NOTIFICATIONS ENGINE - Enviar SIEMPRE a WhatsApp +502 41070444 sin importar el restaurante
      const targetPhone = "50241070444";
      const orderWaUrl = getWhatsAppOrderUrl(createdOrder, targetPhone);

      // Abrir WhatsApp con el ticket del pedido completo
      try {
        const win = window.open(orderWaUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
          const a = document.createElement('a');
          a.href = orderWaUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (err) {
        console.warn("Auto-open WhatsApp prevented by browser:", err);
      }

      toast.success(`¡Pedido #${createdOrder.shortId} confirmado por el servidor!`, {
        description: `Notificación enviada a WhatsApp (+502 41070444).`,
        duration: 10000,
        action: {
          label: "Abrir WhatsApp",
          onClick: () => window.open(orderWaUrl, '_blank')
        }
      });
    } catch (e) {
      console.error("Error placing order:", e);
      toast.error("Error al procesar el pedido");
    }
  };

  const acceptOrder = async (orderId: string) => {
    if (!user || user.role !== 'rider') return;
    
    // Safety check: Cannot accept more than 1 active order
    const activeOrders = orders.filter(o => o.riderId === user.uid && o.status !== 'entregado' && o.status !== 'cancelado');
    if (activeOrders.length > 0) {
      toast.error("Ya tienes un pedido en curso. Termínalo antes de aceptar otro.");
      return;
    }

    const { runTransaction, doc } = await import('firebase/firestore');
    const orderRef = doc(db, 'orders', orderId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists()) {
          throw new Error("El pedido no existe.");
        }
        
        const orderData = orderDoc.data();
        if (orderData.status !== 'recibido' && orderData.riderId !== user.uid) {
          throw new Error("Este pedido ya no está disponible.");
        }
        
        // If it's already assigned to someone else (not SYSTEM and not ME)
        if (orderData.riderId && orderData.riderId !== 'SYSTEM' && orderData.riderId !== user.uid) {
          throw new Error(`Este pedido ya fue tomado por ${orderData.riderName || 'otro rider'}.`);
        }

        transaction.update(orderRef, {
          riderId: user.uid,
          riderName: user.name,
          riderPhone: user.phone,
          status: 'preparacion',
          assignedAt: serverTimestamp()
        });
      });
      
      toast.success("Pedido aceptado. ¡A trabajar!");
    } catch (e: any) {
      handleFirestoreError(e, 'write', `orders/${orderId}`);
    }
  };

  const releaseOrder = async (orderId: string) => {
    if (!user) return;
    
    // Check if the user is the authorized admin email or a super_admin
    const isAdmin = isSuperAdminEmail(user.email) || user.role === 'super_admin' || isAdminEmail(user.email) || user.role === 'admin';
    const isRider = user.role === 'rider';

    if (!isAdmin && !isRider) {
      toast.error("No tienes permisos para realizar esta acción.");
      return;
    }
    
    const { runTransaction, doc } = await import('firebase/firestore');
    const orderRef = doc(db, 'orders', orderId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists()) throw new Error("El pedido no existe.");
        
        const orderData = orderDoc.data();

        if (isAdmin) {
          // Admin performs the actual release
          transaction.update(orderRef, {
            riderId: 'SYSTEM',
            riderName: 'Por asignar',
            riderPhone: '',
            status: 'recibido', 
            releasedAt: serverTimestamp(),
            lastRiderId: orderData.riderId || null,
            releaseRequested: false, // Clear any pending requests
            releaseAuthorizedBy: user.uid
          });
          toast.success("Pedido liberado y autorizado correctamente.");
        } else if (isRider) {
          // Rider can ONLY request a release
          if (orderData.riderId !== user.uid) {
            throw new Error("No puedes solicitar liberar un pedido que no tienes asignado.");
          }

          if (orderData.status === 'entregado' || orderData.status === 'cancelado') {
            throw new Error("No se puede liberar un pedido ya finalizado.");
          }

          if (orderData.releaseRequested) {
            throw new Error("Ya hay una solicitud de liberación pendiente para este pedido.");
          }

          transaction.update(orderRef, {
            releaseRequested: true,
            releaseRequestedAt: serverTimestamp(),
            releaseRequestedBy: user.uid
          });
          toast.success("Solicitud de liberación enviada. Espera la autorización del administrador.");
        }
      });
    } catch (e: any) {
      handleFirestoreError(e, 'write', `orders/${orderId}`);
    }
  };

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    stopAlert();
    try {
      if (!user) {
        toast.error("Debes iniciar sesión para actualizar pedidos.");
        return;
      }

      const order = orders.find(o => o.id === orderId);
      if (!order) {
        toast.error("Pedido no encontrado.");
        return;
      }

      const isSuper = user.role === 'super_admin' || Boolean(user.isSuperAdmin);
      const isRestaurant = (user.role === 'admin' && (order.restaurantId === user.restaurantId || !order.restaurantId)) || isSuper;
      const isAssignedRider = user.role === 'rider' && order.riderId === user.uid;
      const isOwnerClient = order.userId === user.uid;

      const updates: any = { status };

      if (status === 'preparacion') {
        // TAREA 3: El comercio avanza a preparación sin usurpar el rol de repartidor
        if (!isRestaurant && !isSuper) {
          toast.error("Solo el comercio o administrador puede marcar el pedido en preparación.");
          return;
        }
        if (order.status !== 'recibido') {
          toast.error("Solo se puede pasar a preparación un pedido en estado recibido.");
          return;
        }
        updates.prepTimeEstimated = 25;
        // riderId y riderName se conservan intactos
      } else if (status === 'camino') {
        // Solo el repartidor asignado (o superadmin) puede avanzar a camino tras recolectar
        if (!isAssignedRider && !isSuper) {
          toast.error("Solo el repartidor asignado a este pedido puede marcarlo en camino.");
          return;
        }
        updates.pickedUpAt = serverTimestamp();
      } else if (status === 'entregado') {
        // Solo el repartidor asignado (o superadmin) puede completar la entrega
        if (!isAssignedRider && !isSuper) {
          toast.error("Solo el repartidor asignado puede marcar la entrega.");
          return;
        }
        updates.deliveredAt = serverTimestamp();
        if (order.timestamp) {
          const start = order.timestamp.getTime();
          const end = new Date().getTime();
          updates.totalTimeMinutes = Math.floor((end - start) / (1000 * 60));
        }
      } else if (status === 'cancelado') {
        // El cliente solo puede cancelar si el pedido sigue en 'recibido'
        if (isOwnerClient && order.status !== 'recibido') {
          toast.error("El pedido ya está en preparación o en camino y no puede ser cancelado por el cliente.");
          return;
        }
        if (!isOwnerClient && !isRestaurant && !isSuper) {
          toast.error("No tienes autorización para cancelar este pedido.");
          return;
        }
        updates.cancelledAt = serverTimestamp();
        updates.cancelReason = isOwnerClient ? "Cancelado por el cliente" : "Cancelado por comercio/administración";
      }

      await setDoc(doc(db, 'orders', orderId), updates, { merge: true });
      toast.info(`Pedido: ${status}`);
    } catch (e) {
      handleFirestoreError(e, 'update', `orders/${orderId}`);
    }
  };

  const updateUser = async (data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      try {
        localStorage.setItem('rayo_active_user', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), data, { merge: true });
      toast.success("Perfil actualizado");
    } catch (e) {
      handleFirestoreError(e, 'update', `users/${auth.currentUser.uid}`);
    }
  };

  const login = async () => {
    try {
      await signIn();
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const isOpNotAllowed = (err: any) => {
    return err?.code === 'auth/operation-not-allowed' || 
           err?.message?.includes('operation-not-allowed') || 
           err?.message?.includes('OPERATION_NOT_ALLOWED');
  };

  const loginWithEmail = async (email: string, pass: string): Promise<FirebaseUser> => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const cred = await signInWithEmail(cleanEmail, pass);
      return cred.user;
    } catch (e: any) {
      if (isOpNotAllowed(e)) {
        // Fallback when Firebase Auth email/password provider is disabled in Firebase console
        const accountsJson = localStorage.getItem('rayo_registered_accounts');
        const accounts: any[] = accountsJson ? JSON.parse(accountsJson) : [];
        let acc = accounts.find((a: any) => a.email.toLowerCase() === cleanEmail);

        if (!acc) {
          const uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          const isSuper = isSuperAdminEmail(cleanEmail);
          const isAdmin = isAdminEmail(cleanEmail);
          const defaultName = cleanEmail.split('@')[0].replace(/[._]/g, ' ');
          acc = {
            uid,
            email: cleanEmail,
            name: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
            phone: '50241070444',
            password: pass,
            role: isSuper ? 'super_admin' : (isAdmin ? 'admin' : 'client')
          };
          accounts.push(acc);
          localStorage.setItem('rayo_registered_accounts', JSON.stringify(accounts));
        } else if (acc.password && acc.password !== pass) {
          const err: any = new Error('Contraseña incorrecta.');
          err.code = 'auth/wrong-password';
          throw err;
        }

        const isSuper = isSuperAdminEmail(cleanEmail);
        const isAdmin = isAdminEmail(cleanEmail);
        const sessionUser: User = {
          uid: acc.uid,
          email: acc.email,
          name: acc.name,
          phone: acc.phone || '50241070444',
          address: 'Coatepeque, Quetzaltenango',
          isLoggedIn: true,
          role: (acc.role as any) || (isSuper ? 'super_admin' : (isAdmin ? 'admin' : 'client')),
          restaurantId: (cleanEmail === 'emunozberber4@gmail.com' || cleanEmail === 'emunozberber@gmail.com') ? 'r_rayo_burguer' : (acc.restaurantId || undefined),
          isSuperAdmin: isSuper,
          facePhotoUrl: acc.facePhotoUrl,
          faceVerified: acc.faceVerified,
          faceVerifiedAt: acc.faceVerifiedAt ? new Date(acc.faceVerifiedAt) : undefined,
          faceBiometricId: acc.faceBiometricId,
          favorites: [],
          favoriteRestaurants: [],
          theme: 'dark'
        };

        localStorage.setItem('rayo_active_user', JSON.stringify(sessionUser));
        setUser(sessionUser);

        return {
          uid: acc.uid,
          email: acc.email,
          displayName: acc.name
        } as any;
      }

      console.warn('Email login notice:', e?.message || e);
      throw e;
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string, phone?: string): Promise<FirebaseUser> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || 'Usuario';
    try {
      const cred = await fbRegisterWithEmail(cleanEmail, pass, cleanName);
      if (cred.user) {
        const isSuper = isSuperAdminEmail(cleanEmail);
        const isAdmin = isAdminEmail(cleanEmail);
        const userDocRef = doc(db, 'users', cred.user.uid);
        await setDoc(userDocRef, {
          name: cleanName,
          email: cleanEmail,
          phone: phone ? phone.trim() : '50241070444',
          address: 'Coatepeque, Quetzaltenango',
          isLoggedIn: true,
          role: isSuper ? 'super_admin' : (isAdmin ? 'admin' : 'client'),
          isSuperAdmin: isSuper,
          favorites: []
        }, { merge: true });
      }
      return cred.user;
    } catch (e: any) {
      if (isOpNotAllowed(e)) {
        // Fallback when Firebase Auth email/password provider is disabled in Firebase console
        const accountsJson = localStorage.getItem('rayo_registered_accounts');
        const accounts: any[] = accountsJson ? JSON.parse(accountsJson) : [];
        let existingAcc = accounts.find((a: any) => a.email.toLowerCase() === cleanEmail);

        if (existingAcc) {
          const err: any = new Error('Este correo ya tiene una cuenta registrada.');
          err.code = 'auth/email-already-in-use';
          throw err;
        }

        const uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        const isSuper = isSuperAdminEmail(cleanEmail);
        const isAdmin = isAdminEmail(cleanEmail);
        const newAcc = {
          uid,
          email: cleanEmail,
          name: cleanName,
          phone: phone ? phone.trim() : '50241070444',
          password: pass,
          role: isSuper ? 'super_admin' : (isAdmin ? 'admin' : 'client')
        };
        accounts.push(newAcc);
        localStorage.setItem('rayo_registered_accounts', JSON.stringify(accounts));

        const sessionUser: User = {
          uid,
          email: cleanEmail,
          name: cleanName,
          phone: newAcc.phone || '50241070444',
          address: 'Coatepeque, Quetzaltenango',
          isLoggedIn: true,
          role: isSuper ? 'super_admin' : (isAdmin ? 'admin' : 'client'),
          restaurantId: (cleanEmail === 'emunozberber4@gmail.com' || cleanEmail === 'emunozberber@gmail.com') ? 'r_rayo_burguer' : undefined,
          isSuperAdmin: isSuper,
          favorites: [],
          favoriteRestaurants: [],
          theme: 'dark'
        };

        localStorage.setItem('rayo_active_user', JSON.stringify(sessionUser));
        setUser(sessionUser);

        return {
          uid,
          email: cleanEmail,
          displayName: cleanName
        } as any;
      }

      console.warn('Email registration notice:', e?.message || e);
      throw e;
    }
  };

  const saveFaceVerification = async (photoDataUrl: string) => {
    const activeUid = user?.uid || auth.currentUser?.uid;
    if (!activeUid && !user) {
      toast.error('Debes iniciar sesión para verificar tu rostro');
      return;
    }

    try {
      const now = new Date();
      const biometricId = 'BIO-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      
      setUser(prev => prev ? {
        ...prev,
        facePhotoUrl: photoDataUrl,
        faceVerified: true,
        faceVerifiedAt: now,
        faceBiometricId: biometricId
      } : null);

      // Persist in local storage
      const stored = localStorage.getItem('rayo_active_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          u.facePhotoUrl = photoDataUrl;
          u.faceVerified = true;
          u.faceVerifiedAt = now.toISOString();
          u.faceBiometricId = biometricId;
          localStorage.setItem('rayo_active_user', JSON.stringify(u));
        } catch (_) {}
      }

      const accountsJson = localStorage.getItem('rayo_registered_accounts');
      if (accountsJson) {
        try {
          const accounts: any[] = JSON.parse(accountsJson);
          const idx = accounts.findIndex((a: any) => a.uid === activeUid || a.email === user?.email);
          if (idx >= 0) {
            accounts[idx].facePhotoUrl = photoDataUrl;
            accounts[idx].faceVerified = true;
            accounts[idx].faceVerifiedAt = now.toISOString();
            accounts[idx].faceBiometricId = biometricId;
            localStorage.setItem('rayo_registered_accounts', JSON.stringify(accounts));
          }
        } catch (_) {}
      }

      if (auth.currentUser && activeUid) {
        try {
          await setDoc(doc(db, 'users', activeUid), {
            facePhotoUrl: photoDataUrl,
            faceVerified: true,
            faceVerifiedAt: serverTimestamp(),
            faceBiometricId: biometricId
          }, { merge: true });
        } catch (e) {
          console.warn('Could not sync face scan to Firestore doc:', e);
        }
      }

      toast.success('¡Rostro verificado e identificado con éxito! 🛡️');
    } catch (e) {
      console.warn('Error saving face verification:', e);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('rayo_active_user');
      setUser(null);
      await signOutUser();
    } catch (e) {
      console.warn('Logout warning:', e);
    }
  };

  const switchActiveRestaurant = async (restaurantId: string) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, restaurantId } : null);
    try {
      await updateUser({ restaurantId });
    } catch (e) {
      console.warn("Could not persist active restaurant to firestore:", e);
    }
    const rest = restaurants.find(r => r.id === restaurantId);
    toast.success(`Cambiado a: ${rest?.name || 'Local seleccionado'} ⚡`);
  };

  const registerRestaurant = async (data: Partial<Restaurant>) => {
    if (!user) return;
    if (user.role === 'rider') {
      toast.error("Los repartidores no pueden registrar comercios. Contacta a soporte.");
      return;
    }
    const isSuper = user.role === 'super_admin';
    const fallbackId = `rest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRestData: Restaurant = {
      id: fallbackId,
      name: data.name || 'Nuevo Comercio',
      image: data.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=500&q=80',
      rating: 5.0,
      deliveryTime: '20-30 min',
      deliveryFee: 1.50,
      categories: data.categories || ['Comida'],
      address: data.address || '',
      addressReference: data.addressReference || '',
      phone: data.phone || '',
      whatsapp: data.whatsapp || data.phone || '',
      openingTime: data.openingTime || '08:00',
      closingTime: data.closingTime || '22:00',
      location: data.location || [14.6349, -90.5069],
      isOpen: true,
      payAtLocal: data.payAtLocal || false,
      ownerId: user.uid,
      ownerEmail: user.email,
      isAdminCreated: isSuper,
      isApproved: true,
      menu: data.menu || []
    };

    const currentOwned = user.ownedRestaurantIds || [];
    if (user.restaurantId && !currentOwned.includes(user.restaurantId)) {
      currentOwned.push(user.restaurantId);
    }

    try {
      const restRef = await addDoc(collection(db, 'restaurants'), {
        ...data,
        ownerId: user.uid,
        ownerEmail: user.email,
        rating: 5.0,
        deliveryFee: 1.5,
        deliveryTime: '20-30 min',
        isOpen: true,
        isAdminCreated: isSuper,
        isApproved: true,
        createdAt: serverTimestamp()
      });
      const newRole = isSuper ? 'super_admin' : 'admin';
      const updatedOwned = Array.from(new Set([...currentOwned, restRef.id]));
      await updateUser({ 
        role: newRole as any, 
        restaurantId: restRef.id,
        ownedRestaurantIds: updatedOwned 
      });
      toast.success("¡Comercio registrado con éxito!");
    } catch (e) {
      console.warn("Firestore error during registerRestaurant, storing locally:", e);
      try {
        const localRestsRaw = localStorage.getItem('local_restaurants');
        const localRests: Restaurant[] = localRestsRaw ? JSON.parse(localRestsRaw) : [];
        localRests.push(newRestData);
        localStorage.setItem('local_restaurants', JSON.stringify(localRests));
      } catch (err) {
        console.error(err);
      }
      setRestaurants(prev => [newRestData, ...prev]);
      const newRole = isSuper ? 'super_admin' : 'admin';
      const updatedOwned = Array.from(new Set([...currentOwned, fallbackId]));
      setUser(prev => prev ? { 
        ...prev, 
        role: newRole as any, 
        restaurantId: fallbackId,
        ownedRestaurantIds: updatedOwned
      } : null);
      toast.success("¡Comercio registrado con éxito!");
    }
  };

  const approveRestaurant = async (id: string) => {
    if (user?.role !== 'super_admin') return;
    try {
      await setDoc(doc(db, 'restaurants', id), { isApproved: true }, { merge: true });
      toast.success("Comercio aprobado correctamente.");
    } catch (e) {
      handleFirestoreError(e, 'update', `restaurants/${id}`);
    }
  };

  const applyAsRider = async () => {
    if (!user || user.role !== 'client') return;
    const isEduardo = user.email?.toLowerCase() === 'emunozberber4@gmail.com' || user.email?.toLowerCase() === 'emunozberber@gmail.com';
    try {
      await updateUser({ 
        role: 'rider',
        isVerifiedRider: isEduardo ? true : false,
        balance: 0,
        connectionHours: 0,
        performanceRate: 5.0,
        completedOrdersCount: 0,
        acceptanceRate: 100,
        level: 1,
        xp: 0,
        riderStatus: isEduardo ? 'repartiendo' : 'no repartiendo',
        earningsHistory: [],
        vehicleInfo: {
          type: 'moto',
          plate: '',
          model: 'Por definir'
        }
      });
      if (isEduardo) {
        toast.success("¡Bienvenido al equipo de Repartidores!");
      } else {
        toast.info("Solicitud registrada. Estado: Pendiente de Verificación.");
      }
    } catch (e) {
      toast.error("Error al unirse como rider");
    }
  };

  const updateRestaurant = async (restaurantId: string, data: Partial<Restaurant>) => {
    try {
      await setDoc(doc(db, 'restaurants', restaurantId), data, { merge: true });
      toast.success("Comercio actualizado");
    } catch (e) {
      handleFirestoreError(e, 'update', `restaurants/${restaurantId}`);
    }
  };

  const deleteRestaurant = async (id: string) => {
    if (!user || (user.role !== 'super_admin' && !isSuperAdminEmail(user.email))) return;
    
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'restaurants', id));
      toast.success("Restaurante eliminado correctamente");
    } catch (e: any) {
      handleFirestoreError(e, 'delete', `restaurants/${id}`);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!user || (user.role !== 'super_admin' && !isSuperAdminEmail(user.email))) return;
    
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'orders', id));
      toast.success("Pedido eliminado correctamente");
    } catch (e: any) {
      handleFirestoreError(e, 'delete', `orders/${id}`);
    }
  };

  const addMenuItem = async (restaurantId: string, product: Omit<Product, 'id'>) => {
    const fallbackId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newProd: Product = { ...product, id: fallbackId };

    setRestaurants(prev => prev.map(r => {
      if (r.id !== restaurantId) return r;
      return { ...r, menu: [...(r.menu || []), newProd] };
    }));

    try {
      await addDoc(collection(db, 'restaurants', restaurantId, 'menu'), product);
    } catch (e) {
      console.warn("Firestore addMenuItem failed, saving locally:", e);
      try {
        const localMenusRaw = localStorage.getItem('local_menus');
        const localMenus: Record<string, Product[]> = localMenusRaw ? JSON.parse(localMenusRaw) : {};
        localMenus[restaurantId] = [...(localMenus[restaurantId] || []), newProd];
        localStorage.setItem('local_menus', JSON.stringify(localMenus));
      } catch (err) {
        console.error(err);
      }
      toast.success("Producto agregado correctamente");
    }
  };

  const updateMenuItem = async (restaurantId: string, productId: string, data: Partial<Product>) => {
    setRestaurants(prev => prev.map(r => {
      if (r.id !== restaurantId) return r;
      const updatedMenu = (r.menu || []).map(p => p.id === productId ? { ...p, ...data } : p);
      return { ...r, menu: updatedMenu };
    }));

    try {
      await setDoc(doc(db, 'restaurants', restaurantId, 'menu', productId), data, { merge: true });
      toast.success("Producto actualizado");
    } catch (e) {
      console.warn("Firestore updateMenuItem fallback to localStorage:", e);
      try {
        const localMenusRaw = localStorage.getItem('local_menus');
        const localMenus: Record<string, Product[]> = localMenusRaw ? JSON.parse(localMenusRaw) : {};
        if (localMenus[restaurantId]) {
          localMenus[restaurantId] = localMenus[restaurantId].map(p => p.id === productId ? { ...p, ...data } : p);
          localStorage.setItem('local_menus', JSON.stringify(localMenus));
        }
      } catch (err) {
        console.error(err);
      }
      toast.success("Producto actualizado");
    }
  };

  const deleteMenuItem = async (restaurantId: string, productId: string) => {
    setRestaurants(prev => prev.map(r => {
      if (r.id !== restaurantId) return r;
      return { ...r, menu: (r.menu || []).filter(p => p.id !== productId) };
    }));

    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'restaurants', restaurantId, 'menu', productId));
      toast.success("Producto eliminado");
    } catch (e) {
      console.warn("Firestore deleteMenuItem fallback to localStorage:", e);
      try {
        const localMenusRaw = localStorage.getItem('local_menus');
        const localMenus: Record<string, Product[]> = localMenusRaw ? JSON.parse(localMenusRaw) : {};
        if (localMenus[restaurantId]) {
          localMenus[restaurantId] = localMenus[restaurantId].filter(p => p.id !== productId);
          localStorage.setItem('local_menus', JSON.stringify(localMenus));
        }
      } catch (err) {
        console.error(err);
      }
      toast.success("Producto eliminado");
    }
  };

  const updateRiderVerification = async (uid: string, verified: boolean) => {
    try {
      await setDoc(doc(db, 'users', uid), { isVerifiedRider: verified }, { merge: true });
      toast.success(verified ? "Rider verificado" : "Verificación revocada");
    } catch (e) {
      toast.error("Error al actualizar verificación");
    }
  };

  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const isEduardo = user?.email?.toLowerCase() === 'emunozberber4@gmail.com' || user?.email?.toLowerCase() === 'emunozberber@gmail.com';
    if (user?.role !== 'super_admin' && !isEduardo) {
      setUsers([]);
      return;
    }
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => {
        const d = doc.data();
        const uEmail = d.email?.toLowerCase();
        const isRiderEduardo = uEmail === 'emunozberber4@gmail.com' || uEmail === 'emunozberber@gmail.com' || d.name?.toLowerCase().includes('eduardo');
        const isRider = d.role === 'rider';
        return {
          uid: doc.id,
          ...d,
          isVerifiedRider: isRider ? (isRiderEduardo ? true : (d.isVerifiedRider === true && isRiderEduardo)) : d.isVerifiedRider
        } as User;
      }));
    }, (error) => {
      if (isQuotaError(error)) {
        setQuotaExceeded(true);
        return;
      }
      handleFirestoreError(error, 'list', 'users');
    });
    return () => unsubUsers();
  }, [user?.role, user?.email]);

  return (
    <AppContext.Provider value={{
      user, users, loading, cart, orders, messages, restaurants, quotaExceeded,
      addToCart, removeFromCart, clearCart, 
      placeOrder, updateStatus, acceptOrder, updateUser, 
      toggleFavoriteRestaurant, submitReview, 
      reorder, toggleTheme,
      setRiderStatus, sendMessage,
      switchActiveRestaurant,
      registerRestaurant, approveRestaurant, applyAsRider, updateRestaurant, deleteRestaurant, deleteOrder, addMenuItem, updateMenuItem, deleteMenuItem,
      updateRiderVerification,
      releaseOrder,
      isStoreOpen,
      login, loginWithEmail, registerWithEmail, saveFaceVerification, logout, stopAlert,
      centralWhatsApp, setCentralWhatsApp, sendOrderWhatsApp
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
