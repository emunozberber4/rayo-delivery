#!/usr/bin/env bash
# ==============================================================================
# RAYO DELIVERY — PRE-FLIGHT SECURITY GUARD FOR FIREBASE EMULATOR CI/CD PIPELINE
# ==============================================================================
# Este script actúa como guardia de seguridad estricto antes de iniciar cualquier
# emulador o suite de pruebas. Bloquea de forma incondicional cualquier ejecución
# si existe el menor indicio de conexión a producción.
# ==============================================================================

set -euo pipefail

echo "===================================================================="
echo "🛡️  RAYO DELIVERY — CI/CD PRE-FLIGHT ENVIRONMENT SECURITY GUARD"
echo "===================================================================="

# 1. Validación estricta del ID del proyecto
TARGET_PROJECT="${GCLOUD_PROJECT:-${FIREBASE_PROJECT_ID:-}}"
EXPECTED_PROJECT="demo-rayo-test"

if [ -z "$TARGET_PROJECT" ]; then
  echo "❌ ERROR FATAL: Ni GCLOUD_PROJECT ni FIREBASE_PROJECT_ID están configurados."
  echo "El pipeline debe declarar explícitamente el proyecto de prueba '$EXPECTED_PROJECT'."
  exit 1
fi

if [ "$TARGET_PROJECT" != "$EXPECTED_PROJECT" ]; then
  echo "❌ ERROR CRÍTICO DE SEGURIDAD: PROJECT_ID detectado: '$TARGET_PROJECT'."
  echo "El pipeline EXIGE estrictamente '$EXPECTED_PROJECT' (espacio de nombres demo aislado)."
  echo "Cualquier otro ID de proyecto está PROHIBIDO para prevenir impactos en staging o producción."
  exit 1
fi

if [[ ! "$TARGET_PROJECT" =~ ^demo- ]]; then
  echo "❌ ERROR: El proyecto '$TARGET_PROJECT' no utiliza el prefijo obligatorio 'demo-'."
  echo "Los emuladores de Firebase requieren proyectos con prefijo 'demo-' para operar sin conexión a internet."
  exit 1
fi

echo "✅ Proyecto verificado: $TARGET_PROJECT (Aislamiento total demo)"

# 2. Comprobación de .firebaserc
FIREBASE_RC_PROJECT=$(grep '"default"' .firebaserc | tr -d '", ' | cut -d':' -f2 || true)
if [ "$FIREBASE_RC_PROJECT" != "$EXPECTED_PROJECT" ]; then
  echo "❌ ERROR: .firebaserc apunta a '$FIREBASE_RC_PROJECT' en lugar de '$EXPECTED_PROJECT'."
  exit 1
fi
echo "✅ .firebaserc configurado correctamente: default = $FIREBASE_RC_PROJECT"

# 3. Verificación de ausencia de credenciales reales de producción
FORBIDDEN_ENV_VARS=(
  "GOOGLE_APPLICATION_CREDENTIALS"
  "FIREBASE_TOKEN"
  "GCP_SA_KEY"
  "FIREBASE_SERVICE_ACCOUNT"
  "CLOUD_RUN_SERVICE_KEY"
)

for VAR_NAME in "${FORBIDDEN_ENV_VARS[@]}"; do
  if [ -n "${!VAR_NAME:-}" ]; then
    echo "❌ ERROR FATAL DE AISLAMIENTO: Variable de credencial real detectada: '$VAR_NAME'."
    echo "El pipeline no debe contener claves privadas ni credenciales de servicio."
    exit 1
  fi
done
echo "✅ Ausencia de secretos y credenciales de producción verificada."

# 4. Verificación de puertos locales para los emuladores
AUTH_HOST="${FIREBASE_AUTH_EMULATOR_HOST:-}"
FIRESTORE_HOST="${FIRESTORE_EMULATOR_HOST:-}"

if [[ -n "$AUTH_HOST" && ! "$AUTH_HOST" =~ ^(127\.0\.0\.1|localhost): ]]; then
  echo "❌ ERROR: FIREBASE_AUTH_EMULATOR_HOST no apunta a localhost ($AUTH_HOST)."
  exit 1
fi

if [[ -n "$FIRESTORE_HOST" && ! "$FIRESTORE_HOST" =~ ^(127\.0\.0\.1|localhost): ]]; then
  echo "❌ ERROR: FIRESTORE_EMULATOR_HOST no apunta a localhost ($FIRESTORE_HOST)."
  exit 1
fi
echo "✅ Variables de host de emuladores dirigidas a loopback local (127.0.0.1)."

# 5. Auditoría de comandos prohibidos en archivos de workflow
if [ -d ".github/workflows" ]; then
  if grep -rnE "firebase\s+deploy|gcloud\s+run\s+deploy" .github/workflows/; then
    echo "❌ ERROR FATAL: Se detectó un comando de despliegue en .github/workflows/."
    echo "Este pipeline es EXCLUSIVAMENTE para validación con emuladores. Prohibido desplegar."
    exit 1
  fi
  echo "✅ Verificado: No existen comandos de despliegue en .github/workflows/."
fi

echo "===================================================================="
echo "🛡️  TODAS LAS GUARDIAS DE AISLAMIENTO SUPERADAS EXITOSAMENTE"
echo "===================================================================="
exit 0
