import crypto from 'crypto';
import { adminDb, adminAuth, FieldValue } from './firebaseAdmin';
import { MOCK_RESTAURANTS } from '../data';
import { AUTHORITATIVE_COUPONS, STANDARD_DELIVERY_FEE } from '../services/orderValidator';

export interface CreateOrderItemInput {
  productId?: string;
  name?: string;
  quantity: number;
  notes?: string;
  // Any client-declared price is strictly ignored by the server
  price?: number; 
}

export interface CreateOrderPayload {
  restaurantId: string;
  items: CreateOrderItemInput[];
  couponCode?: string;
  deliveryAddress: string;
  deliveryReference?: string;
  deliveryGPS?: { lat: number; lng: number };
  deliveryPhone?: string;
  deliveryWhatsapp?: string;
  userName?: string;
  notes?: string;
  paymentMethod?: 'efectivo';
  idempotencyKey?: string;
}

// In-memory fallback stores for offline/test environments when Firestore Admin has no remote credentials
export const testIdempotencyStore = new Map<string, {
  key: string;
  userId: string;
  payloadHash: string;
  orderId: string;
  status: 'completed' | 'processing';
  orderData: any;
  createdAt: number;
}>();

export const testOrdersStore = new Map<string, any>();

/**
 * Validates the format and length of an idempotency key.
 * Must be alphanumeric with hyphens/underscores, between 8 and 128 characters.
 */
export function validateIdempotencyKeyFormat(key: string): boolean {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(trimmed);
}

/**
 * Generates a deterministic SHA-256 hash from a canonical representation of the order payload.
 * Normalizes item ordering and relevant financial/logistical fields.
 */
export function computeCanonicalPayloadHash(payload: CreateOrderPayload): string {
  const normalizedItems = (payload.items || []).map(i => ({
    productId: (i.productId || '').trim(),
    name: (i.name || '').trim().toLowerCase(),
    quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
    notes: (i.notes || '').trim()
  })).sort((a, b) => (a.productId + a.name).localeCompare(b.productId + b.name));

  const canonicalObject = {
    restaurantId: (payload.restaurantId || '').trim(),
    items: normalizedItems,
    couponCode: (payload.couponCode || '').trim().toUpperCase(),
    deliveryAddress: (payload.deliveryAddress || '').trim().toLowerCase(),
    deliveryPhone: (payload.deliveryPhone || '').trim(),
    paymentMethod: (payload.paymentMethod || 'efectivo').trim().toLowerCase()
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalObject))
    .digest('hex');
}

/**
 * Helper to determine if we are in an isolated CI/test sandbox without emulators,
 * preventing accidental remote network calls while allowing real production Cloud Run
 * connections to Google Cloud Firestore and Auth when deployed legitimately.
 */
function isIsolatedTestWithoutFirestore(): boolean {
  // If Firestore emulator is active, real local emulated persistence is available
  if (process.env.FIRESTORE_EMULATOR_HOST) return false;

  const isTestFlag = process.env.RAYO_TEST_ENV === 'true' || process.env.CI === 'true';
  const isDemoProject = (process.env.FIREBASE_PROJECT_ID || '').startsWith('demo-') || 
                        (process.env.GCLOUD_PROJECT || '').startsWith('demo-');
  const isTestNodeEnv = process.env.NODE_ENV === 'test';

  // True only when running in isolated test/CI sandbox where GCP credentials don't exist
  return isTestFlag || isDemoProject || isTestNodeEnv;
}

function isIsolatedTestWithoutAuth(): boolean {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) return false;

  const isTestFlag = process.env.RAYO_TEST_ENV === 'true' || process.env.CI === 'true';
  const isDemoProject = (process.env.FIREBASE_PROJECT_ID || '').startsWith('demo-') || 
                        (process.env.GCLOUD_PROJECT || '').startsWith('demo-');
  const isTestNodeEnv = process.env.NODE_ENV === 'test';

  return isTestFlag || isDemoProject || isTestNodeEnv;
}

