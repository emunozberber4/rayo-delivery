/**
 * ============================================================================
 * RAYO DELIVERY — SCRIPT DE ASIGNACIÓN CONTROLADA DE CUSTOM CLAIMS (SOLO TEST)
 * ============================================================================
 * ATENCIÓN: Este script está estrictamente confinado a entornos locales aislados
 * de prueba (Firebase Emulator Suite / Test Runners).
 * 
 * PROHIBICIÓN ESTRICTA:
 * - NO ejecutar en producción.
 * - NO ejecutar contra bases de datos remotas.
 * - NO asignar claims a cuentas reales.
 * ============================================================================
 */

import { adminAuth } from '../src/server/firebaseAdmin';

async function setSuperAdminClaimForTesting() {
  console.log('\n[Rayo Security] Verificando precondiciones de seguridad...\n');

  // 1. Guardias de seguridad de entorno
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR FATAL DE SEGURIDAD: Intentando ejecutar script administrativo en NODE_ENV=production.');
    console.error('Operación abortada inmediatamente.');
    process.exit(1);
  }

  if (process.env.RAYO_TEST_ENV !== 'true') {
    console.error('❌ ERROR: RAYO_TEST_ENV no está explícitamente configurado en "true".');
    console.error('Este script solo puede ejecutarse en sesiones de prueba controladas con emulador local.');
    process.exit(1);
  }

  // 2. Extracción y validación del UID de prueba
  const targetUid = process.argv[2];
  if (!targetUid) {
    console.error('❌ USO INCORRECTO: Debe especificarse un UID de prueba como argumento.');
    console.error('Ejemplo: npx tsx scripts/set-superadmin-claim.ts test_user_superadmin_01');
    process.exit(1);
  }

  // 3. Validación estricta de prefijo de cuenta de prueba
  if (!targetUid.startsWith('test_') && !targetUid.startsWith('mock_')) {
    console.error(`❌ ERROR: El UID "${targetUid}" no cumple el patrón obligatorio para cuentas de prueba ("test_*" o "mock_*").`);
    console.error('Prohibido asignar Custom Claims a identificadores reales o correos electrónicos.');
    process.exit(1);
  }

  console.log(`🛡️ Entorno verificado: Test/Emulator.`);
  console.log(`👤 Asignando custom claim { super_admin: true } a la cuenta de prueba: ${targetUid}`);

  try {
    await adminAuth.setCustomUserClaims(targetUid, {
      super_admin: true,
      assignedAt: new Date().toISOString(),
      environment: 'isolated_test'
    });

    console.log(`✅ Custom Claim asignado exitosamente a "${targetUid}".`);
    console.log(`ℹ️ La claim entrará en vigor en el siguiente token ID generado para este UID.\n`);
  } catch (err: any) {
    console.error('❌ Error al asignar Custom Claim en Admin Auth:', err?.message || err);
    process.exit(1);
  }
}

// Ejecutar si se invoca directamente
if (process.env.RAYO_TEST_ENV === 'true' && process.env.NODE_ENV !== 'production') {
  setSuperAdminClaimForTesting();
} else {
  console.log('[Rayo Security] Script cargado en modo inactivo. Guardias de entorno activas.');
}
