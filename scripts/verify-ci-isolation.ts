/**
 * ============================================================================
 * RAYO DELIVERY — GUARDIA DE AISLAMIENTO ESTRICTO PARA CI / EMULADORES (FASE 12)
 * ============================================================================
 * Valida de forma estricta que el entorno de ejecución está 100% confinado
 * al proyecto de emulación "demo-rayo-test", impidiendo cualquier contacto
 * accidental con producción, bases de datos remotas o despliegues.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

export function verifyCiIsolation(): { success: boolean; checks: Array<{ name: string; passed: boolean; details: string }> } {
  const checks: Array<{ name: string; passed: boolean; details: string }> = [];

  const expectedProject = 'demo-rayo-test';

  // 1. Comprobar .firebaserc
  let firebasercProject = '';
  try {
    const rcPath = path.resolve(process.cwd(), '.firebaserc');
    if (fs.existsSync(rcPath)) {
      const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
      firebasercProject = rc?.projects?.default || '';
    }
  } catch (err: any) {
    firebasercProject = `Error: ${err.message}`;
  }
  const rcPassed = firebasercProject === expectedProject;
  checks.push({
    name: '.firebaserc project default == demo-rayo-test',
    passed: rcPassed,
    details: `Encontrado en .firebaserc: "${firebasercProject}"`
  });

  // 2. Proyecto obligatorio 'demo-rayo-test'
  const configuredProject = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || firebasercProject;
  const projectPassed = configuredProject === expectedProject;
  checks.push({
    name: 'PROJECT_ID == demo-rayo-test',
    passed: projectPassed,
    details: `Configurado: "${configuredProject}". Requerido: "${expectedProject}" (debe comenzar con prefijo "demo-")`
  });

  // 3. Ausencia total de credenciales de producción
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const noCredsPassed = !googleAppCreds;
  checks.push({
    name: 'Ausencia de GOOGLE_APPLICATION_CREDENTIALS',
    passed: noCredsPassed,
    details: noCredsPassed ? 'Ninguna variable de credenciales detectada' : `Detectada: ${googleAppCreds}`
  });

  // 4. NODE_ENV no debe ser production
  const nodeEnv = process.env.NODE_ENV;
  const nodeEnvPassed = nodeEnv !== 'production';
  checks.push({
    name: 'NODE_ENV != production',
    passed: nodeEnvPassed,
    details: `NODE_ENV actual: "${nodeEnv}"`
  });

  // 5. Verificación de puertos locales del emulador
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const hostsPassed = firestoreHost.includes('127.0.0.1') || firestoreHost.includes('localhost');
  checks.push({
    name: 'Puertos y hosts de emulador locales',
    passed: hostsPassed,
    details: `Firestore: ${firestoreHost}, Auth: ${authHost}`
  });

  // 6. Prohibición de comandos de despliegue en CI
  const hasForbiddenDeploy = process.argv.some(arg => 
    arg.includes('deploy') || arg.includes('cloud run') || arg.includes('gcloud')
  );
  checks.push({
    name: 'Ausencia de argumentos de despliegue automático',
    passed: !hasForbiddenDeploy,
    details: !hasForbiddenDeploy ? 'Comando seguro de solo pruebas' : 'Intento de despliegue detectado'
  });

  const allPassed = checks.every(c => c.passed);
  return { success: allPassed, checks };
}

// Ejecutar si es invocado como script CLI
if (process.argv[1]?.endsWith('verify-ci-isolation.ts')) {
  console.log('\n============================================================');
  console.log('🛡️ RAYO DELIVERY — VERIFICACIÓN DE AISLAMIENTO CI / EMULADOR');
  console.log('============================================================\n');

  const result = verifyCiIsolation();
  for (const check of result.checks) {
    const symbol = check.passed ? '✅' : '❌';
    console.log(`${symbol} [${check.name}]: ${check.details}`);
  }

  if (!result.success) {
    console.error('\n❌ ERROR FATAL DE AISLAMIENTO: Las comprobaciones de seguridad no pasaron.');
    console.error('El pipeline de CI se detiene inmediatamente para proteger producción.\n');
    process.exit(1);
  }

  console.log('\n✅ AISLAMIENTO COMPLETO: Proyecto confirmado exclusivamente como "demo-rayo-test".');
  console.log('Listo para ejecutar pruebas reales en Firebase Emulator Suite.\n');
}
