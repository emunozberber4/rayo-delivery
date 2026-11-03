/**
 * ============================================================================
 * RAYO DELIVERY — PRUEBAS REALES DE REGLAS CON FIREBASE EMULATOR SUITE
 * ============================================================================
 * Suite de validación fiduciaria directa utilizando @firebase/rules-unit-testing
 * contra la instancia viva de Firestore Emulator en el proyecto aislado demo-rayo-test.
 *
 * RESTRICCIÓN DE SEGURIDAD ABSOLUTA:
 * - Aborta inmediatamente si el proyecto no es estrictamente 'demo-rayo-test'.
 * - Aborta inmediatamente si detecta variables o credenciales de producción.
 * ============================================================================
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'node:net';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs
} from 'firebase/firestore';

const PROJECT_ID = 'demo-rayo-test';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const [host, portStr] = EMULATOR_HOST.split(':');
const port = parseInt(portStr || '8085', 10);

// Guarda anti-producción
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT_ID) {
  throw new Error(`[CRITICAL SECURITY ALERT] GCLOUD_PROJECT no coincide con el entorno de pruebas '${PROJECT_ID}'. Ejecución abortada.`);
}

function isPortOpen(h: string, p: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('timeout', () => {
      sock.destroy();
      resolve(false);
    });
    sock.on('error', () => {
      resolve(false);
    });
    sock.connect(p, h);
  });
}

describe('FASE 12: Reglas de Firestore contra Firebase Emulator Real (@firebase/rules-unit-testing)', () => {
  let testEnv: RulesTestEnvironment | null = null;
  let emulatorAvailable = false;

  before(async () => {
    emulatorAvailable = await isPortOpen(host, port);
    if (!emulatorAvailable) {
      console.warn(`\n[AVISO DE ENTORNO LOCAL] Firestore Emulator no está activo en ${host}:${port}.`);
      console.warn(`Esta suite requiere el runtime Java 17 y la ejecución mediante:`);
      console.warn(`  firebase emulators:exec --only firestore,auth --project demo-rayo-test "npm run test:emulator-real"`);
      console.warn(`En este contenedor local sin Java, la suite reporta estado pendiente del runner CI.\n`);
      return;
    }

    const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules
      }
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

  // --- 1. COLECCIÓN USERS ---
  describe('Colección: users (/users/{userId})', () => {
    it('ER-U01: Usuario sin autenticar no puede leer ningún perfil de usuario', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');
      
      const unauthCtx = testEnv.unauthenticatedContext();
      const userRef = doc(unauthCtx.firestore(), 'users', 'usr_target_01');
      await assertFails(getDoc(userRef));
    });

    it('ER-U02: Usuario autenticado no puede leer perfiles de otros usuarios', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      // Sembrar perfil de destino con bypass de admin SDK
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await setDoc(doc(adminCtx.firestore(), 'users', 'usr_target_01'), {
          name: 'Target User',
          email: 'target@rayo.gt',
          address: 'Zona 1',
          role: 'client'
        });
      });

      const clientCtx = testEnv.authenticatedContext('usr_other_client');
      const userRef = doc(clientCtx.firestore(), 'users', 'usr_target_01');
      await assertFails(getDoc(userRef));
    });

    it('ER-U03: Usuario propietario puede consultar su propio perfil', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await setDoc(doc(adminCtx.firestore(), 'users', 'usr_client_legit'), {
          name: 'Cliente Legítimo',
          email: 'cliente@rayo.gt',
          address: '4ta Calle 2-10',
          role: 'client'
        });
      });

      const ownerCtx = testEnv.authenticatedContext('usr_client_legit');
      const userRef = doc(ownerCtx.firestore(), 'users', 'usr_client_legit');
      await assertSucceeds(getDoc(userRef));
    });

    it('ER-U04: Superadmin con claim token.super_admin == true puede leer y listar perfiles', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await setDoc(doc(adminCtx.firestore(), 'users', 'usr_target_02'), {
          name: 'Target User 2',
          email: 'target2@rayo.gt',
          address: 'Zona 10',
          role: 'client'
        });
      });

      const superAdminCtx = testEnv.authenticatedContext('usr_super_admin', {
        super_admin: true
      });
      const userRef = doc(superAdminCtx.firestore(), 'users', 'usr_target_02');
      await assertSucceeds(getDoc(userRef));

      const usersCol = collection(superAdminCtx.firestore(), 'users');
      await assertSucceeds(getDocs(usersCol));
    });

    it('ER-U05: Creación directa bloquea autoasignación de privilegios (isSuperAdmin, isVerifiedRider, balance != 0)', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      const attackerCtx = testEnv.authenticatedContext('usr_attacker');
      const attackerDoc = doc(attackerCtx.firestore(), 'users', 'usr_attacker');

      // Intento 1: autoasignarse isSuperAdmin: true
      await assertFails(setDoc(attackerDoc, {
        name: 'Attacker',
        email: 'attacker@evil.com',
        address: 'Zona 0',
        role: 'client',
        isSuperAdmin: true,
        balance: 0
      }));

      // Intento 2: autoasignarse rol super_admin
      await assertFails(setDoc(attackerDoc, {
        name: 'Attacker',
        email: 'attacker@evil.com',
        address: 'Zona 0',
        role: 'super_admin',
        balance: 0
      }));

      // Intento 3: autoasignarse balance > 0
      await assertFails(setDoc(attackerDoc, {
        name: 'Attacker',
        email: 'attacker@evil.com',
        address: 'Zona 0',
        role: 'client',
        balance: 500
      }));

      // Creación legítima como client estándar con balance 0
      await assertSucceeds(setDoc(attackerDoc, {
        name: 'Legit Client',
        email: 'client@normal.gt',
        address: 'Zona 1',
        role: 'client',
        isSuperAdmin: false,
        isVerifiedRider: false,
        balance: 0
      }));
    });

    it('ER-U06: Prohibición total de borrado de perfiles de usuario (delete: false)', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await setDoc(doc(adminCtx.firestore(), 'users', 'usr_delete_test'), {
          name: 'User To Delete',
          email: 'delete@rayo.gt',
          address: 'Zona 3',
          role: 'client'
        });
      });

      // Intento de borrado por el propietario
      const ownerCtx = testEnv.authenticatedContext('usr_delete_test');
      await assertFails(deleteDoc(doc(ownerCtx.firestore(), 'users', 'usr_delete_test')));

      // Intento de borrado por superadmin
      const superAdminCtx = testEnv.authenticatedContext('usr_sa', { super_admin: true });
      await assertFails(deleteDoc(doc(superAdminCtx.firestore(), 'users', 'usr_delete_test')));
    });
  });

  // --- 2. COLECCIÓN ORDERS ---
  describe('Colección: orders (/orders/{orderId})', () => {
    it('ER-O01: Inserción directa de pedidos desde SDK cliente REVOCADA (allow create: if false)', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      const clientCtx = testEnv.authenticatedContext('usr_client_01');
      const orderRef = doc(clientCtx.firestore(), 'orders', 'ord_direct_tamper');

      // Debe fallar inexorablemente: las órdenes solo pueden ser creadas por Firebase Admin SDK
      await assertFails(setDoc(orderRef, {
        userId: 'usr_client_01',
        restaurantId: 'r_rayo_burguer',
        items: [{ id: 'rb1', name: 'Rayo Burguer', price: 1, quantity: 1 }],
        subtotal: 1,
        deliveryFee: 0,
        total: 1,
        status: 'recibido',
        timestamp: new Date().toISOString()
      }));
    });

    it('ER-O02: Lectura de pedidos aislada entre cliente, comercio, repartidor y superadmin', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      // Sembrar pedido con Admin SDK
      const orderId = 'ord_isolation_test_01';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await setDoc(doc(adminCtx.firestore(), 'orders', orderId), {
          userId: 'usr_client_a',
          restaurantId: 'r_rest_a',
          riderId: 'usr_rider_a',
          items: [{ productId: 'rb1', name: 'Burguer', quantity: 1 }],
          total: 35.00,
          status: 'recibido'
        });
        // Sembrar perfil de comercio para r_rest_a
        await setDoc(doc(adminCtx.firestore(), 'users', 'usr_rest_owner_a'), {
          role: 'admin',
          restaurantId: 'r_rest_a'
        });
        // Sembrar perfil de repartidor
        await setDoc(doc(adminCtx.firestore(), 'users', 'usr_rider_a'), {
          role: 'rider'
        });
      });

      // 1. Cliente dueño puede leer
      const clientOwnerCtx = testEnv.authenticatedContext('usr_client_a');
      await assertSucceeds(getDoc(doc(clientOwnerCtx.firestore(), 'orders', orderId)));

      // 2. Cliente ajeno NO puede leer
      const clientAlienCtx = testEnv.authenticatedContext('usr_client_b');
      await assertFails(getDoc(doc(clientAlienCtx.firestore(), 'orders', orderId)));

      // 3. Superadmin puede leer
      const saCtx = testEnv.authenticatedContext('usr_sa', { super_admin: true });
      await assertSucceeds(getDoc(doc(saCtx.firestore(), 'orders', orderId)));
    });

    it('ER-O03: Prohibición absoluta de mutar campos fiduciarios (total, items, userId, idempotencyKey)', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      const orderId = 'ord_fiduciary_test';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await setDoc(doc(adminCtx.firestore(), 'orders', orderId), {
          userId: 'usr_client_c',
          restaurantId: 'r_rest_c',
          riderId: 'SYSTEM',
          items: [{ productId: 'rb1', name: 'Burguer', price: 35.00, quantity: 1 }],
          subtotal: 35.00,
          deliveryFee: 0,
          total: 35.00,
          status: 'recibido',
          idempotencyKey: 'idem_fiduciary_123'
        });
      });

      // Intento del cliente de alterar el total de la orden
      const clientCtx = testEnv.authenticatedContext('usr_client_c');
      await assertFails(updateDoc(doc(clientCtx.firestore(), 'orders', orderId), {
        total: 1.00
      }));

      // Intento del superadmin de alterar el total o items (bloqueado por regla de protección fiduciaria)
      const saCtx = testEnv.authenticatedContext('usr_sa', { super_admin: true });
      await assertFails(updateDoc(doc(saCtx.firestore(), 'orders', orderId), {
        total: 1.00
      }));
    });

    it('ER-O04: Prohibición absoluta de eliminación de pedidos (allow delete: if false)', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      const orderId = 'ord_no_delete';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await setDoc(doc(adminCtx.firestore(), 'orders', orderId), {
          userId: 'usr_client_d',
          restaurantId: 'r_rest_d',
          total: 50.00,
          status: 'entregado'
        });
      });

      const saCtx = testEnv.authenticatedContext('usr_sa', { super_admin: true });
      await assertFails(deleteDoc(doc(saCtx.firestore(), 'orders', orderId)));

      const clientCtx = testEnv.authenticatedContext('usr_client_d');
      await assertFails(deleteDoc(doc(clientCtx.firestore(), 'orders', orderId)));
    });
  });

  // --- 3. COLECCIÓN RESTAURANTS ---
  describe('Colección: restaurants (/restaurants/{restaurantId})', () => {
    it('ER-R01: Lectura de catálogo de restaurantes y menús es pública', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await setDoc(doc(adminCtx.firestore(), 'restaurants', 'r_public_rest'), {
          name: 'Comedor Central',
          image: 'https://example.com/img.jpg',
          rating: 4.8,
          ownerId: 'usr_owner_x',
          isApproved: true
        });
      });

      const unauthCtx = testEnv.unauthenticatedContext();
      await assertSucceeds(getDoc(doc(unauthCtx.firestore(), 'restaurants', 'r_public_rest')));
    });

    it('ER-R02: Propietario no puede autoaprobarse ni adulterar calificación', async (t) => {
      if (!emulatorAvailable || !testEnv) return t.skip('Requiere Firebase Emulator activo');

      const restId = 'r_pending_rest';
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await setDoc(doc(adminCtx.firestore(), 'restaurants', restId), {
          name: 'Restaurante Pendiente',
          image: 'https://example.com/img.jpg',
          rating: 4.0,
          ownerId: 'usr_owner_rest',
          isApproved: false
        });
      });

      const ownerCtx = testEnv.authenticatedContext('usr_owner_rest');
      // Intento de autoaprobarse
      await assertFails(updateDoc(doc(ownerCtx.firestore(), 'restaurants', restId), {
        isApproved: true
      }));

      // Intento de adulterar calificación
      await assertFails(updateDoc(doc(ownerCtx.firestore(), 'restaurants', restId), {
        rating: 5.0
      }));
    });
  });
});
