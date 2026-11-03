import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signInWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const registerWithEmail = async (email: string, pass: string, name?: string) => {
  const credential = await createUserWithEmailAndPassword(auth, email, pass);
  if (name && credential.user) {
    try {
      await updateProfile(credential.user, { displayName: name });
    } catch (e) {
      console.warn('Could not update profile name', e);
    }
  }
  return credential;
};
export const signOutUser = () => auth.signOut();

// Validation call per guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
