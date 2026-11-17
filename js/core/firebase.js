'use strict';
// Udostępnia importy Firebase (z inline <script type="module"> w index.html) jako zmienne globalne,
// dokładnie pod tymi samymi nazwami, których używał oryginalny kod.
if (!window.FB) throw new Error('Firebase nie załadowany (brak połączenia z internetem?)');
const {
    initializeApp, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
    getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, addDoc
} = window.FB;

const firebaseConfig = window.FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
