import { auth, onAuthStateChanged, signInWithEmailAndPassword } from "./firebase.js";
const form = document.querySelector("#authForm");
const message = document.querySelector("#authMessage");
onAuthStateChanged(auth, user => { if (user) window.location.href = "./dashboard.html"; });
form.addEventListener("submit", async event => {
    event.preventDefault(); message.textContent = "Verificando acceso...";
    try { await signInWithEmailAndPassword(auth, document.querySelector("#authEmail").value, document.querySelector("#authPassword").value); }
    catch { message.textContent = "No se pudo iniciar sesión. Verifica tus datos."; }
});