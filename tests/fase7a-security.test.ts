/**
 * ============================================================================
 * RAYO DELIVERY — SUITE DE PRUEBAS LOCALES DE SEGURIDAD PRE-STAGING (FASE 7A)
 * ============================================================================
 * Pruebas locales y de contrato para validar:
 * 1. Rechazo de usuarios no autenticados (401).
 * 2. Lectura y aislamiento de pedidos por propietario.
 * 3. Denegación estricta de creación directa de pedidos desde el cliente.
 * 4. Protección de roles y Custom Claims (eliminación de correos en reglas).
 * 5. Restricciones de actualización por cliente, repartidor y administrador.
 * 6. Idempotencia atómica con solicitudes secuenciales y concurrentes.
 * 7. Reutilización de clave con diferente payload -> HTTP 409 Conflict.
 * 8. Reutilización de clave por otro usuario -> HTTP 409 Conflict.
 * 9. Reintentos seguros tras pérdida de respuesta.
 * 10. Aislamiento e independencia entre las 3 aplicaciones web.
 * ============================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { 
  verifyAuthToken, 
  createServerAuthorizedOrder, 
  isAuthorizedSuperAdmin,
  computeCanonicalPayloadHash,
  validateIdempotencyKeyFormat,
  testIdempotencyStore,
  testOrdersStore
} from '../src/server/orderService';

describe('FASE 7A: Hardening de Seguridad Pre-Staging y Firebase Emulator Prep', () => {

  // --- REQUISITO 1: RECHAZO DE NO AUTENTICADOS ---
  it('TEST-01: Rechazo estricto de usuarios no autenticados o con tokens maliciosos', async () => {
    const noHeader = await verifyAuthToken(undefined);
    assert.equal(noHeader, null, 'Petición sin cabecera Authorization debe retornar null (401)');

    const badFormat = await verifyAuthToken('Basic user:pass');
    assert.equal(badFormat, null, 'Petición con esquema no-Bearer debe retornar null (401)');

    const emptyToken = await verifyAuthToken('Bearer ');
    assert.equal(emptyToken, null, 'Petición con token vacío debe retornar null (401)');

    const invalidToken = await verifyAuthToken('Bearer malformed.jwt.token');
    assert.equal(invalidToken, null, 'Petición con token no verificable debe retornar null (401)');
  });

  // --- REQUISITO 2: AISLAMIENTO DE PEDIDOS POR PROPIETARIO ---
  it('TEST-02: Garantizar que la consulta de pedidos en reglas aísla por propietario', () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    // Debe verificar que canReadOrder valida que el usuario sea el dueño de la orden
    assert.match(rules, /orderData\.userId == request\.auth\.uid/, 'La regla debe restringir lectura al propietario de la orden');
    assert.match(rules, /canReadOrder\(resource\.data\)/, 'El método get debe utilizar canReadOrder');
  });

  // --- REQUISITO 3: DENEGACIÓN DE CREACIÓN DIRECTA DESDE CLIENTE ---
  it('TEST-03: Denegación incondicional de creación directa de pedidos desde el cliente', () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    // La regla en orders/{orderId} debe ser estrictamente allow create: if false;
    assert.match(rules, /match \/orders\/\{orderId\}[\s\S]*?allow create: if false;/, 'Creación directa en /orders debe estar totalmente denegada');
  });

  // --- REQUISITO 4: PROTECCIÓN DE ROLES Y CUSTOM CLAIMS ---
  it('TEST-04: Sustitución de correos por Custom Claims criptográficos en firestore.rules y backend', async () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    // No deben existir correos hardcodeados en isSuperAdmin()
    assert.doesNotMatch(rules, /request\.auth\.token\.email == 'emunozberber@gmail\.com'/, 'No debe haber correos hardcodeados en las reglas');
    assert.doesNotMatch(rules, /request\.auth\.token\.email == 'emunozberber4@gmail\.com'/, 'No debe haber correos secundarios en las reglas');

    // Debe verificar el claim criptográfico super_admin
    assert.match(rules, /request\.auth\.token\.get\('super_admin', false\) == true/, 'isSuperAdmin debe verificar el Custom Claim super_admin');

    // Prueba en backend con token simulado con y sin claims
    const standardUser = await verifyAuthToken('Bearer mock_test_token_test_client_01');
    assert.equal(isAuthorizedSuperAdmin(standardUser), false, 'Usuario estándar no debe tener privilegios de superadmin');

    const superAdminUser = await verifyAuthToken('Bearer mock_test_token_test_superadmin_01');
    assert.equal(isAuthorizedSuperAdmin(superAdminUser), true, 'Usuario con token de superadmin debe ser reconocido por el backend');
  });

  // --- REQUISITO 5: RESTRICCIONES DE ACTUALIZACIÓN POR ROL ---
  it('TEST-05: Reglas de actualización blindan campos fiduciarios contra mutación administrativa o de terceros', () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    // Superadmin no puede alterar campos fiduciarios
    assert.match(rules, /hasAny\(\['userId', 'items', 'subtotal', 'deliveryFee', 'total', 'paymentMethod', 'shortId', 'longId', 'idempotencyKey', 'timestamp'\]\)/, 'Superadmin no debe poder mutar campos fiduciarios');

    // Reseñas no pueden duplicarse
    assert.match(rules, /!\('review' in existing\(\)\)/, 'La reseña solo puede enviarse una única vez');

    // Chat subcollection exige canReadOrder
    assert.match(rules, /canReadOrder\(get\(.*?\)\.data\) && isValidMessage\(incoming\(\)\)/, 'Chat de órdenes debe verificar membresía en el pedido');
  });

  // --- REQUISITO 6: IDEMPOTENCIA SECUENCIAL Y CONCURRENTE (B-01) ---
  it('TEST-06: Idempotencia atómica para peticiones secuenciales y concurrentes simultáneas', async () => {
    const key = `idem_concurrent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }],
      deliveryAddress: '6ta Calle 4-10 Zona 1',
      deliveryPhone: '50241070444',
      idempotencyKey: key
    };

    // Peticiones concurrentes simultáneas
    const [res1, res2] = await Promise.all([
      createServerAuthorizedOrder('usr_concurrent_01', 'concurrent@test.local', payload),
      createServerAuthorizedOrder('usr_concurrent_01', 'concurrent@test.local', payload)
    ]);

    assert.equal(res1.orderId, res2.orderId, 'Ambas peticiones deben devolver exactamente el mismo orderId');
    assert.equal(res1.order.total, 35.00, 'El precio total debe coincidir');
    assert.ok(res1.isDuplicate || res2.isDuplicate, 'Al menos una de las llamadas concurrentes debe ser marcada como duplicada');
  });

  // --- REQUISITO 7: REUTILIZACIÓN DE CLAVE CON DIFERENTE PAYLOAD (409 CONFLICT) ---
  it('TEST-07: Rechazar con HTTP 409 la reutilización de una misma clave con diferente contenido', async () => {
    const key = `idem_conflict_payload_${Date.now()}`;
    const payloadOriginal = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }], // Q35
      deliveryAddress: 'Dirección A',
      deliveryPhone: '50211111111',
      idempotencyKey: key
    };

    const payloadAltered = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb2', name: 'Doble Rayo Bacon', quantity: 1 }], // Q48 diferente
      deliveryAddress: 'Dirección B',
      deliveryPhone: '50222222222',
      idempotencyKey: key
    };

    // Crear la primera
    const first = await createServerAuthorizedOrder('usr_same_01', 'user@test.local', payloadOriginal);
    assert.ok(first.orderId);

    // Intentar reutilizar la clave con contenido distinto
    await assert.rejects(
      async () => {
        await createServerAuthorizedOrder('usr_same_01', 'user@test.local', payloadAltered);
      },
      (err: any) => {
        assert.equal(err.status, 409, 'Debe devolver código HTTP 409 Conflict');
        assert.match(err.message, /contenido de pedido diferente/i);
        return true;
      }
    );
  });

  // --- REQUISITO 8: REUTILIZACIÓN DE CLAVE POR OTRO USUARIO (409 CONFLICT) ---
  it('TEST-08: Rechazar con HTTP 409 el intento de reutilizar la clave de idempotencia por otro usuario', async () => {
    const key = `idem_conflict_user_${Date.now()}`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', name: 'Rayo Clásica Burguer', quantity: 1 }],
      deliveryAddress: 'Dirección Test',
      deliveryPhone: '50233333333',
      idempotencyKey: key
    };

    // Usuario A crea el pedido
    const userAOrder = await createServerAuthorizedOrder('usr_alice_01', 'alice@test.local', payload);
    assert.ok(userAOrder.orderId);

    // Usuario B intenta enviar una solicitud con la misma clave de Alice
    await assert.rejects(
      async () => {
        await createServerAuthorizedOrder('usr_bob_02', 'bob@test.local', payload);
      },
      (err: any) => {
        assert.equal(err.status, 409, 'Debe devolver código HTTP 409 Conflict');
        assert.match(err.message, /ya fue utilizada por otro usuario/i);
        return true;
      }
    );
  });

  // --- REQUISITO 9: REINTENTOS TRAS PÉRDIDA DE RESPUESTA ---
  it('TEST-09: Reintento tras respuesta perdida devuelve el mismo pedido completado sin duplicar en la base de datos', async () => {
    const key = `idem_retry_${Date.now()}`;
    const payload = {
      restaurantId: 'r_rayo_burguer',
      items: [{ productId: 'rb1', quantity: 2 }],
      deliveryAddress: 'Avenida Las Palmeras',
      deliveryPhone: '50244444444',
      idempotencyKey: key
    };

    const initialOrder = await createServerAuthorizedOrder('usr_retry_client', 'retry@test.local', payload);
    
    // Simular pérdida de red del cliente y reintento idéntico
    const retryOrder = await createServerAuthorizedOrder('usr_retry_client', 'retry@test.local', payload);

    assert.equal(retryOrder.orderId, initialOrder.orderId);
    assert.equal(retryOrder.isDuplicate, true);
    assert.equal(retryOrder.order.total, initialOrder.order.total);
    assert.equal(retryOrder.order.deliveryCode, initialOrder.order.deliveryCode);
  });

  // --- REQUISITO 10: AISLAMIENTO ENTRE LAS TRES APLICACIONES ---
  it('TEST-10: Verificar que existen tres puntos de entrada independientes y compilables', () => {
    const rootDir = process.cwd();
    
    // HTML entrypoints
    assert.ok(fs.existsSync(path.join(rootDir, 'clientes.html')), 'Debe existir clientes.html');
    assert.ok(fs.existsSync(path.join(rootDir, 'repartidores.html')), 'Debe existir repartidores.html');
    assert.ok(fs.existsSync(path.join(rootDir, 'admin.html')), 'Debe existir admin.html');

    // TypeScript entrypoints por aplicación desacoplada
    assert.ok(fs.existsSync(path.join(rootDir, 'src', 'apps', 'client', 'main.tsx')), 'Debe existir src/apps/client/main.tsx');
    assert.ok(fs.existsSync(path.join(rootDir, 'src', 'apps', 'rider', 'main.tsx')), 'Debe existir src/apps/rider/main.tsx');
    assert.ok(fs.existsSync(path.join(rootDir, 'src', 'apps', 'admin', 'main.tsx')), 'Debe existir src/apps/admin/main.tsx');

    // Verificar que clientes.html no contiene código de admin
    const clientesHtml = fs.readFileSync(path.join(rootDir, 'clientes.html'), 'utf8');
    assert.match(clientesHtml, /\/src\/apps\/client\/main\.tsx/);
    assert.doesNotMatch(clientesHtml, /\/src\/apps\/admin\/main\.tsx/);

    const adminHtml = fs.readFileSync(path.join(rootDir, 'admin.html'), 'utf8');
    assert.match(adminHtml, /\/src\/apps\/admin\/main\.tsx/);
    assert.doesNotMatch(adminHtml, /\/src\/apps\/client\/main\.tsx/);

    const repartidoresHtml = fs.readFileSync(path.join(rootDir, 'repartidores.html'), 'utf8');
    assert.match(repartidoresHtml, /\/src\/apps\/rider\/main\.tsx/);
    assert.doesNotMatch(repartidoresHtml, /\/src\/apps\/admin\/main\.tsx/);
  });

});
