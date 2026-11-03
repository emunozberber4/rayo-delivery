/**
 * ============================================================================
 * RAYO DELIVERY — VALIDACIÓN DE REGLAS DE FIRESTORE (FASE 7B)
 * ============================================================================
 * Valida de forma exhaustiva los contratos de seguridad y reglas de acceso
 * declarados en `firestore.rules` para Staging y Emuladores.
 *
 * Módulos auditados:
 * 1. Colección `users`:
 *    - Aislamiento de perfil (Solo propietario o superadmin pueden leer).
 *    - Bloqueo de autoasignación de rol de admin, saldo o claims privilegiados.
 *    - Prohibición de mutación de privilegios en actualización de perfil.
 *    - Inmutabilidad histórica (delete: false).
 * 2. Colección `orders`:
 *    - Revocación estricta de creación directa desde cliente (allow create: if false).
 *    - Aislamiento de lectura: cliente, repartidor asignado, comercio y superadmin.
 *    - Blindaje de campos fiduciarios contra manipulación del cliente o superadmin.
 *    - Cumplimiento de la máquina de estados (recibido -> preparacion -> camino -> entregado).
 *    - Prohibición total de borrado de pedidos (delete: false).
 *    - Subcolección de chat accesible solo por participantes legítimos.
 * 3. Colección `restaurants`:
 *    - Lectura pública del catálogo.
 *    - Creación y eliminación exclusivas de superadmin.
 *    - Modificación restringida a campos operativos sin autoaprobación de estado ni calificación.
 * 4. Custom Claims:
 *    - Desacoplamiento de direcciones de correo electrónico.
 *    - Exigencia estricta de `request.auth.token.get('super_admin', false) == true`.
 * ============================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('FASE 7B: Validación de Reglas de Seguridad de Firestore (firestore.rules)', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  // --- SECCIÓN 1: COLECCIÓN USERS ---
  describe('Colección: users (/users/{userId})', () => {
    it('RULE-U01: Lectura individual restringida al propietario o superadmin', () => {
      assert.match(
        rules,
        /match \/users\/\{userId\}[\s\S]*?allow get: if \(isOwner\(userId\) \|\| isSuperAdmin\(\)\) && isValidId\(userId\);/,
        'Solo el propietario del documento o un superadmin verificado puede consultar el perfil'
      );
    });

    it('RULE-U02: Listado de usuarios restringido exclusivamente a superadmin', () => {
      assert.match(
        rules,
        /match \/users\/\{userId\}[\s\S]*?allow list: if isSuperAdmin\(\);/,
        'El listado de usuarios no debe ser accesible por clientes ni repartidores'
      );
    });

    it('RULE-U03: Creación de usuario bloquea autoasignación de privilegios, roles o saldo', () => {
      assert.match(
        rules,
        /incoming\(\)\.role == 'client'/,
        'El rol inicial en creación debe ser estrictamente client'
      );
      assert.match(
        rules,
        /incoming\(\)\.get\('isSuperAdmin', false\) == false/,
        'Un usuario no puede autodeclararse isSuperAdmin: true en creación'
      );
      assert.match(
        rules,
        /incoming\(\)\.get\('isVerifiedRider', false\) == false/,
        'Un usuario no puede autodeclararse isVerifiedRider: true en creación'
      );
      assert.match(
        rules,
        /incoming\(\)\.get\('balance', 0\) == 0/,
        'El saldo inicial en creación debe ser estrictamente 0'
      );
    });

    it('RULE-U04: Actualización por el cliente bloquea alteración de rol, saldo y claims', () => {
      assert.match(
        rules,
        /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(\[\s*'name',\s*'address',\s*'phone',\s*'whatsapp',\s*'lat',\s*'lng',\s*'theme',\s*'favorites',\s*'favoriteRestaurants',\s*'isLoggedIn',\s*'autoAccept',\s*'vehicleInfo',\s*'photoURL',\s*'lastLocationUpdate',\s*'updatedAt'\s*\]\)/,
        'La actualización por el propio cliente solo permite campos operativos personales'
      );
    });

    it('RULE-U05: Prohibición estricta de borrado de perfiles de usuario', () => {
      assert.match(
        rules,
        /match \/users\/\{userId\}[\s\S]*?allow delete: if false;/,
        'Los perfiles de usuario no pueden eliminarse para preservar la trazabilidad fiduciaria'
      );
    });
  });

  // --- SECCIÓN 2: COLECCIÓN ORDERS ---
  describe('Colección: orders (/orders/{orderId})', () => {
    it('RULE-O01: Creación directa desde cliente totalmente REVOCADA (allow create: if false)', () => {
      assert.match(
        rules,
        /match \/orders\/\{orderId\}[\s\S]*?allow create: if false;/,
        'La creación directa de pedidos desde el cliente en Firestore está terminantemente prohibida'
      );
    });

    it('RULE-O02: Aislamiento estricto de lectura mediante canReadOrder', () => {
      assert.match(
        rules,
        /orderData\.userId == request\.auth\.uid/,
        'El cliente solo puede leer sus pedidos propios'
      );
      assert.match(
        rules,
        /isRider\(\) && \(orderData\.riderId == request\.auth\.uid \|\| orderData\.riderId == 'SYSTEM' \|\| orderData\.riderId == null\)/,
        'El repartidor solo puede leer pedidos asignados a él o libres en el sistema'
      );
      assert.match(
        rules,
        /isRestaurantAdmin\(\) && orderData\.restaurantId == getUserData\(\)\.restaurantId/,
        'El comercio solo puede leer pedidos dirigidos a su propio restaurante'
      );
      assert.match(
        rules,
        /isSuperAdmin\(\)/,
        'El superadmin posee visibilidad supervisada sobre todos los pedidos'
      );
    });

    it('RULE-O03: Repartidor solo puede tomar pedidos libres y pasar a preparacion', () => {
      assert.match(
        rules,
        /isRider\(\) && \(existing\(\)\.get\('riderId', null\) == null \|\| existing\(\)\.get\('riderId', null\) == 'SYSTEM'\)/,
        'Solo repartidores verificados pueden tomar pedidos sin asignación'
      );
      assert.match(
        rules,
        /incoming\(\)\.riderId == request\.auth\.uid/,
        'El repartidor solo puede autoasignarse su propio UID'
      );
    });

    it('RULE-O04: Transición paso a paso de estados (camino y entregado con métricas inmutables)', () => {
      assert.match(
        rules,
        /\(existing\(\)\.status == 'preparacion' \|\| existing\(\)\.status == 'recibido'\) && incoming\(\)\.status == 'camino'/,
        'Transición de recolección a camino permitida únicamente para repartidor asignado'
      );
      assert.match(
        rules,
        /existing\(\)\.status == 'camino' && incoming\(\)\.status == 'entregado'/,
        'Transición de entrega permitida únicamente para repartidor asignado'
      );
      assert.match(
        rules,
        /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(\['status', 'deliveredAt', 'totalTimeMinutes'\]\)/,
        'En la entrega únicamente pueden registrarse estado, timestamp y tiempo total'
      );
    });

    it('RULE-O05: Cliente solo puede cancelar pedidos en estado recibido y calificar pedidos entregados', () => {
      assert.match(
        rules,
        /existing\(\)\.userId == request\.auth\.uid && existing\(\)\.status == 'recibido' && incoming\(\)\.status == 'cancelado'/,
        'El cliente solo puede cancelar si el restaurante no ha iniciado preparación'
      );
      assert.match(
        rules,
        /existing\(\)\.userId == request\.auth\.uid && existing\(\)\.status == 'entregado'[\s\S]*?!?\('review' in existing\(\)\)/,
        'La calificación solo es posible una vez y tras la entrega completa'
      );
    });

    it('RULE-O06: Superadmin tiene blindados los campos fiduciarios contra edición arbitraria', () => {
      assert.match(
        rules,
        /!incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasAny\(\['userId', 'items', 'subtotal', 'deliveryFee', 'total', 'paymentMethod', 'shortId', 'longId', 'idempotencyKey', 'timestamp'\]\)/,
        'Ni siquiera el superadmin puede mutar totales, productos o IDs fiduciarios de una orden ya emitida'
      );
    });

    it('RULE-O07: Borrado de pedidos totalmente PROHIBIDO (allow delete: if false)', () => {
      assert.match(
        rules,
        /match \/orders\/\{orderId\}[\s\S]*?allow delete: if false;/,
        'Los pedidos nunca pueden borrarse para garantizar auditoría fiscal y fiduciaria'
      );
    });

    it('RULE-O08: Mensajes de chat del pedido blindados por canReadOrder y schema cerrado', () => {
      assert.match(
        rules,
        /canReadOrder\(get\(\/databases\/\$\(database\)\/documents\/orders\/\$\(orderId\)\)\.data\)/,
        'Solo los involucrados directos de la orden pueden participar en el chat'
      );
      assert.match(
        rules,
        /data\.keys\(\)\.hasOnly\(\['senderId', 'text', 'timestamp', 'senderName'\]\)/,
        'Los mensajes del chat deben cumplir estrictamente el esquema sin campos adicionales'
      );
      assert.match(
        rules,
        /isValidMessage\(incoming\(\)\)/,
        'La creación del mensaje debe estar validada por isValidMessage'
      );
    });
  });

  // --- SECCIÓN 3: COLECCIÓN RESTAURANTS ---
  describe('Colección: restaurants (/restaurants/{restaurantId})', () => {
    it('RULE-R01: Lectura de restaurantes y menús es pública', () => {
      assert.match(
        rules,
        /match \/restaurants\/\{restaurantId\}[\s\S]*?allow read: if true;/,
        'Cualquier usuario puede ver los restaurantes para seleccionar pedidos'
      );
      assert.match(
        rules,
        /match \/menu\/\{productId\}[\s\S]*?allow read: if true;/,
        'Cualquier usuario puede ver los menús autorizados'
      );
    });

    it('RULE-R02: Propietario no puede autoaprobarse ni cambiar dueño', () => {
      assert.match(
        rules,
        /!incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasAny\(\['ownerId', 'isApproved', 'isAdminCreated', 'rating', 'totalReviews'\]\)/,
        'El comercio afiliado no puede autoaprobarse ni adulterar su calificación'
      );
    });

    it('RULE-R03: Eliminación de restaurantes exclusiva de superadmin', () => {
      assert.match(
        rules,
        /match \/restaurants\/\{restaurantId\}[\s\S]*?allow delete: if isSuperAdmin\(\) && isValidId\(restaurantId\);/,
        'Solo superadmin puede dar de baja definitiva a un comercio'
      );
    });
  });

  // --- SECCIÓN 4: CUSTOM CLAIMS Y SUPERADMIN ---
  describe('Autorización de Privilegios: Custom Claims', () => {
    it('RULE-C01: isSuperAdmin depende criptográficamente de token.super_admin == true', () => {
      assert.match(
        rules,
        /request\.auth\.token\.get\('super_admin', false\) == true/,
        'La regla debe exigir la propiedad super_admin dentro del token JWT emitido por Firebase Auth'
      );
    });

    it('RULE-C02: Ninguna dirección de correo electrónico está quemada en las reglas', () => {
      assert.doesNotMatch(rules, /@gmail\.com/, 'No deben existir correos de Gmail hardcodeados en firestore.rules');
      assert.doesNotMatch(rules, /@rayo\.com/, 'No deben existir correos de dominio hardcodeados en firestore.rules');
    });
  });
});
