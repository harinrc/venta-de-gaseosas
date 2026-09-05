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
let isHydrated = false;
let isSaving = false;
let pendingSave = false;

export function getState() { return state; }
export function isReady() { return isHydrated; }
export function subscribe(listener) { listeners.add(listener); if (isHydrated) listener(state); return () => listeners.delete(listener); }
export function startDataSync(user) {
    currentUser = user;
    isHydrated = false;
    state = { inventario: [], ventas: [], creditos: {}, totalAbonosHistorico: 0, precioUnitarioGlobal: 50 };
    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(doc(db, "usuarios", user.uid), snapshot => {
        state = snapshot.exists() ? normalizeState(snapshot.data()) : { ...state };
        isHydrated = true;
        localStorage.setItem(`gestor-ventas:${user.uid}`, JSON.stringify(state));
        if (!snapshot.exists()) saveData();
        listeners.forEach(listener => listener(state));
    }, error => {
        console.error("Error al leer los datos:", error);
        const backup = localStorage.getItem(`gestor-ventas:${user.uid}`);
        if (backup) { state = normalizeState(JSON.parse(backup)); listeners.forEach(listener => listener(state)); }
    });
}
export function stopDataSync() { if (unsubscribe) unsubscribe(); unsubscribe = null; currentUser = null; isHydrated = false; }
export function saveData() {
    if (!currentUser || !isHydrated) return Promise.reject(new Error("Los datos todavía no han terminado de cargar."));
    localStorage.setItem(`gestor-ventas:${currentUser.uid}`, JSON.stringify(state));
    if (isSaving) { pendingSave = true; return Promise.resolve(); }
    isSaving = true;
    return setDoc(doc(db, "usuarios", currentUser.uid), state).catch(error => console.error("Error al guardar los datos:", error)).finally(() => {
        isSaving = false;
        if (pendingSave) { pendingSave = false; saveData(); }
    });
}
function normalizeState(data) { return { inventario: Array.isArray(data.inventario) ? data.inventario : [], ventas: Array.isArray(data.ventas) ? data.ventas : [], creditos: data.creditos && typeof data.creditos === "object" ? data.creditos : {}, totalAbonosHistorico: Number(data.totalAbonosHistorico || 0), precioUnitarioGlobal: Number(data.precioUnitarioGlobal || 50), inventarioHistorial: Array.isArray(data.inventarioHistorial) ? data.inventarioHistorial : [] }; }