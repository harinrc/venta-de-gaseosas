import { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "./firebase.js";
const form = document.querySelector("#authForm");
const message = document.querySelector("#authMessage");
const registerForm = document.querySelector("#registerForm");
document.querySelector("#showRegister").addEventListener("click", () => { registerForm.classList.toggle("hidden"); });
onAuthStateChanged(auth, user => { if (user) window.location.href = "./dashboard.html"; });
form.addEventListener("submit", async event => {
    event.preventDefault(); message.textContent = "Verificando acceso...";
    try { await signInWithEmailAndPassword(auth, document.querySelector("#authEmail").value, document.querySelector("#authPassword").value); }
    catch { message.textContent = "No se pudo iniciar sesión. Verifica tus datos."; }
});
registerForm.addEventListener("submit", async event => {
    event.preventDefault(); const registerMessage = document.querySelector("#registerMessage"); registerMessage.textContent = "Creando cuenta...";
    try { const email = document.querySelector("#registerEmail").value.trim().toLowerCase(); localStorage.setItem(`gestor-nombre:${email}`, document.querySelector("#registerName").value.trim()); await createUserWithEmailAndPassword(auth, email, document.querySelector("#registerPassword").value); }
    catch (error) { registerMessage.textContent = error.code === "auth/email-already-in-use" ? "Ese correo ya tiene una cuenta." : "No se pudo crear la cuenta."; }
});