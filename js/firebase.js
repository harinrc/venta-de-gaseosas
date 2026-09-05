import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = { apiKey:"AIzaSyA4IRznoPg7u0wYCv6M-2yFXIMX7G2qcms", authDomain:"ventas-de-gaseosas.firebaseapp.com", projectId:"ventas-de-gaseosas", storageBucket:"ventas-de-gaseosas.firebasestorage.app", messagingSenderId:"1050157736697", appId:"1:1050157736697:web:fad9ea67d8bee2b0373828" };
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);
export { signInWithEmailAndPassword, signOut, onAuthStateChanged };

let currentUser = null;
let unsubscribe = null;
let state = { inventario: [], ventas: [], creditos: {}, totalAbonosHistorico: 0, precioUnitarioGlobal: 50 };
const listeners = new Set();

export function getState() { return state; }
export function subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); }
export function startDataSync(user) {
    currentUser = user;
    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(doc(db, "usuarios", user.uid), snapshot => {
        state = snapshot.exists() ? { ...state, ...snapshot.data() } : { ...state };
        if (!snapshot.exists()) saveData();
        listeners.forEach(listener => listener(state));
    }, error => console.error("Error al leer los datos:", error));
}
export function stopDataSync() { if (unsubscribe) unsubscribe(); unsubscribe = null; currentUser = null; }
export function saveData() { if (!currentUser) return; return setDoc(doc(db, "usuarios", currentUser.uid), state).catch(error => console.error("Error al guardar los datos:", error)); }