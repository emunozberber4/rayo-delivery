import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('[Firebase Admin] No se pudo leer firebase-applet-config.json:', e);
}

const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || 'ai-studio-applet-webapp-4a8db';
const databaseId = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || 'ai-studio-copiarayodeliver-2cf2ba21-a2ef-48f8-8dbb-8ad34839c850';

let adminApp: App;
const existingApps = getApps();
if (existingApps.length === 0) {
  try {
    adminApp = initializeApp({
      projectId,
    });
  } catch (e) {
    console.warn('[Firebase Admin] Error inicializando app:', e);
    adminApp = initializeApp();
  }
} else {
  adminApp = existingApps[0]!;
}

export const adminAuth = getAuth(adminApp);
export const adminDb = databaseId ? getFirestore(adminApp, databaseId) : getFirestore(adminApp);
export { FieldValue, projectId, databaseId };