/**
 * Verifies a Firebase Authentication Bearer token.
 * Uses Firebase Admin SDK in production / Cloud Run.
 * Includes defensive fallback for local testing without cloud credentials.
 * Decodes and returns uid, email, and superAdmin custom claim.
 */
export async function verifyAuthToken(authHeader: string | undefined): Promise<{ uid: string; email?: string; superAdmin?: boolean } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) return null;

  // En entornos de pruebas/staging sin emulador de Auth, validar localmente sin conexiones remotas a Google
  if (isIsolatedTestWithoutAuth()) {
    if (token.startsWith('mock_test_token_')) {
      const uid = token.replace('mock_test_token_', '');
      const isSuper = uid.includes('superadmin') || uid.includes('super_admin');
      return { 
        uid, 
        email: `${uid}@rayo-test.local`,
        superAdmin: isSuper
      };
    }
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload.user_id || payload.sub || payload.uid) {
          return {
            uid: payload.user_id || payload.sub || payload.uid,
            email: payload.email,
            superAdmin: Boolean(payload.super_admin || payload.superAdmin)
          };
        }
      } catch {}
    }
    return null;
  }

  // 1. Try Firebase Admin SDK verification (en emulador activo o producción Cloud Run)
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { 
      uid: decoded.uid, 
      email: decoded.email,
      superAdmin: Boolean(decoded.super_admin || decoded.superAdmin)
    };
  } catch (err: any) {
    // If Admin SDK lacks credentials in local dev or emulator
    if (process.env.NODE_ENV !== 'production') {
      // Allow testing JWT or test tokens in non-production
      if (token.startsWith('mock_test_token_')) {
        const uid = token.replace('mock_test_token_', '');
        const isSuper = uid.includes('superadmin') || uid.includes('super_admin');
        return { 
          uid, 
          email: `${uid}@rayo-test.local`,
          superAdmin: isSuper
        };
      }

      // Check if valid JWT format
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload.user_id || payload.sub || payload.uid) {
            return {
              uid: payload.user_id || payload.sub || payload.uid,
              email: payload.email,
              superAdmin: Boolean(payload.super_admin || payload.superAdmin)
            };
          }
        } catch {}
      }
    }
    return null;
  }
}

/**
 * Checks if the authenticated user has verified super_admin custom claim.
 */
export function isAuthorizedSuperAdmin(authUser: { uid: string; superAdmin?: boolean } | null): boolean {
  return Boolean(authUser && authUser.superAdmin === true);
}

/**
 * Retrieves the authoritative restaurant and menu data.
 * Checks Firestore first, falling back to canonical catalogue.
 */
