import { auth, onAuthStateChanged, signOut, startDataSync, stopDataSync, subscribe, getState, saveData, getSession, isReady } from "./firebase.js";
export { getState, saveData, subscribe, getSession };
export function setupApp(render) {
    onAuthStateChanged(auth, user => {
        if (!user) { stopDataSync(); window.location.href = "./index.html"; return; }
        const updatePage = state => {
            render(state);
            document.querySelectorAll("[data-user-email]").forEach(element => element.textContent = user.email);
            document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", () => signOut(auth)));
        };
        startDataSync(user).catch(error => { console.error("No se pudo preparar el perfil:", error); stopDataSync(); window.location.href = "./index.html"; }); subscribe(updatePage);
    });
}
export function money(value) { return `C$ ${Number(value || 0).toFixed(2)}`; }
export function can(action) { const role = getSession()?.role || "consulta"; const permissions = { sell:["propietario","administrador","vendedor","cajero"], manageInventory:["propietario","administrador","inventario"], manageCredits:["propietario","administrador","cajero"], viewFinancials:["propietario","administrador","cajero","consulta"] }; return permissions[action]?.includes(role) || false; }
export function esc(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[character])); }
export function dateKey(date = new Date()) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; }
export function monthKey(date = new Date()) { return dateKey(date).slice(0, 7); }
export function recordDate(value, isoValue) { if (isoValue) { const parsed = new Date(isoValue); return Number.isNaN(parsed.getTime()) ? null : dateKey(parsed); } const text = String(value || ""); const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`; const parsed = new Date(text); return Number.isNaN(parsed.getTime()) ? null : dateKey(parsed); }
export function isToday(dateText) { return recordDate(dateText) === dateKey(); }
export function salesForDate(sales, selectedDate) { return sales.filter(sale => recordDate(sale.fecha, sale.fechaISO) === selectedDate); }
export function chartData(state, selectedDate = dateKey()) {
    const daily = {}; const monthly = {};
    state.ventas.forEach(sale => { const day = recordDate(sale.fecha, sale.fechaISO); if (!day) return; const month = day.slice(0, 7); const bucket = { sales:0, credit:0, payments:0, units:0 }; daily[day] ??= { ...bucket }; monthly[month] ??= { ...bucket }; const amount = Number(sale.total || 0); const units = Number(sale.cantidad || 0); [daily[day], monthly[month]].forEach(item => { if (sale.tipo === "Contado") item.sales += amount; if (sale.tipo === "Credito") item.credit += amount; if (["Abono", "Cancelado"].includes(sale.tipo)) item.payments += amount; item.units += units; }); });
    const inventoryEntries = (state.inventarioHistorial || []).filter(item => item.fecha?.startsWith(selectedDate) && item.tipo === "entrada").reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
    const inventorySales = salesForDate(state.ventas, selectedDate);
    const inventoryCashOut = inventorySales.filter(sale => sale.tipo === "Contado").reduce((sum, sale) => sum + Number(sale.cantidad || 0), 0);
    const inventoryCreditOut = inventorySales.filter(sale => sale.tipo === "Credito").reduce((sum, sale) => sum + Number(sale.cantidad || 0), 0);
    const inventoryMoved = inventoryEntries - inventoryCashOut - inventoryCreditOut;
    const inventoryCurrent = state.inventario.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    return { daily, monthly, inventoryMoved, inventoryCurrent, inventoryEntries, inventoryCashOut, inventoryCreditOut };
}
export function metrics(state) {
    const stock = state.inventario.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    const stockValue = state.inventario.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.precio ?? state.precioUnitarioGlobal), 0);
    const result = { stock, stockValue, cashToday:0, creditToday:0, unitsCashToday:0, unitsCreditToday:0, totalUnits:0, totalCashUnits:0, totalCreditUnits:0, paidUnits:0, paidMoney:0, cashTotal:0, debt:0, transactionsToday:0 };
    Object.values(state.creditos).forEach(credit => { result.debt += Number(credit.deuda || 0); });
    state.ventas.forEach(sale => {
        const quantity = Number(sale.cantidad || 0); const total = Number(sale.total || 0); const today = recordDate(sale.fecha, sale.fechaISO) === dateKey();
        if (sale.tipo === "Contado") { result.totalUnits += quantity; result.totalCashUnits += quantity; result.cashTotal += total; if (today) { result.cashToday += total; result.unitsCashToday += quantity; } }
        if (sale.tipo === "Credito") { result.totalUnits += quantity; result.totalCreditUnits += quantity; if (today) { result.creditToday += total; result.unitsCreditToday += quantity; } }
        if (["Abono", "Cancelado"].includes(sale.tipo)) { result.cashTotal += total; result.paidMoney += total; result.paidUnits += quantity; }
        if (today) result.transactionsToday++;
    });
    return result;
}
export function pageShell(title, subtitle, active, content) {
    const session = getSession() || { role:"vendedor", email:"" };
    const links = [{ href:"dashboard.html", icon:"▦", text:"Dashboard", key:"dashboard", roles:["propietario","administrador","vendedor","cajero","inventario","consulta"] }, { href:"inventario.html", icon:"□", text:"Inventario", key:"inventario", roles:["propietario","administrador","inventario","consulta"] }, { href:"ventas.html", icon:"＋", text:"Nueva venta", key:"ventas", roles:["propietario","administrador","vendedor","cajero"] }, { href:"creditos.html", icon:"◎", text:"Créditos", key:"creditos", roles:["propietario","administrador","cajero"] }, { href:"reportes.html", icon:"▤", text:"Reportes diarios", key:"reportes", roles:["propietario","administrador","cajero","consulta"] }, { href:"usuarios.html", icon:"♙", text:"Equipo", key:"usuarios", roles:["propietario","administrador"] }].filter(link => link.roles.includes(session.role));
    const roleLabels = { propietario:"Propietario", administrador:"Administrador", vendedor:"Vendedor", cajero:"Cajero", inventario:"Inventario", consulta:"Consulta" };
    document.body.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="sidebar-brand" href="dashboard.html"><span class="brand-mark">GV</span>Gestor de ventas</a><nav>${links.map(link => `<a class="nav-link ${link.key === active ? "active" : ""}" href="${link.href}"><span>${link.icon}</span>${link.text}</a>`).join("")}</nav><div class="sidebar-footer"><span data-user-email></span><strong class="role-label">${roleLabels[session.role] || "Usuario"}</strong><br><button class="button button-quiet button-small" data-logout>Cerrar sesión</button></div></aside><main class="main-content"><header class="topbar"><div><p class="eyebrow">Panel de control</p><h1>${title}</h1><p>${subtitle}</p></div><div class="topbar-actions"><span class="user-pill" data-user-email></span></div></header>${content}</main></div>`;
}
export function card(label, value, note, tone="") { return `<article class="metric-card ${tone}"><p class="metric-label">${label}</p><p class="metric-value">${value}</p><p class="metric-note">${note}</p></article>`; }
export function badge(type) { const map = { Contado:["cash","Contado"], Credito:["credit","Crédito"], Abono:["paid","Abono"], Cancelado:["paid","Cancelado"] }; const item = map[type] || ["paid", type]; return `<span class="badge ${item[0]}">${item[1]}</span>`; }
export function transactionsTable(sales, limit = 0) { const items = limit ? sales.slice(0, limit) : sales; if (!items.length) return `<div class="empty-state">Todavía no hay movimientos registrados.</div>`; return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Cant.</th><th>Total</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>${items.map(sale => `<tr><td>${esc(sale.fecha)}</td><td><strong>${esc(sale.gaseosa)}</strong></td><td>${sale.cantidad || "-"}</td><td><strong>${money(sale.total)}</strong></td><td>${badge(sale.tipo)}</td><td>${esc(sale.observaciones)}</td></tr>`).join("")}</tbody></table></div>`; }