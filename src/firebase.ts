import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import type { User } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";
import { ADMIN_USERNAME, ADMIN_PASSWORD } from './adminConfig';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Set persistence to keep user logged in
setPersistence(auth, browserLocalPersistence);

// Anonymous login function
export function loginAnonymously() {
  return signInAnonymously(auth);
}

// Listen for auth state changes
export function onUserChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Username/password login (treat username as email with fixed domain)
const USER_DOMAIN = '@example.com';

// Login with approval check (now uses UID as document ID)
export async function loginWithUsernamePassword(username: string, password: string) {
  const email = username + USER_DOMAIN;
  // First, sign in to get the UID
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const db = getFirestore();
  const userDoc = doc(db, 'users', cred.user.uid);
  const snap = await getDoc(userDoc);
  if (!snap.exists()) {
    throw new Error('User does not exist.');
  }
  const data = snap.data();
  if (username === ADMIN_USERNAME) {
    if (password !== ADMIN_PASSWORD) throw new Error('Incorrect admin password.');
    if (data.status !== 'approved') throw new Error('Admin account not approved.');
  } else {
    if (data.status !== 'approved') throw new Error('Your registration is pending approval.');
  }
  return cred;
}


// Register and set status to pending in Firestore, auto-approve admin (now uses UID as document ID)
export async function registerWithUsernamePassword(username: string, password: string) {
  const email = username + USER_DOMAIN;
  const db = getFirestore();
  // Check if username is already taken (by scanning all users)
  const usersSnap = await getDocs(collection(db, 'users'));
  if (usersSnap.docs.some(doc => doc.data().username === username)) {
    throw new Error('Username already exists.');
  }
  let status = 'pending';
  if (username === ADMIN_USERNAME) {
    if (password !== ADMIN_PASSWORD) throw new Error('Incorrect admin password.');
    status = 'approved';
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // Wait for authentication to complete before writing to Firestore
  await new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.uid === cred.user.uid) {
        unsubscribe();
        resolve();
      }
    });
  });

  const userDoc = doc(db, 'users', cred.user.uid);
  await setDoc(userDoc, {
    uid: cred.user.uid,
    username,
    status,
    createdAt: new Date().toISOString(),
  });
  return cred;
}

export { auth };
