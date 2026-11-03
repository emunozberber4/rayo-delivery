/**
 * ============================================================================
 * RAYO DELIVERY — SUITE DE PRUEBAS DE CHECKOUT E IDEMPOTENCIA DISTRIBUIDA (FASE 7B)
 * ============================================================================
 * Valida los 12 casos exhaustivos de checkout, mitigación de tampering, cupones,
 * cálculo de precios canónicos, estados operativos e idempotencia atómica,
 * más las auditorías de modo fallback en producción (HTTP 503) y lease timeout.
 * ============================================================================
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createServerAuthorizedOrder,
  computeCanonicalPayloadHash,
  validateIdempotencyKeyFormat,
  testIdempotencyStore,
  testOrdersStore,
  getAuthoritativeRestaurant
} from '../src/server/orderService';
import { MOCK_RESTAURANTS } from '../src/data';

describe('FASE 7B: Checkout Fiduciario e Idempotencia Distribuida (12 Casos Oficiales)', () => {

  beforeEach(() => {
    testIdempotencyStore.clear();
    testOrdersStore.clear();
  });

  // --- CASO 1: CÁLCULO CANÓNICO CON CATÁLOGO OFICIAL DEL COMERCIO ---
  it('CASO 1: Cálculo canónico con catálogo oficial del comercio', async () => {
    // r_rayo_burguer: rb1 = Rayo Clásica Burguer (Q35.00)
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [
        { productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 2 }
      ],
      deliveryAddress: '3ra Calle 4-15 Zona 1',
      deliveryPhone: '50241070444'
    };

    const result = await createServerAuthorizedOrder('usr_client_01', 'client@rayo.gt', payload);

    assert.ok(result.orderId, 'Debe generarse un orderId válido');
    assert.equal(result.order.restaurantId, 'r_rayo_burguer');
    assert.equal(result.order.items[0].price, 35.00, 'Precio unitario canónico debe ser Q35.00');
    assert.equal(result.order.subtotal, 70.00, 'Subtotal debe ser 2 * 35.00 = Q70.00');
    assert.equal(result.order.deliveryFee, 0, 'Tarifa de entrega fiduciaria debe ser calculada por servidor');
    assert.equal(result.order.total, 70.00, 'Total debe ser exactamente Q70.00');
    assert.equal(result.order.status, 'recibido');
  });

  // --- CASO 2: INTENTO DE MANIPULACIÓN DE PRECIO EN PAYLOAD ---
  it('CASO 2: Intento de manipulación de precio en payload (debe ignorarse y prevalecer el precio oficial)', async () => {
    const maliciousPayload = {
      restaurantId: 'r_rayo_burguer',
      items: [
        { 
          productId: 'rb1', 
          name: 'Rayo Clásica Burguer', 
          quantity: 3,
          price: 0.50 // Intento malicioso de fijar precio a Q0.50
        }
      ],
      deliveryAddress: 'Calle Real 1-20',
      deliveryPhone: '50255554444'
    };

    const result = await createServerAuthorizedOrder('usr_hacker_01', 'hacker@test.local', maliciousPayload);

    assert.equal(result.order.items[0].price, 35.00, 'El precio fijado debe ser el oficial de Q35.00 y no Q0.50');
    assert.equal(result.order.subtotal, 105.00, 'Subtotal oficial debe ser 3 * 35.00 = Q105.00');
    assert.equal(result.order.total, 105.00, 'Total oficial debe ser Q105.00 sin permitir descuento por tampering');
  });

  // --- CASO 3: CUPÓN VÁLIDO (DESCUENTO EXACTO) ---
  it('CASO 3: Cupón válido (descuento exacto porcentual y fijo)', async () => {
    // BIRRIA2GO: 50% de descuento
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [
        { productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 2 } // Subtotal 70.00
      ],
      couponCode: 'BIRRIA2GO',
      deliveryAddress: 'Avenida Las Palmeras 5-10',
      deliveryPhone: '50241070444'
    };

    const result = await createServerAuthorizedOrder('usr_coupon_user', 'coupon@rayo.gt', payload);

    assert.equal(result.order.subtotal, 70.00);
    assert.equal(result.order.discount, 35.00, 'Descuento del 50% en subtotal de Q70.00 debe ser Q35.00');
    assert.equal(result.order.couponCode, 'BIRRIA2GO');
    assert.equal(result.order.total, 35.00, 'Total final debe ser Q35.00');
  });

  // --- CASO 4: CUPÓN INVÁLIDO (RECHAZADO O IGNORADO SIN APLICAR DESCUENTO) ---
  it('CASO 4: Cupón inválido (ignorado sin aplicar descuento arbitrario)', async () => {
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [
        { productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 } // Subtotal 35.00
      ],
      couponCode: 'CUPON_FANTASMA_100',
      deliveryAddress: 'Avenida Centroamérica 8-20',
      deliveryPhone: '50241070444'
    };

    const result = await createServerAuthorizedOrder('usr_client_02', 'test2@rayo.gt', payload);

    assert.equal(result.order.discount, 0, 'No debe aplicarse ningún descuento');
    assert.equal(result.order.couponCode, '', 'No debe registrarse cupón aplicado');
    assert.equal(result.order.total, 35.00, 'Total debe permanecer en Q35.00');
  });

  // --- CASO 5: COMERCIO CERRADO O INHABILITADO (RECHAZAR PEDIDO) ---
  it('CASO 5: Comercio inhabilitado o cerrado debe rechazar el pedido', async () => {
    // Buscamos o simulamos un restaurante no aprobado o cerrado
    const originalApproved = MOCK_RESTAURANTS[0].isApproved;
    try {
      MOCK_RESTAURANTS[0].isApproved = false; // Simular no aprobado
      await assert.rejects(
        async () => {
          await createServerAuthorizedOrder('usr_client_03', 'test3@rayo.gt', {
            restaurantId: MOCK_RESTAURANTS[0].id,
            items: [{ productId: MOCK_RESTAURANTS[0].menu[0].id, quantity: 1 }],
            deliveryAddress: 'Zona 1',
            deliveryPhone: '50212345678'
          });
        },
        (err: any) => {
          assert.equal(err.status, 400);
          assert.match(err.message, /se encuentra en revisión/i);
          return true;
        }
      );
    } finally {
      MOCK_RESTAURANTS[0].isApproved = originalApproved;
    }
  });

  // --- CASO 6: PRODUCTO AGOTADO (RECHAZAR PEDIDO) ---
  it('CASO 6: Producto agotado (isOutOfStock) debe ser rechazado', async () => {
    const product = MOCK_RESTAURANTS[0].menu[0];
    const originalOutOfStock = product.isOutOfStock;
    try {
      product.isOutOfStock = true;
      await assert.rejects(
        async () => {
          await createServerAuthorizedOrder('usr_client_04', 'test4@rayo.gt', {
            restaurantId: MOCK_RESTAURANTS[0].id,
            items: [{ productId: product.id, quantity: 1 }],
            deliveryAddress: 'Zona 2',
            deliveryPhone: '50212345678'
          });
        },
        (err: any) => {
          assert.equal(err.status, 400);
          assert.match(err.message, /se encuentra agotado/i);
          return true;
        }
      );
    } finally {
      product.isOutOfStock = originalOutOfStock;
    }
  });

  // --- CASO 7: CLAVE DE IDEMPOTENCIA NUEVA (CREAR PEDIDO Y PERSISTIR CLAVE) ---
  it('CASO 7: Clave de idempotencia nueva crea pedido y persiste registro', async () => {
    const key = `idem_${Date.now()}_testcase07`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }],
      deliveryAddress: 'Barrio La Joyita',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    const result = await createServerAuthorizedOrder('usr_client_07', 'c7@rayo.gt', payload);

    assert.ok(result.orderId);
    assert.equal(result.isDuplicate, false);
    assert.ok(testIdempotencyStore.has(key), 'La clave de idempotencia debe haber sido persistida');
    const stored = testIdempotencyStore.get(key)!;
    assert.equal(stored.orderId, result.orderId);
    assert.equal(stored.status, 'completed');
  });

  // --- CASO 8: MISMA CLAVE Y MISMO PAYLOAD (DEVOLVER PEDIDO ORIGINAL SIN DUPLICAR) ---
  it('CASO 8: Misma clave y mismo payload devuelve pedido original con isDuplicate: true', async () => {
    const key = `idem_${Date.now()}_testcase08`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 2 }],
      deliveryAddress: 'Colonia San Antonio Casa 4',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    const firstCall = await createServerAuthorizedOrder('usr_client_08', 'c8@rayo.gt', payload);
    assert.equal(firstCall.isDuplicate, false);

    const secondCall = await createServerAuthorizedOrder('usr_client_08', 'c8@rayo.gt', payload);
    assert.equal(secondCall.isDuplicate, true, 'Debe marcarse como respuesta duplicada');
    assert.equal(secondCall.orderId, firstCall.orderId, 'El orderId debe ser exactamente el mismo');
    assert.equal(secondCall.order.total, firstCall.order.total, 'Los totales deben ser idénticos');
    assert.equal(testOrdersStore.size, 1, 'No debe haberse creado un segundo pedido en la base de datos');
  });

  // --- CASO 9: MISMA CLAVE CON PAYLOAD DIFERENTE (DEVOLVER HTTP 409 CONFLICT) ---
  it('CASO 9: Misma clave con payload divergente rechaza con HTTP 409 Conflict', async () => {
    const key = `idem_${Date.now()}_testcase09`;
    const originalPayload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }],
      deliveryAddress: 'Dirección A',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    await createServerAuthorizedOrder('usr_client_09', 'c9@rayo.gt', originalPayload);

    const tamperedPayload = {
      ...originalPayload,
      deliveryAddress: 'Dirección B Completamente Diferente' // Payload alterado
    };

    await assert.rejects(
      async () => {
        await createServerAuthorizedOrder('usr_client_09', 'c9@rayo.gt', tamperedPayload);
      },
      (err: any) => {
        assert.equal(err.status, 409, 'Debe arrojar HTTP 409 Conflict');
        assert.match(err.message, /contenido de pedido diferente/i);
        return true;
      }
    );
  });

  // --- CASO 10: MISMA CLAVE POR USUARIO DIFERENTE (DEVOLVER HTTP 409 CONFLICT) ---
  it('CASO 10: Misma clave por usuario diferente rechaza con HTTP 409 Conflict', async () => {
    const key = `idem_${Date.now()}_testcase10`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }],
      deliveryAddress: 'Dirección Compartida',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    await createServerAuthorizedOrder('usr_legit_owner', 'legit@rayo.gt', payload);

    await assert.rejects(
      async () => {
        await createServerAuthorizedOrder('usr_attacker_hijack', 'attacker@rayo.gt', payload);
      },
      (err: any) => {
        assert.equal(err.status, 409, 'Debe arrojar HTTP 409 Conflict');
        assert.match(err.message, /ya fue utilizada por otro usuario/i);
        return true;
      }
    );
  });

  // --- CASO 11: DOS PETICIONES CONCURRENTES CON LA MISMA CLAVE ---
  it('CASO 11: Dos peticiones concurrentes con la misma clave resuelven atómicamente', async () => {
    const key = `idem_${Date.now()}_testcase11`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }],
      deliveryAddress: 'Calle Central 5-50',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    // Lanzar dos peticiones al mismo tiempo
    const [res1, res2] = await Promise.all([
      createServerAuthorizedOrder('usr_concurrent_user', 'conc@rayo.gt', payload),
      createServerAuthorizedOrder('usr_concurrent_user', 'conc@rayo.gt', payload)
    ]);

    assert.equal(res1.orderId, res2.orderId, 'Ambas peticiones deben resolver al mismo orderId');
    const duplicateCount = (res1.isDuplicate ? 1 : 0) + (res2.isDuplicate ? 1 : 0);
    assert.equal(duplicateCount, 1, 'Exactamente una petición debió ser original y la otra duplicada');
    assert.equal(testOrdersStore.size, 1, 'Solo debe existir un documento de orden en almacenamiento');
  });

  // --- CASO 12: REINTENTO TRAS ERROR DE RED (DEVOLVER PEDIDO EXISTENTE SIN DUPLICAR) ---
  it('CASO 12: Reintento tras error de red devuelve el pedido persistido sin duplicidad', async () => {
    const key = `idem_${Date.now()}_testcase12`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 2 }],
      deliveryAddress: 'Avenida Bolivar 20-30',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    // 1. Cliente envía y el pedido se crea en servidor, pero la red cae antes de recibir 201
    const serverCreated = await createServerAuthorizedOrder('usr_client_retry', 'retry@rayo.gt', payload);
    assert.ok(serverCreated.orderId);

    // 2. Cliente reintenta automáticamente con la misma clave idempotente
    const clientRetried = await createServerAuthorizedOrder('usr_client_retry', 'retry@rayo.gt', payload);

    assert.equal(clientRetried.orderId, serverCreated.orderId, 'El reintento debe devolver el mismo pedido');
    assert.equal(clientRetried.isDuplicate, true, 'Debe indicar que fue recuperado de idempotencia');
    assert.equal(clientRetried.order.total, serverCreated.order.total, 'El total debe ser consistente');
    assert.equal(testOrdersStore.size, 1, 'No existe duplicación de pedido en almacenamiento');
  });

  // --- CASO 13: MODO FALLBACK EN PRODUCCIÓN ESTRICTAMENTE PROHIBIDO (HTTP 503) ---
  it('CASO 13: En producción (NODE_ENV=production), prohibir fallbacks en memoria y devolver HTTP 503', async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      // Restaurante que forzará fallo o intentará fallback
      await assert.rejects(
        async () => {
          await createServerAuthorizedOrder('usr_prod_test', 'prod@rayo.gt', {
            restaurantId: 'r_rayo_burguer',
            items: [{ productId: 'rb1', quantity: 1 }],
            deliveryAddress: 'Zona 10',
            deliveryPhone: '50212345678',
            idempotencyKey: `idem_prod_${Date.now()}_test503`
          });
        },
        (err: any) => {
          // En producción sin Firestore Admin accesible, debe devolver HTTP 503 y NO usar testOrdersStore
          assert.equal(err.status, 503, 'Debe arrojar HTTP 503 en producción');
          assert.match(err.message, /Servicio no disponible/i);
          return true;
        }
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // --- CASO 14: PREVENCIÓN DE ESTADOS PROCESSING HUÉRFANOS MEDIANTE LEASE TIMEOUT ---
  it('CASO 14: Estado "processing" huérfano con más de 60 segundos permite recuperación', async () => {
    const key = `idem_${Date.now()}_testcase14`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }],
      deliveryAddress: 'Zona 4',
      deliveryPhone: '50212345678',
      idempotencyKey: key
    };

    const hash = computeCanonicalPayloadHash(payload);

    // Simular lock que quedó huérfano hace 70 segundos (cuelgue de proceso anterior)
    testIdempotencyStore.set(key, {
      key,
      userId: 'usr_orphan_recovery',
      payloadHash: hash,
      orderId: 'temp_orphan_id',
      status: 'processing',
      orderData: null,
      createdAt: Date.now() - 70000 // 70s atrás (> 60s lease)
    });

    // Petición entrante debe detectar el lease expirado y culminar la orden exitosamente
    const recovered = await createServerAuthorizedOrder('usr_orphan_recovery', 'orphan@rayo.gt', payload);
    assert.ok(recovered.orderId);
    assert.notEqual(recovered.orderId, 'temp_orphan_id');
    const updated = testIdempotencyStore.get(key)!;
    assert.equal(updated.status, 'completed', 'El estado colgado debió ser recuperado a completed');
  });

});
