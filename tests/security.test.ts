/**
 * =====================================================================
 * BANCO DE PRUEBAS DE SEGURIDAD EJECUTABLES - RAYO DELIVERY
 * Identificador de pruebas: rayo-delivery-testing-sandbox
 * Casos cubiertos: SEC-01 a SEC-20
 * =====================================================================
 * IMPORTANTE:
 * - Conecta exclusivamente al Firebase Emulator Suite local (127.0.0.1:8080).
 * - Carga explícitamente el borrador NO APROBADO: firestore.test.rules.
 * - No importa ni se conecta a la configuración de Firebase de la app en la nube.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

export const TEST_PROJECT_ID = 'rayo-delivery-testing-sandbox';
export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PORT = 8080;

describe('Suite de Seguridad Firestore - Rayo Delivery (rayo-delivery-testing-sandbox)', () => {
  let testEnv: RulesTestEnvironment;

  before(async () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.test.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: TEST_PROJECT_ID,
      firestore: {
        host: EMULATOR_HOST,
        port: EMULATOR_PORT,
        rules,
      },
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // ===================================================================
  // BLOQUE 1: PRUEBAS ANTERIORES REVISADAS (SEC-01 A SEC-09)
  // ===================================================================

  it('SEC-01: un cliente NO puede auto-asignarse super_admin ni alterar su saldo (balance)', async () => {
    const clientUid = 'test_client_a_01';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', clientUid), {
        name: 'Cliente A',
        email: 'cliente_a@sandbox.local',
        address: '4ta Calle 2-10 Zona 1',
        phone: '50212345678',
        role: 'client',
        isSuperAdmin: false,
        isVerifiedRider: false,
        balance: 0,
      });
    });

    const clientDb = testEnv.authenticatedContext(clientUid, { email: 'cliente_a@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Elevar rol a super_admin
    await assertFails(
      updateDoc(doc(clientDb, 'users', clientUid), {
        role: 'super_admin',
        isSuperAdmin: true,
      })
    );

    // Intento 2 (Negativo): Alterar saldo financiero
    await assertFails(
      updateDoc(doc(clientDb, 'users', clientUid), {
        balance: 99999,
      })
    );

    // Intento 3 (Positivo legítimo): Actualizar dirección y teléfono
    await assertSucceeds(
      updateDoc(doc(clientDb, 'users', clientUid), {
        address: 'Nueva Dirección 5-20 Zona 2',
        phone: '50287654321',
      })
    );
  });

  it('SEC-02: un cliente NO puede registrarse inicialmente como superadministrador', async () => {
    const attackerUid = 'test_attacker_01';
    const attackerDb = testEnv.authenticatedContext(attackerUid, { email: 'attacker@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Registro inicial intentando ser super_admin con saldo
    await assertFails(
      setDoc(doc(attackerDb, 'users', attackerUid), {
        name: 'Atacante',
        email: 'attacker@sandbox.local',
        address: 'Zona 1',
        role: 'super_admin',
        isSuperAdmin: true,
        balance: 5000,
      })
    );

    // Intento 2 (Positivo legítimo): Registro inicial estándar como cliente
    await assertSucceeds(
      setDoc(doc(attackerDb, 'users', attackerUid), {
        name: 'Cliente Legítimo',
        email: 'attacker@sandbox.local',
        address: 'Zona 1',
        role: 'client',
        isSuperAdmin: false,
        isVerifiedRider: false,
        balance: 0,
      })
    );
  });

  it('SEC-03: un repartidor pendiente (no verificado) NO puede aceptar pedidos libres', async () => {
    const pendingRiderUid = 'test_rider_pending_01';
    const orderId = 'order_free_sec03';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', pendingRiderUid), {
        name: 'Repartidor Pendiente',
        email: 'rider_p@sandbox.local',
        role: 'rider',
        isVerifiedRider: false,
      });
      await setDoc(doc(adminDb, 'restaurants', 'rest_burguer_test'), {
        name: 'Rayo Burguer',
        image: 'https://example.com/burguer.jpg',
        rating: 5.0,
      });
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: 'test_client_a_01',
        restaurantId: 'rest_burguer_test',
        status: 'recibido',
        riderId: 'SYSTEM',
        total: 50.00,
        items: [{ name: 'Burguer', price: 50, quantity: 1 }],
        deliveryAddress: 'Calle Central',
      });
    });

    const pendingRiderDb = testEnv.authenticatedContext(pendingRiderUid, { email: 'rider_p@sandbox.local' }).firestore();

    // Intento (Negativo): Repartidor no verificado intenta tomar el pedido libre
    await assertFails(
      updateDoc(doc(pendingRiderDb, 'orders', orderId), {
        riderId: pendingRiderUid,
        riderName: 'Repartidor Pendiente',
        riderPhone: '50211112222',
        status: 'preparacion',
        assignedAt: serverTimestamp(),
      })
    );
  });

  it('SEC-04: un repartidor aprobado NO puede leer pedidos históricos ajenos', async () => {
    const riderUid = 'test_rider_approved_01';
    const otherRiderUid = 'test_rider_approved_02';
    const historicalOrderId = 'order_delivered_historical_sec04';
    const assignedOrderId = 'order_assigned_sec04';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', riderUid), {
        name: 'Repartidor 1',
        email: 'rider1@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'restaurants', 'rest_burguer_test'), {
        name: 'Rayo Burguer',
        image: 'https://example.com/burguer.jpg',
        rating: 5.0,
      });
      await setDoc(doc(adminDb, 'orders', historicalOrderId), {
        userId: 'test_client_a_01',
        restaurantId: 'rest_burguer_test',
        status: 'entregado',
        riderId: otherRiderUid,
        total: 80.00,
        items: [{ name: 'Combo Familiar', price: 80, quantity: 1 }],
        deliveryAddress: 'Dirección privada cliente A',
      });
      await setDoc(doc(adminDb, 'orders', assignedOrderId), {
        userId: 'test_client_a_01',
        restaurantId: 'rest_burguer_test',
        status: 'camino',
        riderId: riderUid,
        total: 40.00,
        items: [{ name: 'Almuerzo', price: 40, quantity: 1 }],
        deliveryAddress: 'Dirección cliente A',
      });
    });

    const riderDb = testEnv.authenticatedContext(riderUid, { email: 'rider1@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Repartidor intenta leer pedido histórico ajeno
    await assertFails(
      getDoc(doc(riderDb, 'orders', historicalOrderId))
    );

    // Intento 2 (Positivo legítimo): Repartidor lee el pedido que tiene asignado
    await assertSucceeds(
      getDoc(doc(riderDb, 'orders', assignedOrderId))
    );
  });

  it('SEC-05: un cliente NO puede cambiar el estado de su pedido a entregado', async () => {
    const clientUid = 'test_client_a_01';
    const riderUid = 'test_rider_approved_01';
    const orderId = 'order_active_sec05';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', riderUid), {
        name: 'Repartidor 1',
        email: 'rider1@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: clientUid,
        restaurantId: 'rest_burguer_test',
        status: 'camino',
        riderId: riderUid,
        total: 35.00,
        items: [{ name: 'Hamburguesa', price: 35, quantity: 1 }],
        deliveryAddress: 'Calle 10',
      });
    });

    const clientDb = testEnv.authenticatedContext(clientUid, { email: 'cliente_a@sandbox.local' }).firestore();
    const riderDb = testEnv.authenticatedContext(riderUid, { email: 'rider1@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Cliente intenta marcar como entregado
    await assertFails(
      updateDoc(doc(clientDb, 'orders', orderId), {
        status: 'entregado',
      })
    );

    // Intento 2 (Positivo legítimo): Repartidor asignado marca como entregado
    await assertSucceeds(
      updateDoc(doc(riderDb, 'orders', orderId), {
        status: 'entregado',
        deliveredAt: serverTimestamp(),
        totalTimeMinutes: 18,
      })
    );
  });

  it('SEC-06: un restaurante NO puede modificar el menú de otro restaurante', async () => {
    const merchantAUid = 'test_merchant_a_01';
    const merchantBUid = 'test_merchant_b_01';
    const restAId = 'rest_burguer_test';
    const restBId = 'rest_pizza_test';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', merchantAUid), {
        name: 'Admin Burguer',
        email: 'merchant_a@sandbox.local',
        role: 'admin',
        restaurantId: restAId,
      });
      await setDoc(doc(adminDb, 'users', merchantBUid), {
        name: 'Admin Pizza',
        email: 'merchant_b@sandbox.local',
        role: 'admin',
        restaurantId: restBId,
      });
      await setDoc(doc(adminDb, 'restaurants', restAId), {
        name: 'Rayo Burguer',
        image: 'https://example.com/burguer.jpg',
        rating: 5.0,
      });
      await setDoc(doc(adminDb, 'restaurants', restBId), {
        name: 'Rayo Pizza',
        image: 'https://example.com/pizza.jpg',
        rating: 4.8,
      });
      await setDoc(doc(adminDb, 'restaurants', restBId, 'menu', 'prod_pizza_01'), {
        name: 'Pizza Pepperoni',
        price: 75.00,
        image: 'https://example.com/pep.jpg',
        category: 'Pizza',
      });
    });

    const merchantADb = testEnv.authenticatedContext(merchantAUid, { email: 'merchant_a@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Restaurante A intenta modificar precio en el menú de Restaurante B
    await assertFails(
      setDoc(doc(merchantADb, 'restaurants', restBId, 'menu', 'prod_pizza_01'), {
        price: 10.00,
      }, { merge: true })
    );

    // Intento 2 (Positivo legítimo): Restaurante A agrega un producto a su propio menú
    await assertSucceeds(
      setDoc(doc(merchantADb, 'restaurants', restAId, 'menu', 'prod_burguer_01'), {
        name: 'Doble Queso',
        price: 45.00,
        image: 'https://example.com/doble.jpg',
        category: 'Hamburguesas',
      })
    );
  });

  it('SEC-07: un usuario NO puede leer mensajes de chat de un pedido ajeno', async () => {
    const clientAUid = 'test_client_a_01';
    const clientBUid = 'test_client_b_02';
    const riderUid = 'test_rider_approved_01';
    const orderId = 'order_chat_sec07';
    const msgId = 'msg_secret_01';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: clientAUid,
        restaurantId: 'rest_burguer_test',
        status: 'camino',
        riderId: riderUid,
        total: 50.00,
        items: [{ name: 'Orden', price: 50, quantity: 1 }],
        deliveryAddress: 'Casa 4B',
      });
      await setDoc(doc(adminDb, 'orders', orderId, 'messages', msgId), {
        senderId: clientAUid,
        senderName: 'Cliente A',
        text: 'Instrucción privada de entrega: dejar en garita.',
        timestamp: serverTimestamp(),
      });
    });

    const unrelatedClientDb = testEnv.authenticatedContext(clientBUid, { email: 'cliente_b@sandbox.local' }).firestore();
    const authorizedClientDb = testEnv.authenticatedContext(clientAUid, { email: 'cliente_a@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Usuario B intenta leer el mensaje del chat del pedido de A
    await assertFails(
      getDoc(doc(unrelatedClientDb, 'orders', orderId, 'messages', msgId))
    );

    // Intento 2 (Positivo legítimo): El cliente participante A lee su propio mensaje
    await assertSucceeds(
      getDoc(doc(authorizedClientDb, 'orders', orderId, 'messages', msgId))
    );

    // Intento 3 (Negativo query): Usuario B intenta consultar/listar mensajes del pedido de A
    await assertFails(
      getDocs(collection(unrelatedClientDb, 'orders', orderId, 'messages'))
    );

    // Intento 4 (Positivo query): Cliente A consulta/lista los mensajes de su propio pedido
    await assertSucceeds(
      getDocs(collection(authorizedClientDb, 'orders', orderId, 'messages'))
    );
  });

  it('SEC-08: operaciones legítimas de Cliente, Comercio y Repartidor Aprobado funcionan', async () => {
    const clientUid = 'test_client_legit_08';
    const merchantUid = 'test_merchant_legit_08';
    const riderUid = 'test_rider_legit_08';
    const restId = 'rest_legit_08';
    const orderId = 'order_legit_flow_08';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', clientUid), {
        name: 'Cliente Flujo',
        email: 'client_flow@sandbox.local',
        role: 'client',
        isSuperAdmin: false,
        isVerifiedRider: false,
        balance: 0,
      });
      await setDoc(doc(adminDb, 'users', merchantUid), {
        name: 'Comercio Flujo',
        email: 'merchant_flow@sandbox.local',
        role: 'admin',
        restaurantId: restId,
      });
      await setDoc(doc(adminDb, 'users', riderUid), {
        name: 'Rider Flujo',
        email: 'rider_flow@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'restaurants', restId), {
        name: 'Restaurante Flujo',
        image: 'https://example.com/img.jpg',
        rating: 5.0,
      });
    });

    const clientDb = testEnv.authenticatedContext(clientUid, { email: 'client_flow@sandbox.local' }).firestore();
    const merchantDb = testEnv.authenticatedContext(merchantUid, { email: 'merchant_flow@sandbox.local' }).firestore();
    const riderDb = testEnv.authenticatedContext(riderUid, { email: 'rider_flow@sandbox.local' }).firestore();

    // Paso 1 (Positivo): Cliente crea pedido legítimo con status recibido y riderId SYSTEM
    await assertSucceeds(
      setDoc(doc(clientDb, 'orders', orderId), {
        userId: clientUid,
        restaurantId: restId,
        status: 'recibido',
        riderId: 'SYSTEM',
        total: 65.00,
        items: [{ name: 'Super Combo', price: 65, quantity: 1 }],
        deliveryAddress: '3ra Avenida 4-12 Zona 3',
      })
    );

    // Paso 2 (Positivo): Comercio avanza pedido a preparación
    await assertSucceeds(
      updateDoc(doc(merchantDb, 'orders', orderId), {
        status: 'preparacion',
      })
    );

    // Paso 3 (Positivo): Repartidor aprobado toma el pedido libre
    await assertSucceeds(
      updateDoc(doc(riderDb, 'orders', orderId), {
        riderId: riderUid,
        riderName: 'Rider Flujo',
        riderPhone: '50255556666',
        status: 'preparacion',
        assignedAt: serverTimestamp(),
      })
    );

    // Paso 4 (Positivo): Repartidor avanza a camino
    await assertSucceeds(
      updateDoc(doc(riderDb, 'orders', orderId), {
        status: 'camino',
      })
    );

    // Paso 5 (Positivo): Repartidor marca entregado con totalTimeMinutes
    await assertSucceeds(
      updateDoc(doc(riderDb, 'orders', orderId), {
        status: 'entregado',
        deliveredAt: serverTimestamp(),
        totalTimeMinutes: 25,
      })
    );

    // Paso 6 (Positivo): Cliente califica el pedido una vez entregado
    await assertSucceeds(
      updateDoc(doc(clientDb, 'orders', orderId), {
        review: {
          rating: 5,
          comment: 'Rápido y caliente!',
        },
      })
    );
  });

  it('SEC-09: dos repartidores intentan aceptar el mismo pedido; exactamente uno gana y el segundo es rechazado', async () => {
    const rider1Uid = 'test_rider_conc_01';
    const rider2Uid = 'test_rider_conc_02';
    const orderId = 'order_concurrent_sec09';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', rider1Uid), {
        name: 'Rider 1',
        email: 'r1@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'users', rider2Uid), {
        name: 'Rider 2',
        email: 'r2@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'restaurants', 'rest_burguer_test'), {
        name: 'Rayo Burguer',
        image: 'https://example.com/burguer.jpg',
        rating: 5.0,
      });
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: 'test_client_a_01',
        restaurantId: 'rest_burguer_test',
        status: 'recibido',
        riderId: 'SYSTEM',
        total: 55.00,
        items: [{ name: 'Hamburguesa Doble', price: 55, quantity: 1 }],
        deliveryAddress: 'Diagonal 6',
      });
    });

    const rider1Db = testEnv.authenticatedContext(rider1Uid, { email: 'r1@sandbox.local' }).firestore();
    const rider2Db = testEnv.authenticatedContext(rider2Uid, { email: 'r2@sandbox.local' }).firestore();

    const acceptOrderTransaction = async (firestoreInstance: any, riderId: string, riderName: string) => {
      const targetRef = doc(firestoreInstance, 'orders', orderId);
      return runTransaction(firestoreInstance, async (tx) => {
        const snap = await tx.get(targetRef);
        if (!snap.exists()) {
          throw new Error('Pedido no existe');
        }
        const data = snap.data();
        if (data.riderId !== 'SYSTEM' || (data.status !== 'recibido' && data.status !== 'preparacion')) {
          throw new Error('Pedido ya no disponible');
        }
        tx.update(targetRef, {
          riderId,
          riderName,
          riderPhone: '50200000000',
          status: 'preparacion',
          assignedAt: serverTimestamp(),
        });
      });
    };

    const [result1, result2] = await Promise.allSettled([
      acceptOrderTransaction(rider1Db, rider1Uid, 'Rider 1'),
      acceptOrderTransaction(rider2Db, rider2Uid, 'Rider 2'),
    ]);

    const successes = [result1, result2].filter((r) => r.status === 'fulfilled');
    const failures = [result1, result2].filter((r) => r.status === 'rejected');

    assert.equal(successes.length, 1, 'Exactamente una transacción debe tener éxito');
    assert.equal(failures.length, 1, 'Exactamente una transacción debe ser rechazada');

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      const finalSnap = await getDoc(doc(adminDb, 'orders', orderId));
      assert.ok(finalSnap.exists());
      const finalData = finalSnap.data();
      assert.notEqual(finalData.riderId, 'SYSTEM');
      assert.ok(finalData.riderId === rider1Uid || finalData.riderId === rider2Uid);
    });
  });

  // ===================================================================
  // BLOQUE 2: ESCENARIOS ADICIONALES AMPLIADOS (SEC-10 A SEC-15)
  // ===================================================================

  it('SEC-10: un restaurante NO puede cancelar un pedido que ya fue entregado (State Shortcut)', async () => {
    const merchantUid = 'test_merchant_sec10';
    const restId = 'rest_sec10';
    const orderId = 'order_delivered_sec10';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', merchantUid), {
        name: 'Comercio Sec10',
        email: 'merchant10@sandbox.local',
        role: 'admin',
        restaurantId: restId,
      });
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: 'test_client_a_01',
        restaurantId: restId,
        status: 'entregado', // Ya entregado y liquidado
        riderId: 'test_rider_approved_01',
        total: 50.00,
        items: [{ name: 'Combo', price: 50, quantity: 1 }],
        deliveryAddress: 'Zona 10',
      });
    });

    const merchantDb = testEnv.authenticatedContext(merchantUid, { email: 'merchant10@sandbox.local' }).firestore();

    // Intento (Negativo): Restaurante intenta revertir a 'cancelado' para anular comisión
    await assertFails(
      updateDoc(doc(merchantDb, 'orders', orderId), {
        status: 'cancelado',
      })
    );
  });

  it('SEC-11: un cliente NO puede crear un pedido apuntando a un restaurante inexistente (Orphaned Order)', async () => {
    const clientUid = 'test_client_sec11';
    const nonExistentRestId = 'rest_fantasma_404';
    const orderId = 'order_orphan_sec11';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', clientUid), {
        name: 'Cliente Sec11',
        email: 'client11@sandbox.local',
        role: 'client',
      });
    });

    const clientDb = testEnv.authenticatedContext(clientUid, { email: 'client11@sandbox.local' }).firestore();

    // Intento (Negativo): Crear orden hacia un comercio que no existe en /restaurants
    await assertFails(
      setDoc(doc(clientDb, 'orders', orderId), {
        userId: clientUid,
        restaurantId: nonExistentRestId,
        status: 'recibido',
        riderId: 'SYSTEM',
        total: 45.00,
        items: [{ name: 'Hamburguesa', price: 45, quantity: 1 }],
        deliveryAddress: 'Zona 1',
      })
    );
  });

  it('SEC-12: un cliente NO puede introducir campos de entrega o evaluación indebidos al crear un pedido (Ghost Fields)', async () => {
    const clientUid = 'test_client_sec12';
    const restId = 'rest_valid_sec12';
    const orderId = 'order_ghost_sec12';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', clientUid), {
        name: 'Cliente Sec12',
        email: 'client12@sandbox.local',
        role: 'client',
      });
      await setDoc(doc(adminDb, 'restaurants', restId), {
        name: 'Restaurante Válido',
        image: 'https://example.com/logo.jpg',
        rating: 4.9,
      });
    });

    const clientDb = testEnv.authenticatedContext(clientUid, { email: 'client12@sandbox.local' }).firestore();

    // Intento (Negativo): Cliente inyecta deliveredAt y review en la creación inicial
    await assertFails(
      setDoc(doc(clientDb, 'orders', orderId), {
        userId: clientUid,
        restaurantId: restId,
        status: 'recibido',
        riderId: 'SYSTEM',
        total: 50.00,
        items: [{ name: 'Menú', price: 50, quantity: 1 }],
        deliveryAddress: 'Zona 2',
        deliveredAt: serverTimestamp(),
        review: { rating: 5, comment: 'Inyectado' },
      })
    );
  });

  it('SEC-13: un repartidor NO puede leer un pedido cancelado que tenga riderId: "SYSTEM"', async () => {
    const riderUid = 'test_rider_sec13';
    const restId = 'rest_sec13';
    const cancelledOrderId = 'order_cancelled_system_sec13';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', riderUid), {
        name: 'Repartidor Sec13',
        email: 'rider13@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'restaurants', restId), {
        name: 'Restaurante Sec13',
        image: 'https://example.com/r.jpg',
        rating: 4.8,
      });
      await setDoc(doc(adminDb, 'orders', cancelledOrderId), {
        userId: 'test_client_a_01',
        restaurantId: restId,
        status: 'cancelado',
        riderId: 'SYSTEM',
        total: 30.00,
        items: [{ name: 'Bebida', price: 30, quantity: 1 }],
        deliveryAddress: 'Dirección confidencial cliente',
      });
    });

    const riderDb = testEnv.authenticatedContext(riderUid, { email: 'rider13@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Repartidor intenta leer individualmente el pedido cancelado libre
    await assertFails(
      getDoc(doc(riderDb, 'orders', cancelledOrderId))
    );

    // Intento 2 (Negativo query): Repartidor intenta consultar/listar pedidos libres en estado cancelado
    const qCancelled = query(collection(riderDb, 'orders'), where('riderId', '==', 'SYSTEM'), where('status', '==', 'cancelado'));
    await assertFails(
      getDocs(qCancelled)
    );
  });

  it('SEC-14: un repartidor NO puede falsificar la identidad del solicitante de liberación (releaseRequestedBy)', async () => {
    const rider1Uid = 'test_rider_sec14_actual';
    const victimRiderUid = 'test_rider_sec14_victim';
    const restId = 'rest_sec14';
    const orderId = 'order_release_sec14';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', rider1Uid), {
        name: 'Repartidor Asignado',
        email: 'rider14@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: 'test_client_a_01',
        restaurantId: restId,
        status: 'preparacion',
        riderId: rider1Uid,
        total: 60.00,
        items: [{ name: 'Platillo', price: 60, quantity: 1 }],
        deliveryAddress: 'Zona 14',
      });
    });

    const riderDb = testEnv.authenticatedContext(rider1Uid, { email: 'rider14@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Repartidor intenta enviar UID de otro repartidor en releaseRequestedBy
    await assertFails(
      updateDoc(doc(riderDb, 'orders', orderId), {
        releaseRequested: true,
        releaseRequestedBy: victimRiderUid,
        releaseRequestedAt: serverTimestamp(),
      })
    );

    // Intento 2 (Positivo legítimo): Repartidor envía su propio UID
    await assertSucceeds(
      updateDoc(doc(riderDb, 'orders', orderId), {
        releaseRequested: true,
        releaseRequestedBy: rider1Uid,
        releaseRequestedAt: serverTimestamp(),
      })
    );
  });

  it('SEC-15: un administrador de varias sucursales (multi-sucursal) puede consultar pedidos autorizados de sus locales y NO de locales ajenos', async () => {
    const merchantUid = 'test_merchant_multibranch';
    const restAId = 'rest_branch_a';
    const restBId = 'rest_branch_b';
    const restCId = 'rest_competitor_c';
    const orderBId = 'order_in_branch_b';
    const orderCId = 'order_in_branch_c';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', merchantUid), {
        name: 'Comerciante Multi-Sucursal',
        email: 'merchant_multi@sandbox.local',
        role: 'admin',
        restaurantId: restAId,
        ownedRestaurantIds: [restAId, restBId],
      });
      await setDoc(doc(adminDb, 'restaurants', restAId), { name: 'Sucursal A', rating: 5.0, image: 'https://example.com/a.jpg' });
      await setDoc(doc(adminDb, 'restaurants', restBId), { name: 'Sucursal B', rating: 4.9, image: 'https://example.com/b.jpg' });
      await setDoc(doc(adminDb, 'restaurants', restCId), { name: 'Competidor C', rating: 4.5, image: 'https://example.com/c.jpg' });

      await setDoc(doc(adminDb, 'orders', orderBId), {
        userId: 'test_client_a_01',
        restaurantId: restBId,
        status: 'preparacion',
        riderId: 'SYSTEM',
        total: 70.00,
        items: [{ name: 'Pizza Familiar', price: 70, quantity: 1 }],
        deliveryAddress: 'Zona 11',
      });

      await setDoc(doc(adminDb, 'orders', orderCId), {
        userId: 'test_client_a_01',
        restaurantId: restCId,
        status: 'preparacion',
        riderId: 'SYSTEM',
        total: 90.00,
        items: [{ name: 'Sushi Combo', price: 90, quantity: 1 }],
        deliveryAddress: 'Zona 15',
      });
    });

    const merchantDb = testEnv.authenticatedContext(merchantUid, { email: 'merchant_multi@sandbox.local' }).firestore();

    // Intento 1 (Positivo legítimo): Comercio consulta pedido de su sucursal secundaria B
    await assertSucceeds(
      getDoc(doc(merchantDb, 'orders', orderBId))
    );

    // Intento 2 (Negativo): Comercio intenta consultar pedido de restaurante competidor C
    await assertFails(
      getDoc(doc(merchantDb, 'orders', orderCId))
    );

    // Intento 3 (Positivo query): Comercio lista pedidos de su sucursal secundaria B
    const qBranchB = query(collection(merchantDb, 'orders'), where('restaurantId', '==', restBId));
    await assertSucceeds(
      getDocs(qBranchB)
    );

    // Intento 4 (Negativo query): Comercio intenta listar pedidos de restaurante competidor C
    const qBranchC = query(collection(merchantDb, 'orders'), where('restaurantId', '==', restCId));
    await assertFails(
      getDocs(qBranchC)
    );
  });

  // ===================================================================
  // BLOQUE 3: NUEVAS PRUEBAS DE SEGURIDAD (SEC-16 A SEC-20)
  // ===================================================================

  it('SEC-16: un usuario NO puede modificar sus propios campos de verificación facial (faceVerified)', async () => {
    const userUid = 'test_user_sec16';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', userUid), {
        name: 'Usuario Prueba',
        email: 'user16@sandbox.local',
        role: 'rider',
        isVerifiedRider: false,
        faceVerified: false,
      });
    });

    const userDb = testEnv.authenticatedContext(userUid, { email: 'user16@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Usuario intenta auto-aprobarse biométricamente
    await assertFails(
      updateDoc(doc(userDb, 'users', userUid), {
        faceVerified: true,
      })
    );

    // Intento 2 (Negativo): Usuario intenta inyectar timestamp de verificación
    await assertFails(
      updateDoc(doc(userDb, 'users', userUid), {
        faceVerifiedAt: '2026-10-21T12:00:00Z',
      })
    );

    // Intento 3 (Positivo legítimo): Usuario sube su fotografía facial para verificación posterior
    await assertSucceeds(
      updateDoc(doc(userDb, 'users', userUid), {
        facePhotoUrl: 'https://example.com/selfie.jpg',
      })
    );
  });

  it('SEC-17: un usuario sin rol administrativo NO puede listar pedidos usando un restaurantId presente en su perfil', async () => {
    const fakeClientUid = 'test_fake_admin_sec17';
    const restId = 'rest_sec17';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      // Usuario con rol 'client', pero que contiene indebidamente restaurantId en su documento
      await setDoc(doc(adminDb, 'users', fakeClientUid), {
        name: 'Cliente Intruso',
        email: 'fake_admin@sandbox.local',
        role: 'client', // NO es admin
        restaurantId: restId,
      });
      await setDoc(doc(adminDb, 'restaurants', restId), {
        name: 'Restaurante 17',
        rating: 4.8,
        image: 'https://example.com/logo.jpg',
      });
      await setDoc(doc(adminDb, 'orders', 'order_sec17_a'), {
        userId: 'test_client_a_01',
        restaurantId: restId,
        status: 'preparacion',
        riderId: 'SYSTEM',
        total: 85.00,
        items: [{ name: 'Plato', price: 85, quantity: 1 }],
        deliveryAddress: 'Zona 9',
      });
    });

    const fakeClientDb = testEnv.authenticatedContext(fakeClientUid, { email: 'fake_admin@sandbox.local' }).firestore();

    // Intento (Negativo): Cliente intenta listar pedidos del restaurante basándose en su restaurantId
    const q = query(collection(fakeClientDb, 'orders'), where('restaurantId', '==', restId));
    await assertFails(
      getDocs(q)
    );
  });

  it('SEC-18: un perfil sin rol de cliente (ej. repartidor o comerciante) NO puede crear pedidos', async () => {
    const riderUid = 'test_rider_sec18';
    const clientUid = 'test_client_sec18';
    const restId = 'rest_sec18';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', riderUid), {
        name: 'Repartidor Rol',
        email: 'rider18@sandbox.local',
        role: 'rider', // Rol no cliente
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'users', clientUid), {
        name: 'Cliente Rol',
        email: 'client18@sandbox.local',
        role: 'client', // Rol cliente
      });
      await setDoc(doc(adminDb, 'restaurants', restId), {
        name: 'Restaurante 18',
        rating: 4.5,
        image: 'https://example.com/logo.jpg',
      });
    });

    const riderDb = testEnv.authenticatedContext(riderUid, { email: 'rider18@sandbox.local' }).firestore();
    const clientDb = testEnv.authenticatedContext(clientUid, { email: 'client18@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Usuario con rol 'rider' intenta crear un pedido
    await assertFails(
      setDoc(doc(riderDb, 'orders', 'order_fail_sec18'), {
        userId: riderUid,
        restaurantId: restId,
        status: 'recibido',
        riderId: 'SYSTEM',
        total: 40.00,
        items: [{ name: 'Comida', price: 40, quantity: 1 }],
        deliveryAddress: 'Zona 5',
      })
    );

    // Intento 2 (Positivo legítimo): Usuario con rol 'client' crea el pedido
    await assertSucceeds(
      setDoc(doc(clientDb, 'orders', 'order_success_sec18'), {
        userId: clientUid,
        restaurantId: restId,
        status: 'recibido',
        riderId: 'SYSTEM',
        total: 40.00,
        items: [{ name: 'Comida', price: 40, quantity: 1 }],
        deliveryAddress: 'Zona 5',
      })
    );
  });

  it('SEC-19: un comercio NO puede autorizar la liberación de un pedido y asignarle un estado arbitrario', async () => {
    const merchantUid = 'test_merchant_sec19';
    const riderUid = 'test_rider_sec19';
    const restId = 'rest_sec19';
    const orderId = 'order_sec19';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', merchantUid), {
        name: 'Comercio Sec19',
        email: 'merchant19@sandbox.local',
        role: 'admin',
        restaurantId: restId,
      });
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: 'test_client_a_01',
        restaurantId: restId,
        status: 'preparacion',
        riderId: riderUid,
        releaseRequested: true,
        releaseRequestedBy: riderUid,
        releaseRequestedAt: new Date(),
        total: 60.00,
        items: [{ name: 'Combo', price: 60, quantity: 1 }],
        deliveryAddress: 'Zona 12',
      });
    });

    const merchantDb = testEnv.authenticatedContext(merchantUid, { email: 'merchant19@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Comercio intenta liberar marcando el pedido como 'entregado' arbitrariamente
    await assertFails(
      updateDoc(doc(merchantDb, 'orders', orderId), {
        riderId: 'SYSTEM',
        lastRiderId: riderUid,
        releaseRequested: false,
        releaseAuthorizedBy: merchantUid,
        releasedAt: serverTimestamp(),
        status: 'entregado', // Estado arbitrario no permitido al liberar
      })
    );

    // Intento 2 (Negativo): Comercio intenta reasignar a un repartidor tercero arbitrario en vez de 'SYSTEM'
    await assertFails(
      updateDoc(doc(merchantDb, 'orders', orderId), {
        riderId: 'test_third_party_rider', // No permitido; debe ser 'SYSTEM'
        lastRiderId: riderUid,
        releaseRequested: false,
        releaseAuthorizedBy: merchantUid,
        releasedAt: serverTimestamp(),
        status: 'preparacion',
      })
    );

    // Intento 3 (Positivo legítimo): Comercio autoriza liberación restableciendo a 'SYSTEM' y estado 'preparacion'
    await assertSucceeds(
      updateDoc(doc(merchantDb, 'orders', orderId), {
        riderId: 'SYSTEM',
        lastRiderId: riderUid,
        releaseRequested: false,
        releaseAuthorizedBy: merchantUid,
        releasedAt: serverTimestamp(),
        status: 'preparacion',
      })
    );
  });

  it('SEC-20: un actor NO puede modificar campos sensibles ajenos a su transición permitida (Price Tampering / Payment hijacking)', async () => {
    const riderUid = 'test_rider_sec20';
    const restId = 'rest_sec20';
    const orderId = 'order_sec20';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', riderUid), {
        name: 'Rider Sec20',
        email: 'rider20@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: 'test_client_a_01',
        restaurantId: restId,
        status: 'preparacion',
        riderId: riderUid,
        total: 50.00,
        subtotal: 50.00,
        paymentMethod: 'efectivo',
        items: [{ name: 'Hamburguesa', price: 50, quantity: 1 }],
        deliveryAddress: 'Zona 1',
      });
    });

    const riderDb = testEnv.authenticatedContext(riderUid, { email: 'rider20@sandbox.local' }).firestore();
    const superAdminDb = testEnv.authenticatedContext('test_superadmin_sec20', {
      email: 'emunozberber@gmail.com',
      email_verified: true,
      super_admin: true,
    }).firestore();

    // Intento 1 (Negativo): Repartidor avanza a 'camino', pero intenta alterar el total (Price Tampering)
    await assertFails(
      updateDoc(doc(riderDb, 'orders', orderId), {
        status: 'camino',
        total: 150.00, // Campo no autorizado
      })
    );

    // Intento 2 (Negativo): Repartidor intenta alterar el método de pago o dirección
    await assertFails(
      updateDoc(doc(riderDb, 'orders', orderId), {
        status: 'camino',
        paymentMethod: 'tarjeta', // Campo no autorizado
      })
    );

    // Intento 3 (Negativo): Superadministrador intenta alterar el total financiero convenido
    await assertFails(
      updateDoc(doc(superAdminDb, 'orders', orderId), {
        total: 200.00, // Invariante financiera bloqueada incluso para superadmin
      })
    );

    // Intento 4 (Negativo): Superadministrador intenta cambiar el método de pago original
    await assertFails(
      updateDoc(doc(superAdminDb, 'orders', orderId), {
        paymentMethod: 'tarjeta', // Invariante de pago bloqueada
      })
    );

    // Intento 5 (Negativo): Superadministrador intenta forjar o adulterar la reseña del cliente
    await assertFails(
      updateDoc(doc(superAdminDb, 'orders', orderId), {
        review: { rating: 5, comment: 'Reseña forjada por admin', timestamp: serverTimestamp() },
      })
    );

    // Intento 6 (Negativo): Superadministrador intenta adulterar la tarifa de entrega (deliveryFee)
    await assertFails(
      updateDoc(doc(superAdminDb, 'orders', orderId), {
        deliveryFee: 15.00,
      })
    );

    // Intento 7 (Positivo administrativo): Superadministrador realiza actualización operativa permitida (arbitraje)
    await assertSucceeds(
      updateDoc(doc(superAdminDb, 'orders', orderId), {
        status: 'cancelado',
        notes: 'Cancelación administrativa por mediación de soporte',
      })
    );

    // Intento 8 (Positivo legítimo): Repartidor avanza a 'camino' modificando exclusivamente 'status'
    await assertSucceeds(
      updateDoc(doc(riderDb, 'orders', orderId), {
        status: 'camino',
      })
    );
  });

  it('SEC-21: solicitud de liberación enviada por una identidad distinta del repartidor asignado', async () => {
    const assignedRiderUid = 'test_rider_assigned_sec21';
    const intruderRiderUid = 'test_rider_intruder_sec21';
    const restId = 'rest_sec21';
    const orderId = 'order_sec21';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', assignedRiderUid), {
        name: 'Rider Titular',
        email: 'assigned21@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'users', intruderRiderUid), {
        name: 'Rider Intruso',
        email: 'intruder21@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'restaurants', restId), {
        name: 'Restaurante 21',
        rating: 4.6,
      });
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: 'test_client_a_01',
        restaurantId: restId,
        status: 'preparacion',
        riderId: assignedRiderUid,
        total: 55.00,
        items: [{ name: 'Pizza Mediana', price: 55, quantity: 1 }],
        deliveryAddress: 'Zona 10',
      });
    });

    const assignedDb = testEnv.authenticatedContext(assignedRiderUid, { email: 'assigned21@sandbox.local' }).firestore();
    const intruderDb = testEnv.authenticatedContext(intruderRiderUid, { email: 'intruder21@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Repartidor intruso solicita liberar pedido que NO tiene asignado
    await assertFails(
      updateDoc(doc(intruderDb, 'orders', orderId), {
        releaseRequested: true,
        releaseRequestedBy: intruderRiderUid,
        releaseRequestedAt: serverTimestamp(),
      })
    );

    // Intento 2 (Negativo): Repartidor intruso intenta suplantar al asignado en releaseRequestedBy
    await assertFails(
      updateDoc(doc(intruderDb, 'orders', orderId), {
        releaseRequested: true,
        releaseRequestedBy: assignedRiderUid,
        releaseRequestedAt: serverTimestamp(),
      })
    );

    // Intento 3 (Positivo legítimo): Repartidor asignado legítimo solicita la liberación de su propio pedido
    await assertSucceeds(
      updateDoc(doc(assignedDb, 'orders', orderId), {
        releaseRequested: true,
        releaseRequestedBy: assignedRiderUid,
        releaseRequestedAt: serverTimestamp(),
      })
    );
  });

  it('SEC-22: mensaje de pedido con campos reservados o no autorizados', async () => {
    const clientUid = 'test_client_sec22';
    const riderUid = 'test_rider_sec22';
    const restId = 'rest_sec22';
    const orderId = 'order_sec22';
    const validMessageId = 'msg_sec22_01';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', clientUid), {
        name: 'Cliente Chat',
        email: 'client22@sandbox.local',
        role: 'client',
      });
      await setDoc(doc(adminDb, 'users', riderUid), {
        name: 'Rider Chat',
        email: 'rider22@sandbox.local',
        role: 'rider',
        isVerifiedRider: true,
      });
      await setDoc(doc(adminDb, 'restaurants', restId), {
        name: 'Restaurante 22',
        rating: 4.7,
      });
      await setDoc(doc(adminDb, 'orders', orderId), {
        userId: clientUid,
        restaurantId: restId,
        riderId: riderUid,
        status: 'camino',
        total: 70.00,
        items: [{ name: 'Almuerzo', price: 70, quantity: 1 }],
        deliveryAddress: 'Zona 14',
      });
    });

    const clientDb = testEnv.authenticatedContext(clientUid, { email: 'client22@sandbox.local' }).firestore();

    // Intento 1 (Negativo): Cliente intenta enviar mensaje inyectando campos de rol / privilegios reservados
    await assertFails(
      setDoc(doc(clientDb, 'orders', orderId, 'messages', 'msg_hack_01'), {
        text: 'Llegando al punto',
        senderId: clientUid,
        senderName: 'Cliente Chat',
        timestamp: serverTimestamp(),
        isAdmin: true,
        role: 'super_admin',
      })
    );

    // Intento 2 (Negativo): Cliente intenta enviar mensaje con campos no contemplados en el esquema
    await assertFails(
      setDoc(doc(clientDb, 'orders', orderId, 'messages', 'msg_hack_02'), {
        text: 'Instrucciones especiales',
        senderId: clientUid,
        senderName: 'Cliente Chat',
        timestamp: serverTimestamp(),
        priorityLevel: 'urgent',
        discountCode: 'FREE_DELIVERY',
      })
    );

    // Intento 3 (Positivo legítimo): Cliente envía mensaje ajustado al esquema permitido
    await assertSucceeds(
      setDoc(doc(clientDb, 'orders', orderId, 'messages', validMessageId), {
        text: 'Por favor tocar el timbre blanco',
        senderId: clientUid,
        senderName: 'Cliente Chat',
        timestamp: serverTimestamp(),
      })
    );

    // Intento 4 (Negativo): Intento de actualizar el mensaje ya enviado (deben ser inmutables)
    await assertFails(
      updateDoc(doc(clientDb, 'orders', orderId, 'messages', validMessageId), {
        text: 'Texto alterado con posterioridad',
      })
    );

    // Intento 5 (Negativo): Intento de enviar mensaje bajo un pedido inexistente (verificación de existencia del pedido)
    await assertFails(
      setDoc(doc(clientDb, 'orders', 'order_inexistente_404', 'messages', 'msg_orphan_01'), {
        text: 'Mensaje huérfano',
        senderId: clientUid,
        senderName: 'Cliente Chat',
        timestamp: serverTimestamp(),
      })
    );

    // Intento 6 (Negativo): Intento de enviar mensaje omitiendo timestamp obligatorio
    await assertFails(
      setDoc(doc(clientDb, 'orders', orderId, 'messages', 'msg_missing_timestamp'), {
        text: 'Mensaje sin timestamp',
        senderId: clientUid,
        senderName: 'Cliente Chat',
      })
    );
  });

  it('SEC-23: intento de modificar una calificación, si se establece que solo puede enviarse una vez', async () => {
    const clientUid = 'test_client_sec23';
    const restId = 'rest_sec23';
    const orderUnratedId = 'order_sec23_unrated';
    const orderRatedId = 'order_sec23_already_rated';
    const orderOngoingId = 'order_sec23_ongoing';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', clientUid), {
        name: 'Cliente Reseñas',
        email: 'client23@sandbox.local',
        role: 'client',
      });
      await setDoc(doc(adminDb, 'restaurants', restId), {
        name: 'Restaurante 23',
        rating: 4.9,
      });

      // Pedido entregado sin calificación previa
      await setDoc(doc(adminDb, 'orders', orderUnratedId), {
        userId: clientUid,
        restaurantId: restId,
        status: 'entregado',
        total: 45.00,
        items: [{ name: 'Postre', price: 45, quantity: 1 }],
        deliveryAddress: 'Zona 11',
      });

      // Pedido ya calificado con anterioridad
      await setDoc(doc(adminDb, 'orders', orderRatedId), {
        userId: clientUid,
        restaurantId: restId,
        status: 'entregado',
        total: 80.00,
        items: [{ name: 'Cena', price: 80, quantity: 1 }],
        deliveryAddress: 'Zona 11',
        review: {
          rating: 5,
          comment: 'Todo excelente y rápido',
          timestamp: new Date(),
        },
      });

      // Pedido aún en camino (no entregado)
      await setDoc(doc(adminDb, 'orders', orderOngoingId), {
        userId: clientUid,
        restaurantId: restId,
        status: 'camino',
        total: 50.00,
        items: [{ name: 'Bebidas', price: 50, quantity: 1 }],
        deliveryAddress: 'Zona 11',
      });
    });

    const clientDb = testEnv.authenticatedContext(clientUid, { email: 'client23@sandbox.local' }).firestore();

    // Intento 1 (Positivo legítimo): Cliente envía calificación por primera vez sobre pedido entregado
    await assertSucceeds(
      updateDoc(doc(clientDb, 'orders', orderUnratedId), {
        review: {
          rating: 5,
          comment: 'Muy buena comida',
          timestamp: serverTimestamp(),
        },
      })
    );

    // Intento 2 (Negativo): Cliente intenta modificar / sobrescribir la calificación ya existente
    await assertFails(
      updateDoc(doc(clientDb, 'orders', orderRatedId), {
        review: {
          rating: 1,
          comment: 'Cambié de opinión y ahora pongo 1 estrella',
          timestamp: serverTimestamp(),
        },
      })
    );

    // Intento 3 (Negativo): Cliente intenta calificar un pedido que aún está en camino
    await assertFails(
      updateDoc(doc(clientDb, 'orders', orderOngoingId), {
        review: {
          rating: 5,
          comment: 'Aún no llega pero quiero calificar',
          timestamp: serverTimestamp(),
        },
      })
    );

    // Intento 4 (Negativo): Cliente intenta calificar omitiendo timestamp obligatorio
    await assertFails(
      updateDoc(doc(clientDb, 'orders', orderUnratedId), {
        review: {
          rating: 4,
          comment: 'Sin timestamp',
        },
      })
    );
  });
});
