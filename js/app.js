import { auth, onAuthStateChanged, signOut, startDataSync, stopDataSync, subscribe, getState, saveData } from "./firebase.js";
export { getState, saveData, subscribe };
export function setupApp(render) {
    onAuthStateChanged(auth, user => {
        if (!user) { stopDataSync(); window.location.href = "./index.html"; return; }
        const updatePage = state => {
            render(state);
            document.querySelectorAll("[data-user-email]").forEach(element => element.textContent = user.email);
            document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", () => signOut(auth)));
        };
        startDataSync(user); subscribe(updatePage);
    });
}
export function money(value) { return `C$ ${Number(value || 0).toFixed(2)}`; }
export function esc(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[character])); }
export function isToday(dateText) { return String(dateText).includes(new Date().toLocaleDateString()); }
export function metrics(state) {
    const stock = state.inventario.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    const stockValue = state.inventario.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.precio ?? state.precioUnitarioGlobal), 0);
    const result = { stock, stockValue, cashToday:0, creditToday:0, unitsCashToday:0, unitsCreditToday:0, totalUnits:0, totalCashUnits:0, totalCreditUnits:0, paidUnits:0, paidMoney:0, cashTotal:0, debt:0, transactionsToday:0 };
    Object.values(state.creditos).forEach(credit => { result.debt += Number(credit.deuda || 0); });
    state.ventas.forEach(sale => {
        const quantity = Number(sale.cantidad || 0); const total = Number(sale.total || 0); const today = isToday(sale.fecha);
        if (sale.tipo === "Contado") { result.totalUnits += quantity; result.totalCashUnits += quantity; result.cashTotal += total; if (today) { result.cashToday += total; result.unitsCashToday += quantity; } }
        if (sale.tipo === "Credito") { result.totalUnits += quantity; result.totalCreditUnits += quantity; if (today) { result.creditToday += total; result.unitsCreditToday += quantity; } }
        if (["Abono", "Cancelado"].includes(sale.tipo)) { result.cashTotal += total; result.paidMoney += total; result.paidUnits += quantity; }
        if (today) result.transactionsToday++;
    });
    return result;
}
export function pageShell(title, subtitle, active, content) {
    const links = [{ href:"dashboard.html", icon:"▦", text:"Dashboard", key:"dashboard" }, { href:"inventario.html", icon:"□", text:"Inventario", key:"inventario" }, { href:"ventas.html", icon:"＋", text:"Nueva venta", key:"ventas" }, { href:"creditos.html", icon:"◎", text:"Créditos", key:"creditos" }, { href:"reportes.html", icon:"▤", text:"Reportes diarios", key:"reportes" }];
    document.body.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="sidebar-brand" href="dashboard.html"><span class="brand-mark">GV</span>Gestor de ventas</a><nav>${links.map(link => `<a class="nav-link ${link.key === active ? "active" : ""}" href="${link.href}"><span>${link.icon}</span>${link.text}</a>`).join("")}</nav><div class="sidebar-footer"><span data-user-email></span><br><button class="button button-quiet button-small" data-logout>Cerrar sesión</button></div></aside><main class="main-content"><header class="topbar"><div><p class="eyebrow">Panel de control</p><h1>${title}</h1><p>${subtitle}</p></div><div class="topbar-actions"><span class="user-pill" data-user-email></span></div></header>${content}</main></div>`;
}
export function card(label, value, note, tone="") { return `<article class="metric-card ${tone}"><p class="metric-label">${label}</p><p class="metric-value">${value}</p><p class="metric-note">${note}</p></article>`; }
export function badge(type) { const map = { Contado:["cash","Contado"], Credito:["credit","Crédito"], Abono:["paid","Abono"], Cancelado:["paid","Cancelado"] }; const item = map[type] || ["paid", type]; return `<span class="badge ${item[0]}">${item[1]}</span>`; }
export function transactionsTable(sales, limit = 0) { const items = limit ? sales.slice(0, limit) : sales; if (!items.length) return `<div class="empty-state">Todavía no hay movimientos registrados.</div>`; return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Cant.</th><th>Total</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>${items.map(sale => `<tr><td>${esc(sale.fecha)}</td><td><strong>${esc(sale.gaseosa)}</strong></td><td>${sale.cantidad || "-"}</td><td><strong>${money(sale.total)}</strong></td><td>${badge(sale.tipo)}</td><td>${esc(sale.observaciones)}</td></tr>`).join("")}</tbody></table></div>`; }