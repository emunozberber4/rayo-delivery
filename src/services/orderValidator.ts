/**
 * ============================================================================
 * RAYO DELIVERY — MOTOR DE VALIDACIÓN FIDUCIARIA DE PEDIDOS (ANTI-TAMPERING)
 * ============================================================================
 * Este módulo centraliza las reglas de negocio autorizadas para:
 * 1. Calcular el subtotal real a partir de productos y cantidades.
 * 2. Verificar la legitimidad de cupones de descuento.
 * 3. Prevenir pedidos con importes alterados (ej. Q0.01 o total = 0).
 * 4. Servir como contrato de validación tanto para el frontend como para el
 *    endpoint autorizado en Cloud Run (server.ts) o Firebase Cloud Functions.
 */

export interface OrderItemInput {
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface PricingValidationResult {
  isValid: boolean;
  tamperingDetected: boolean;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  authoritativeTotal: number;
  appliedCoupon: string | null;
  message: string;
}

export const AUTHORITATIVE_COUPONS: Record<string, { type: 'percent' | 'fixed'; value: number; description: string }> = {
  'BIRRIA2GO': { type: 'percent', value: 0.5, description: '50% de descuento en Birria2Go' },
  'BIENVENIDO': { type: 'fixed', value: 5, description: 'Descuento de bienvenida Q5' },
  'RAYO50': { type: 'percent', value: 0.5, description: '50% de descuento promocional Rayo' },
};

export const STANDARD_DELIVERY_FEE = 0; // Promoción activa: Envío Gratis en pedidos actuales

/**
 * Recalcula de forma fiduciaria el total del pedido y verifica si el cliente intentó
 * alterar el monto final.
 */
export function calculateAuthoritativePricing(
  items: OrderItemInput[],
  couponCode?: string,
  clientDeclaredTotal?: number
): PricingValidationResult {
  if (!items || items.length === 0) {
    return {
      isValid: false,
      tamperingDetected: false,
      subtotal: 0,
      discount: 0,
      deliveryFee: 0,
      authoritativeTotal: 0,
      appliedCoupon: null,
      message: 'El pedido no contiene ningún producto.'
    };
  }

  // 1. Cálculo de subtotal estricto
  const subtotal = items.reduce((acc, item) => {
    const unitPrice = typeof item.price === 'number' && item.price >= 0 ? item.price : 0;
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    return acc + (unitPrice * qty);
  }, 0);

  // 2. Cálculo estricto de cupón
  let discount = 0;
  let cleanCoupon: string | null = null;
  if (couponCode) {
    const normalized = couponCode.toUpperCase().trim();
    if (AUTHORITATIVE_COUPONS[normalized]) {
      cleanCoupon = normalized;
      const conf = AUTHORITATIVE_COUPONS[normalized];
      if (conf.type === 'percent') {
        discount = subtotal * conf.value;
      } else {
        discount = Math.min(subtotal, conf.value);
      }
    }
  }

  // 3. Total inmutable
  const authoritativeTotal = Math.max(0, subtotal - discount + STANDARD_DELIVERY_FEE);
  const roundedAuthoritativeTotal = Math.round(authoritativeTotal * 100) / 100;

  // 4. Detección de manipulación (tampering)
  let tamperingDetected = false;
  if (clientDeclaredTotal !== undefined && clientDeclaredTotal !== null) {
    const diff = Math.abs(clientDeclaredTotal - roundedAuthoritativeTotal);
    // Margen de tolerancia de 1 centavo por redondeo
    if (diff > 0.02) {
      tamperingDetected = true;
    }
  }

  return {
    isValid: !tamperingDetected && roundedAuthoritativeTotal >= 0,
    tamperingDetected,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    deliveryFee: STANDARD_DELIVERY_FEE,
    authoritativeTotal: roundedAuthoritativeTotal,
    appliedCoupon: discount > 0 ? cleanCoupon : null,
    message: tamperingDetected
      ? `Manipulación detectada: Total declarado (Q${clientDeclaredTotal?.toFixed(2)}) difiere del total autorizado (Q${roundedAuthoritativeTotal.toFixed(2)}).`
      : 'Cálculo de importes conforme a las reglas fiduciarias.'
  };
}
