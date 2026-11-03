/**
 * ============================================================================
 * RAYO DELIVERY — SUITE DE PRUEBAS LOCALES DE CHECKOUT SEGURO (FASE 5)
 * ============================================================================
 * Pruebas unitarias y de integración para el endpoint y servicio fiduciario
 * de creación de pedidos en el servidor.
 * 
 * Casos cubiertos:
 * 1. Token ausente -> 401 Unauthorized
 * 2. Token inválido -> 401 Unauthorized
 * 3. Producto inexistente -> 400 Bad Request
 * 4. Precio manipulado por el cliente -> Servidor impone precio fiduciario
 * 5. Cupón inválido -> Servidor no aplica descuento
 * 6. Restaurante inexistente o inhabilitado -> 404 / 400 Bad Request
 * 7. Cálculo de total fiduciario exacto con cupón legítimo
 * 8. Idempotencia: reintento de la misma solicitud devuelve el pedido existente
 * 9. Bloqueo de creación directa desde el cliente en firestore.rules
 * ============================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { 
  verifyAuthToken, 
  createServerAuthorizedOrder, 
  getAuthoritativeRestaurant 
} from '../src/server/orderService';

describe('FASE 5: Suite de Checkout Seguro y Creación Autorizada', () => {

  // --- CASO 1 & 2: AUTENTICACIÓN ---
  it('TC-01: Rechazar solicitud sin cabecera de autenticación', async () => {
    const authResult = await verifyAuthToken(undefined);
    assert.equal(authResult, null, 'Debe devolver null si no hay cabecera Authorization');
  });

  it('TC-02: Rechazar solicitud con token inválido o malformado', async () => {
    const authResult = await verifyAuthToken('Bearer token_totalmente_invalido');
    assert.equal(authResult, null, 'Debe devolver null ante tokens inválidos');
  });

  it('TC-03: Validar token de prueba en entorno local/test', async () => {
    const authResult = await verifyAuthToken('Bearer mock_test_token_usr_test_123');
    assert.ok(authResult, 'Debe resolver el usuario autenticado');
    assert.equal(authResult?.uid, 'usr_test_123');
  });

  // --- CASO 3: PRODUCTO INEXISTENTE ---
  it('TC-04: Rechazar pedido si un producto no existe en el catálogo del restaurante', async () => {
    await assert.rejects(
      async () => {
        await createServerAuthorizedOrder('usr_test_123', 'test@local', {
          restaurantId: 'r_rayo_burguer',
          items: [
            { productId: 'id_producto_fantasma_999', name: 'Hamburguesa Fantasma', quantity: 1 }
          ],
          deliveryAddress: '5ta Avenida 10-20 Zona 1',
          deliveryPhone: '50212345678'
        });
      },
      (err: any) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /no existe en el catálogo autorizado/i);
        return true;
      }
    );
  });

  // --- CASO 4: PRECIO MANIPULADO POR EL CLIENTE ---
  it('TC-05: El servidor DEBE ignorar precios manipulados por el cliente y aplicar el precio del catálogo', async () => {
    // Rayo Clásica Burguer cuesta Q35.00 en r_rayo_burguer
    const manipulatedPayload = {
      restaurantId: 'r_rayo_burguer',
      items: [
        { 
          productId: 'rb1', 
          name: 'Rayo Clásica Burguer', 
          quantity: 2, 
          price: 0.01 // Intento malicioso de inyectar Q0.01
        }
      ],
      deliveryAddress: 'Barrio El Carmen, Coatepeque',
      deliveryPhone: '50241070444'
    };

    const result = await createServerAuthorizedOrder('usr_client_malicious', 'hacker@test.com', manipulatedPayload);
    
    assert.ok(result.orderId, 'El pedido debe crearse con identificador');
    assert.equal(result.order.items[0].price, 35.00, 'El precio unitario debe ser el fiduciario (Q35.00), no Q0.01');
    assert.equal(result.order.subtotal, 70.00, 'Subtotal debe ser Q70.00');
    assert.equal(result.order.total, 70.00, 'Total debe ser Q70.00 inmutable');
  });

  // --- CASO 5: CUPÓN INVÁLIDO ---
  it('TC-06: Cupón inválido debe ser rechazado sin aplicar descuento', async () => {
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [
        { productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 } // Q35.00
      ],
      couponCode: 'CUPON_FALSO_100_OFF',
      deliveryAddress: 'Zona 2, Coatepeque',
      deliveryPhone: '50241070444'
    };

    const result = await createServerAuthorizedOrder('usr_client_normal', 'cliente@test.com', payload);
    assert.equal(result.order.discount, 0, 'El descuento debe ser 0 para cupón inválido');
    assert.equal(result.order.couponCode, '', 'No debe registrar código de cupón activo');
    assert.equal(result.order.total, 35.00, 'Total debe ser el importe sin descuento');
  });

  // --- CASO 6: RESTAURANTE INEXISTENTE O INHABILITADO ---
  it('TC-07: Rechazar pedido para un restaurante inexistente', async () => {
    await assert.rejects(
      async () => {
        await createServerAuthorizedOrder('usr_client', 'client@test.com', {
          restaurantId: 'restaurante_ficticio_inexistente',
          items: [{ productId: 'item1', quantity: 1 }],
          deliveryAddress: 'Dirección Test',
          deliveryPhone: '50212345678'
        });
      },
      (err: any) => {
        assert.equal(err.status, 404);
        assert.match(err.message, /no existe/i);
        return true;
      }
    );
  });

  // --- CASO 7: CÁLCULO DE TOTAL FIDUCIARIO EXACTO CON CUPÓN ---
  it('TC-08: Cálculo exacto de subtotal, descuento legítimo (50%) y total final', async () => {
    // 2 hamburguesas Rayo Clásica (Q35 x 2 = Q70) + Cupón RAYO50 (50% = Q35 desc) -> Total Q35.00
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [
        { productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 2 }
      ],
      couponCode: 'RAYO50',
      deliveryAddress: '4ta Calle 3-12 Zona 1',
      deliveryPhone: '50255555555'
    };

    const result = await createServerAuthorizedOrder('usr_client_legit', 'legit@test.com', payload);
    assert.equal(result.order.subtotal, 70.00);
    assert.equal(result.order.discount, 35.00);
    assert.equal(result.order.deliveryFee, 0);
    assert.equal(result.order.total, 35.00);
    assert.equal(result.order.couponCode, 'RAYO50');
    assert.equal(result.order.status, 'recibido');
    assert.equal(result.order.riderId, 'SYSTEM');
  });

  // --- CASO 8: IDEMPOTENCIA ---
  it('TC-09: Reintento de la misma solicitud con el mismo idempotencyKey debe devolver el pedido existente', async () => {
    const key = `idem_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', quantity: 1 }],
      deliveryAddress: 'Calle Real',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    // Primera llamada
    const firstCall = await createServerAuthorizedOrder('usr_client_idem', 'user@test.com', payload);
    assert.ok(firstCall.orderId);

    // Segunda llamada con la misma clave
    const secondCall = await createServerAuthorizedOrder('usr_client_idem', 'user@test.com', payload);
    assert.equal(secondCall.orderId, firstCall.orderId, 'Debe devolver el mismo orderId');
    assert.equal(secondCall.isDuplicate, true, 'Debe marcarse como duplicado / idempotente');
  });

  // --- CASO 9: BLOQUEO DE CREACIÓN DIRECTA EN FIRESTORE RULES ---
  it('TC-10: Verificar que firestore.rules bloquea la creación directa desde el cliente', () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    
    // Debe incluir 'match /orders/{orderId}' y 'allow create: if false;'
    assert.match(rulesContent, /match \/orders\/\{orderId\}/);
    assert.match(rulesContent, /allow create: if false;/);
  });

});