export async function getAuthoritativeRestaurant(restaurantId: string): Promise<{
  id: string;
  name: string;
  isOpen: boolean;
  isApproved: boolean;
  address?: string;
  phone?: string;
  whatsapp?: string;
  location?: [number, number];
  payAtLocal?: boolean;
  menu: Array<{ id: string; name: string; price: number; isOutOfStock?: boolean }>;
} | null> {
  // A. Si estamos en sandbox de prueba/CI simulando producción sin persistencia real ni emulador (como CASO 13):
  // Rechazar inmediatamente con HTTP 503 para validar que en producción no se usan fallbacks en memoria.
  if (process.env.NODE_ENV === 'production' && isIsolatedTestWithoutFirestore()) {
    throw {
      status: 503,
      message: 'Servicio no disponible: Catálogo fiduciario no accesible.'
    };
  }

  // B. Si estamos en pruebas unitarias/staging (sandbox de test) y no existe emulador activo:
  // Resolver el restaurante exclusivamente desde MOCK_RESTAURANTS manteniendo la misma estructura.
  // No acceder a adminDb ni realizar conexiones de red.
  if (isIsolatedTestWithoutFirestore()) {
    const localRest = MOCK_RESTAURANTS.find(r => r.id === restaurantId);
    if (localRest) {
      return {
        id: localRest.id,
        name: localRest.name,
        isOpen: localRest.isOpen !== false,
        isApproved: localRest.isApproved !== false,
        address: localRest.address,
        phone: localRest.phone,
        whatsapp: localRest.whatsapp || localRest.phone,
        location: localRest.location,
        payAtLocal: Boolean(localRest.payAtLocal),
        menu: localRest.menu.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          isOutOfStock: Boolean(p.isOutOfStock)
        }))
      };
    }
    return null;
  }

  // C. Si existe FIRESTORE_EMULATOR_HOST (o en producción con credenciales fiduciarias activas):
  let firestoreError: any = null;

  // 1. Try Firestore if available
  try {
    const docRef = adminDb.collection('restaurants').doc(restaurantId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data()!;
      // Get menu subcollection
      const menuSnap = await docRef.collection('menu').get();
      const menu = menuSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || '',
        price: Number(d.data().price) || 0,
        isOutOfStock: Boolean(d.data().isOutOfStock)
      }));

      // If menu was embedded or in subcollection
      const fullMenu = menu.length > 0 ? menu : (Array.isArray(data.menu) ? data.menu : []);

      return {
        id: docSnap.id,
        name: data.name || 'Comercio Afiliado',
        isOpen: data.isOpen !== false,
        isApproved: data.isApproved !== false,
        address: data.address,
        phone: data.phone,
        whatsapp: data.whatsapp || data.phone,
        location: data.location || [14.6349, -90.5069],
        payAtLocal: Boolean(data.payAtLocal),
        menu: fullMenu
      };
    }
  } catch (e: any) {
    firestoreError = e;
  }

  // AUDITORÍA Y CORRECCIÓN OBLIGATORIA DEL MODO FALLBACK (FASE 7B):
  // Si estamos en producción y Firestore falló, queda ESTRICTAMENTE PROHIBIDO
  // recurrir a MOCK_RESTAURANTS. Debe devolverse HTTP 503.
  if (process.env.NODE_ENV === 'production') {
    if (firestoreError) {
      throw {
        status: 503,
        message: 'Servicio no disponible: Catálogo fiduciario no accesible.'
      };
    }
    // Si no hubo error pero el restaurante no existe en la base de datos oficial
    return null;
  }

  // 2. Fallback to canonical data registry SOLO en desarrollo / pruebas locales sin conexión
  const localRest = MOCK_RESTAURANTS.find(r => r.id === restaurantId);
  if (localRest) {
    return {
      id: localRest.id,
      name: localRest.name,
      isOpen: localRest.isOpen !== false,
      isApproved: localRest.isApproved !== false,
      address: localRest.address,
      phone: localRest.phone,
      whatsapp: localRest.whatsapp || localRest.phone,
      location: localRest.location,
      payAtLocal: Boolean(localRest.payAtLocal),
      menu: localRest.menu.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        isOutOfStock: Boolean(p.isOutOfStock)
      }))
    };
  }

  return null;
}

/**
 * Local simulated atomic order creation for offline/test mode without remote credentials.
 * Implements the EXACT same validation, SHA-256 hash checks, and user isolation.
 */
function executeLocalSimulatedAtomicOrder(
  userId: string,
  key: string,
  payloadHash: string,
  orderDocument: any
): { orderId: string; order: any; isDuplicate?: boolean } {
  // En producción, prohibir almacenamiento en memoria fallback
  if (process.env.NODE_ENV === 'production') {
    throw {
      status: 503,
      message: 'Servicio no disponible: Persistencia fiduciaria inalcanzable.'
    };
  }

  const existing = testIdempotencyStore.get(key);
  if (existing) {
    if (existing.userId !== userId) {
      throw {
        status: 409,
        message: 'Conflicto de idempotencia: La clave de idempotencia ya fue utilizada por otro usuario.'
      };
    }
    if (existing.payloadHash !== payloadHash) {
      throw {
        status: 409,
        message: 'Conflicto de idempotencia: La clave de idempotencia fue reutilizada con un contenido de pedido diferente.'
      };
    }
    if (existing.status === 'processing') {
      // Prevención de estados processing huérfanos con lease de 60s
      const now = Date.now();
      const createdAtMs = typeof existing.createdAt === 'number' ? existing.createdAt : now;
      if (now - createdAtMs <= 60000) {
        throw {
          status: 409,
          message: 'Operación en progreso: Ya existe una transacción activa para esta clave de idempotencia.'
        };
      }
      // Si el lease expiró (>60s), se permite continuar y finalizar la orden
    }
    if (existing.status === 'completed') {
      return {
        orderId: existing.orderId,
        order: existing.orderData,
        isDuplicate: true
      };
    }
  }

  const generatedOrderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const finalOrder = {
    id: generatedOrderId,
    ...orderDocument,
    idempotencyKey: key,
    timestamp: new Date()
  };

  testIdempotencyStore.set(key, {
    key,
    userId,
    payloadHash,
    orderId: generatedOrderId,
    status: 'completed',
    orderData: finalOrder,
    createdAt: Date.now()
  });

  testOrdersStore.set(generatedOrderId, finalOrder);

  return {
    orderId: generatedOrderId,
    order: finalOrder,
    isDuplicate: false
  };
}

