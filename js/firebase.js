import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = { apiKey:"AIzaSyA4IRznoPg7u0wYCv6M-2yFXIMX7G2qcms", authDomain:"ventas-de-gaseosas.firebaseapp.com", projectId:"ventas-de-gaseosas", storageBucket:"ventas-de-gaseosas.firebasestorage.app", messagingSenderId:"1050157736697", appId:"1:1050157736697:web:fad9ea67d8bee2b0373828" };
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);
export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged };

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
    let profileSnapshot = null;
    try { profileSnapshot = await getDoc(profileRef); } catch (error) { console.warn("Perfil todavía no disponible; se conserva el modo propietario.", error); }
    let profile = profileSnapshot?.exists() ? profileSnapshot.data() : null;
    if (!profile) {
        let invitationSnapshot = { exists:() => false };
        try { invitationSnapshot = await getDoc(doc(db, "invitaciones", user.email.toLowerCase())); } catch (error) { console.warn("No se pudo consultar la invitación.", error); }
        const pendingName = localStorage.getItem(`gestor-nombre:${user.email.toLowerCase()}`);
        profile = invitationSnapshot.exists() ? { ...invitationSnapshot.data(), nombre: invitationSnapshot.data().nombre || pendingName || user.email.split("@")[0] } : { nombre: pendingName || user.email?.split("@")[0] || "Usuario", rol: "propietario", negocioId: `personal:${user.uid}` };
    }
    if (!profileSnapshot || !profileSnapshot.exists()) { try { await setDoc(profileRef, { ...profile, uid: user.uid, correo: user.email, creadoEn: new Date().toISOString() }); } catch (error) { console.warn("No se pudo crear el perfil todavía.", error); } }
    session = { uid: user.uid, email: user.email, name: profile.nombre || user.email, role: profile.rol || "vendedor", businessId: profile.negocioId || `personal:${user.uid}` };
    state = { inventario: [], ventas: [], creditos: {}, totalAbonosHistorico: 0, precioUnitarioGlobal: 50, miembros: [], papelera: [] };
    if (unsubscribe) unsubscribe();
    const dataRef = session.businessId.startsWith("personal:") ? doc(db, "usuarios", user.uid) : doc(db, "negocios", session.businessId);
    unsubscribe = onSnapshot(dataRef, snapshot => {
        state = snapshot.exists() ? normalizeState(snapshot.data()) : { ...state };
        purgeExpiredTrash();
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
export async function createInvitation(email, role, businessId, name = "") { const normalizedEmail = email.trim().toLowerCase(); const invitation = { correo:normalizedEmail, nombre:name.trim(), rol:role, negocioId:businessId, creadoEn:new Date().toISOString() }; await setDoc(doc(db, "invitaciones", normalizedEmail), invitation); const businessRef = doc(db, "negocios", businessId); const snapshot = await getDoc(businessRef); const members = snapshot.exists() && Array.isArray(snapshot.data().miembros) ? snapshot.data().miembros : []; const nextMembers = [...members.filter(member => member.correo !== normalizedEmail), invitation]; return setDoc(businessRef, { miembros:nextMembers }, { merge:true }); }
export async function activateSharedBusiness() { if (!session || !currentUser) throw new Error("No hay sesión activa."); if (!session.businessId.startsWith("personal:")) return session.businessId; const businessId = `negocio-${currentUser.uid}`; const owner = { uid:currentUser.uid, correo:currentUser.email, nombre:session.name, rol:"propietario" }; await setDoc(doc(db, "negocios", businessId), { ...state, miembros:[owner], creadoEn:new Date().toISOString() }); await setDoc(doc(db, "perfiles", currentUser.uid), { negocioId:businessId }, { merge:true }); return businessId; }
export async function resetAllData() { if (!session || session.role !== "propietario") throw new Error("Solo el propietario puede reiniciar los datos."); const now = new Date(); const snapshot = { id:`papelera-${now.getTime()}`, eliminadoEn:now.toISOString(), venceEn:new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), resumen:{ ventas:state.ventas.length, productos:state.inventario.length, creditos:Object.keys(state.creditos).length }, datos:{ inventario:state.inventario, ventas:state.ventas, creditos:state.creditos, totalAbonosHistorico:state.totalAbonosHistorico, precioUnitarioGlobal:state.precioUnitarioGlobal, inventarioHistorial:state.inventarioHistorial || [] } }; state = { inventario:[], ventas:[], creditos:{}, totalAbonosHistorico:0, precioUnitarioGlobal:50, inventarioHistorial:[], miembros:state.miembros || [], papelera:[...(state.papelera || []), snapshot] }; await saveData(); return state; }
export async function restoreTrash(id) { if (!session || session.role !== "propietario") throw new Error("Solo el propietario puede restaurar datos."); const entry = state.papelera?.find(item => item.id === id); if (!entry) throw new Error("La copia ya no existe."); state = { ...state, ...entry.datos, papelera:state.papelera.filter(item => item.id !== id) }; await saveData(); return state; }
export async function deleteTrash(id) { if (!session || session.role !== "propietario") throw new Error("Solo el propietario puede eliminar copias."); state.papelera = (state.papelera || []).filter(item => item.id !== id); await saveData(); return state; }
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
function normalizeState(data) { return { inventario: Array.isArray(data.inventario) ? data.inventario : [], ventas: Array.isArray(data.ventas) ? data.ventas : [], creditos: data.creditos && typeof data.creditos === "object" ? data.creditos : {}, totalAbonosHistorico: Number(data.totalAbonosHistorico || 0), precioUnitarioGlobal: Number(data.precioUnitarioGlobal || 50), inventarioHistorial: Array.isArray(data.inventarioHistorial) ? data.inventarioHistorial : [], miembros: Array.isArray(data.miembros) ? data.miembros : [], papelera: Array.isArray(data.papelera) ? data.papelera : [] }; }
function purgeExpiredTrash() { const now = Date.now(); const active = (state.papelera || []).filter(item => new Date(item.venceEn).getTime() > now); if (active.length !== (state.papelera || []).length) { state.papelera = active; saveData(); } }