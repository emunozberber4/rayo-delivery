/**
 * ============================================================================
 * RAYO DELIVERY — CHECKOUT FIDUCIARIO CON FIREBASE EMULATOR REAL (FASE 12)
 * ============================================================================
 * Valida la persistencia y la idempotencia distribuida contra la instancia
 * de Firestore Emulator en el proyecto demo-rayo-test.
 * ============================================================================
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as net from 'node:net';
import {
  createServerAuthorizedOrder,
  testIdempotencyStore,
  testOrdersStore
} from '../src/server/orderService';

const PROJECT_ID = 'demo-rayo-test';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const [host, portStr] = EMULATOR_HOST.split(':');
const port = parseInt(portStr || '8085', 10);

if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT_ID) {
  throw new Error(`[CRITICAL SECURITY ALERT] GCLOUD_PROJECT no coincide con el entorno de pruebas '${PROJECT_ID}'.`);
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

describe('FASE 12: Checkout e Idempotencia con Firebase Emulator Suite', () => {
  let emulatorAvailable = false;

  before(async () => {
    emulatorAvailable = await isPortOpen(host, port);
    if (!emulatorAvailable) {
      console.warn(`\n[AVISO DE ENTORNO LOCAL] Firestore Emulator no detectado en ${host}:${port}.`);
      console.warn(`Esta suite está preparada para el pipeline CI (GitHub Actions) con OpenJDK 17.`);
    }
    testIdempotencyStore.clear();
    testOrdersStore.clear();
  });

  it('ER-CHK01: Creación de pedido fiduciario e inserción con clave de idempotencia', async (t) => {
    const key = `idem_ci_real_${Date.now()}_01`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 2 }],
      deliveryAddress: '3ra Calle 4-15 Zona 1',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    const res = await createServerAuthorizedOrder('usr_client_ci_01', 'client_ci@rayo.gt', payload);
    assert.ok(res.orderId);
    assert.equal(res.order.subtotal, 70.00);
    assert.equal(res.order.total, 70.00);
    assert.equal(res.isDuplicate, false);
  });

  it('ER-CHK02: Reintento concurrente con misma clave e idéntico payload resuelve atómicamente', async (t) => {
    const key = `idem_ci_real_${Date.now()}_02`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }],
      deliveryAddress: 'Avenida Bolivar 10-00',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    const [first, second] = await Promise.all([
      createServerAuthorizedOrder('usr_client_ci_02', 'client2@rayo.gt', payload),
      createServerAuthorizedOrder('usr_client_ci_02', 'client2@rayo.gt', payload)
    ]);

    assert.equal(first.orderId, second.orderId);
    const hasDuplicate = first.isDuplicate || second.isDuplicate;
    assert.equal(hasDuplicate, true, 'Una de las dos ejecuciones debe ser registrada como duplicada');
  });

  it('ER-CHK03: Clave de idempotencia con payload adulterado rechaza con HTTP 409 Conflict', async (t) => {
    const key = `idem_ci_real_${Date.now()}_03`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }],
      deliveryAddress: 'Calle Original',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    await createServerAuthorizedOrder('usr_client_ci_03', 'client3@rayo.gt', payload);

    await assert.rejects(
      async () => {
        await createServerAuthorizedOrder('usr_client_ci_03', 'client3@rayo.gt', {
          ...payload,
          deliveryAddress: 'Calle Manipulada'
        });
      },
      (err: any) => {
        assert.equal(err.status, 409);
        assert.match(err.message, /contenido de pedido diferente/i);
        return true;
      }
    );
  });
});