/**
 * Authoritatively calculates prices, validates all items and coupons,
 * and creates the order document directly from the server.
 * Implements persistent and distributed atomic idempotency.
 */
export async function createServerAuthorizedOrder(
  userId: string,
  userEmail: string | undefined,
  payload: CreateOrderPayload
): Promise<{ orderId: string; order: any; isDuplicate?: boolean }> {
  // 1. Basic field validation
  if (!payload.restaurantId) {
    throw { status: 400, message: 'Debe especificarse el restaurantId del pedido.' };
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw { status: 400, message: 'El pedido debe contener al menos un producto.' };
  }
  if (!payload.deliveryAddress || !payload.deliveryAddress.trim()) {
    throw { status: 400, message: 'La dirección de entrega es obligatoria.' };
  }
  if (!payload.deliveryPhone || !payload.deliveryPhone.trim()) {
    throw { status: 400, message: 'El número de teléfono de contacto es obligatorio.' };
  }

  // 2. Validate Idempotency Key Format (if provided)
  const rawKey = payload.idempotencyKey ? payload.idempotencyKey.trim() : null;
  if (rawKey && !validateIdempotencyKeyFormat(rawKey)) {
    throw {
      status: 400,
      message: 'Formato de idempotencyKey inválido. Debe ser una cadena alfanumérica de entre 8 y 128 caracteres.'
    };
  }

  // 3. Compute Canonical Payload Hash
  const canonicalHash = computeCanonicalPayloadHash(payload);

  // 4. Authoritative Restaurant Lookup
  const restaurant = await getAuthoritativeRestaurant(payload.restaurantId);
  if (!restaurant) {
    throw { status: 404, message: 'El restaurante seleccionado no existe en el sistema.' };
  }
  if (!restaurant.isApproved) {
    throw { status: 400, message: 'El restaurante se encuentra en revisión y no puede recibir pedidos.' };
  }
  if (!restaurant.isOpen) {
    throw { status: 400, message: 'El restaurante se encuentra cerrado actualmente.' };
  }

  // 5. Authoritative Product & Price Validation (Anti-Tampering)
  const validatedItems: Array<{
    productId?: string;
    name: string;
    price: number;
    quantity: number;
    notes: string;
  }> = [];

  let authoritativeSubtotal = 0;

  for (const item of payload.items) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    
    // Find canonical product in restaurant menu
    const product = restaurant.menu.find(p => 
      (item.productId && p.id === item.productId) || 
      (item.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase())
    );

    if (!product) {
      throw {
        status: 400,
        message: `El producto '${item.name || item.productId}' no existe en el catálogo autorizado de ${restaurant.name}.`
      };
    }

    if (product.isOutOfStock) {
      throw {
        status: 400,
        message: `El producto '${product.name}' se encuentra agotado actualmente.`
      };
    }

    // Authoritative unit price from the server catalogue
    const verifiedUnitPrice = product.price;
    authoritativeSubtotal += (verifiedUnitPrice * qty);

    validatedItems.push({
      productId: product.id,
      name: product.name,
      price: verifiedUnitPrice,
      quantity: qty,
      notes: (item.notes || '').slice(0, 300)
    });
  }

  // 6. Authoritative Coupon Validation
  let authoritativeDiscount = 0;
  let cleanCoupon = '';
  if (payload.couponCode) {
    const code = payload.couponCode.toUpperCase().trim();
    if (AUTHORITATIVE_COUPONS[code]) {
      const coupon = AUTHORITATIVE_COUPONS[code];
      cleanCoupon = code;
      if (coupon.type === 'percent') {
        authoritativeDiscount = authoritativeSubtotal * coupon.value;
      } else {
        authoritativeDiscount = Math.min(authoritativeSubtotal, coupon.value);
      }
    } else {
      // Ignored or rejected: coupon is invalid
      authoritativeDiscount = 0;
    }
  }

  // 7. Delivery Fee calculation
  const authoritativeDeliveryFee = STANDARD_DELIVERY_FEE;

  // 8. Authoritative Total
  const authoritativeTotal = Math.max(0, authoritativeSubtotal - authoritativeDiscount + authoritativeDeliveryFee);

  // 9. Construct Safe Server-Authoritative Order Document
  const shortId = Math.floor(1000 + Math.random() * 9000).toString();
  const longId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();

  const orderDocument: any = {
    shortId,
    longId,
    deliveryCode,
    userId,
    userName: payload.userName || userEmail?.split('@')[0] || 'Cliente Rayo',
    userPhone: payload.deliveryPhone,
    userWhatsapp: payload.deliveryWhatsapp || payload.deliveryPhone,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantPhone: restaurant.phone || '50241070444',
    restaurantWhatsapp: restaurant.whatsapp || restaurant.phone || '50241070444',
    restaurantAddress: restaurant.address || 'Dirección de Restaurante',
    restaurantLocation: restaurant.location || [14.6349, -90.5069],
    deliveryAddress: payload.deliveryAddress.trim(),
    deliveryReference: (payload.deliveryReference || '').trim(),
    deliveryGPS: payload.deliveryGPS || { lat: 0, lng: 0 },
    notes: (payload.notes || '').trim(),
    items: validatedItems,
    subtotal: Math.round(authoritativeSubtotal * 100) / 100,
    deliveryFee: authoritativeDeliveryFee,
    discount: Math.round(authoritativeDiscount * 100) / 100,
    couponCode: authoritativeDiscount > 0 ? cleanCoupon : '',
    total: Math.round(authoritativeTotal * 100) / 100,
    status: 'recibido',
    paymentMethod: 'efectivo',
    riderId: 'SYSTEM',
    riderName: 'Por asignar',
    riderEmail: '',
    riderPhone: '',
    payAtLocal: restaurant.payAtLocal || false,
    idempotencyKey: rawKey,
    createdAt: new Date().toISOString()
  };

  // 10. Atomic Execution with Idempotency Key (Distributed Transaction)
  if (rawKey) {
    // Prohibir fallback en producción si no hay emulador ni persistencia fiduciaria alcanzable
    if (process.env.NODE_ENV === 'production' && isIsolatedTestWithoutFirestore()) {
      throw {
        status: 503,
        message: 'Servicio no disponible: Persistencia fiduciaria inalcanzable.'
      };
    }

    // En pruebas unitarias/staging sin emulador activo, usar simulación en memoria sin intentar conexiones de red
    if (isIsolatedTestWithoutFirestore()) {
      return executeLocalSimulatedAtomicOrder(userId, rawKey, canonicalHash, orderDocument);
    }

    const idemDocRef = adminDb.collection('idempotency_keys').doc(rawKey);
    const orderDocRef = adminDb.collection('orders').doc();

    try {
      const transactionResult = await adminDb.runTransaction(async (transaction) => {
        const idemSnap = await transaction.get(idemDocRef);

        if (idemSnap.exists) {
          const existingIdem = idemSnap.data()!;

          // User isolation check: reject if used by another user
          if (existingIdem.userId !== userId) {
            throw {
              status: 409,
              message: 'Conflicto de idempotencia: La clave de idempotencia ya fue utilizada por otro usuario.'
            };
          }

          // Payload hash check: reject if content differs
          if (existingIdem.payloadHash !== canonicalHash) {
            throw {
              status: 409,
              message: 'Conflicto de idempotencia: La clave de idempotencia fue reutilizada con un contenido de pedido diferente.'
            };
          }

          // Status check
          if (existingIdem.status === 'completed') {
            return {
              orderId: existingIdem.orderId,
              order: existingIdem.orderData,
              isDuplicate: true
            };
          }

          if (existingIdem.status === 'processing') {
            // Prevención de estados processing huérfanos con lease de 60 segundos
            const now = Date.now();
            const createdAtMs = existingIdem.createdAt ? (
              typeof existingIdem.createdAt.toMillis === 'function' 
                ? existingIdem.createdAt.toMillis() 
                : (typeof existingIdem.createdAt === 'number' ? existingIdem.createdAt : new Date(existingIdem.createdAt).getTime())
            ) : now;

            if (now - createdAtMs <= 60000) {
              throw {
                status: 409,
                message: 'Operación en progreso: Ya existe una transacción activa para esta clave de idempotencia.'
              };
            }
            // Si el lease expiró (>60s), el lock se considera huérfano y la transacción actual toma el control
          }
        }

        // Not exists: Create order and idempotency record atomically
        const finalOrderData = {
          id: orderDocRef.id,
          ...orderDocument,
          idempotencyKey: rawKey,
          timestamp: FieldValue.serverTimestamp()
        };

        transaction.set(orderDocRef, finalOrderData);
        transaction.set(idemDocRef, {
          key: rawKey,
          userId,
          payloadHash: canonicalHash,
          orderId: orderDocRef.id,
          status: 'completed',
          orderData: {
            ...finalOrderData,
            timestamp: new Date().toISOString()
          },
          createdAt: FieldValue.serverTimestamp()
        });

        return {
          orderId: orderDocRef.id,
          order: {
            ...finalOrderData,
            timestamp: new Date()
          },
          isDuplicate: false
        };
      });

      return transactionResult;
    } catch (err: any) {
      // If it's a domain/validation error with status (e.g. 409 Conflict), propagate immediately!
      if (err && typeof err.status === 'number') {
        throw err;
      }

      // Prohibir fallback a almacenamiento en memoria en producción (Requisito Fase 7B)
      if (process.env.NODE_ENV === 'production') {
        throw {
          status: 503,
          message: 'Servicio no disponible: Persistencia fiduciaria inalcanzable.'
        };
      }

      // In offline / local test environments where remote Firestore credentials are not available
      return executeLocalSimulatedAtomicOrder(userId, rawKey, canonicalHash, orderDocument);
    }
  }

  // 11. Orders without idempotencyKey
  if (process.env.NODE_ENV === 'production' && isIsolatedTestWithoutFirestore()) {
    throw {
      status: 503,
      message: 'Servicio no disponible: Persistencia fiduciaria inalcanzable.'
    };
  }

  if (isIsolatedTestWithoutFirestore()) {
    const generatedOrderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const finalOrder = {
      id: generatedOrderId,
      ...orderDocument,
      timestamp: new Date()
    };
    testOrdersStore.set(generatedOrderId, finalOrder);
    return { orderId: generatedOrderId, order: finalOrder, isDuplicate: false };
  }

  let generatedOrderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  try {
    const docRef = await adminDb.collection('orders').add({
      ...orderDocument,
      timestamp: FieldValue.serverTimestamp()
    });
    generatedOrderId = docRef.id;
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production') {
      throw {
        status: 503,
        message: 'Servicio no disponible: Persistencia fiduciaria inalcanzable.'
      };
    }
    testOrdersStore.set(generatedOrderId, {
      ...orderDocument,
      timestamp: new Date()
    });
  }

  const finalOrder = {
    id: generatedOrderId,
    ...orderDocument,
    timestamp: new Date()
  };

  return { orderId: generatedOrderId, order: finalOrder, isDuplicate: false };
}
