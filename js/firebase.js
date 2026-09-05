import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
let session = null;

export function getState() { return state; }
export function getSession() { return session; }
export function isReady() { return isHydrated; }
export function subscribe(listener) { listeners.add(listener); if (isHydrated) listener(state); return () => listeners.delete(listener); }
export async function startDataSync(user) {
    currentUser = user;
    isHydrated = false;
    const profileRef = doc(db, "perfiles", user.uid);
    const profileSnapshot = await getDoc(profileRef);
    const profile = profileSnapshot.exists() ? profileSnapshot.data() : { nombre: user.email?.split("@")[0] || "Usuario", rol: "propietario", negocioId: `personal:${user.uid}` };
    if (!profileSnapshot.exists()) await setDoc(profileRef, { ...profile, uid: user.uid, correo: user.email, creadoEn: new Date().toISOString() });
    session = { uid: user.uid, email: user.email, name: profile.nombre || user.email, role: profile.rol || "vendedor", businessId: profile.negocioId || `personal:${user.uid}` };
    state = { inventario: [], ventas: [], creditos: {}, totalAbonosHistorico: 0, precioUnitarioGlobal: 50 };
    if (unsubscribe) unsubscribe();
    const dataRef = session.businessId.startsWith("personal:") ? doc(db, "usuarios", user.uid) : doc(db, "negocios", session.businessId);
    unsubscribe = onSnapshot(dataRef, snapshot => {
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
export function stopDataSync() { if (unsubscribe) unsubscribe(); unsubscribe = null; currentUser = null; session = null; isHydrated = false; }
export function saveData() {
    if (!currentUser || !isHydrated) return Promise.reject(new Error("Los datos todavía no han terminado de cargar."));
    localStorage.setItem(`gestor-ventas:${currentUser.uid}`, JSON.stringify(state));
    if (isSaving) { pendingSave = true; return Promise.resolve(); }
    isSaving = true;
    const dataRef = session?.businessId?.startsWith("personal:") ? doc(db, "usuarios", currentUser.uid) : doc(db, "negocios", session.businessId);
    return setDoc(dataRef, state).catch(error => console.error("Error al guardar los datos:", error)).finally(() => {
        isSaving = false;
        if (pendingSave) { pendingSave = false; saveData(); }
    });
}
function normalizeState(data) { return { inventario: Array.isArray(data.inventario) ? data.inventario : [], ventas: Array.isArray(data.ventas) ? data.ventas : [], creditos: data.creditos && typeof data.creditos === "object" ? data.creditos : {}, totalAbonosHistorico: Number(data.totalAbonosHistorico || 0), precioUnitarioGlobal: Number(data.precioUnitarioGlobal || 50), inventarioHistorial: Array.isArray(data.inventarioHistorial) ? data.inventarioHistorial : [] }; }