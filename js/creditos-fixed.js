import { setupApp, pageShell, card, metrics, money, esc, getState, saveData, can, dateKey, salesForDate } from "./app.js";

function render(state) {
    const summary = metrics(state);
    const today = salesForDate(state.ventas, dateKey());
    const cashUnits = today.filter(sale => sale.tipo === "Contado").reduce((sum, sale) => sum + Number(sale.cantidad || 0), 0);
    const creditUnits = today.filter(sale => sale.tipo === "Credito").reduce((sum, sale) => sum + Number(sale.cantidad || 0), 0);
    const clients = Object.entries(state.creditos);
    pageShell("Cuentas por cobrar", "Cada cliente tiene su propia cuenta, productos y movimientos.", "creditos", `
        <section class="cards">${card("Deuda total", money(summary.debt), "Saldo pendiente actual", "red")}${card("Clientes activos", clients.length, "Cuentas abiertas", "")}${card("Unidades al contado hoy", cashUnits, "Productos pagados hoy", "orange")}${card("Unidades a crédito hoy", creditUnits, "Productos fiados hoy", "blue")}${card("Pagos recibidos", money(summary.paidMoney), "Abonos y cancelaciones", "orange")}</section>
        <section class="section-title"><div><h2>Clientes con crédito</h2><p>Selecciona el nombre para consultar su cuenta completa.</p></div><button id="manualDebt" class="button button-primary">Agregar deuda manual</button></section>
        <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Cliente</th><th>Productos fiados</th><th>Unidades</th><th>Deuda actual</th><th>Acciones</th></tr></thead><tbody>${clients.length ? clients.map(([name, credit]) => `<tr><td><button class="link-button" data-detail="${encodeURIComponent(name)}">${esc(name)}</button></td><td>${Object.entries(credit.items || {}).map(([product, amount]) => `${amount}x ${esc(product)}`).join(", ") || "Saldo manual"}</td><td>${credit.unidades}</td><td><strong>${money(credit.deuda)}</strong></td><td><button class="button button-quiet button-small" data-pay="${encodeURIComponent(name)}">Registrar abono</button></td></tr>`).join("") : `<tr><td colspan="5"><div class="empty-state">No hay créditos activos.</div></td></tr>`}</tbody></table></div></section>
        <section id="clientDetail" class="panel client-detail hidden"></section>
    `);
    document.querySelector("#manualDebt").addEventListener("click", addManualDebt);
    document.querySelectorAll("[data-detail]").forEach(button => button.addEventListener("click", () => showClientDetail(decodeURIComponent(button.dataset.detail), state)));
    document.querySelectorAll("[data-pay]").forEach(button => button.addEventListener("click", () => payCredit(decodeURIComponent(button.dataset.pay))));
}

function showClientDetail(name, state) {
    const credit = state.creditos[name];
    const history = state.ventas.filter(sale => String(sale.observaciones || "").toLowerCase().includes(name.toLowerCase()) || String(sale.gaseosa || "").toLowerCase().includes(name.toLowerCase()));
    const detail = document.querySelector("#clientDetail");
    detail.classList.remove("hidden");
    detail.innerHTML = `<div class="panel-header"><div><p class="eyebrow">Cuenta del cliente</p><h2>${esc(name)}</h2></div><button class="button button-quiet button-small" id="closeDetail">Cerrar detalle</button></div><section class="cards detail-cards">${card("Deuda actual", money(credit.deuda), "Saldo pendiente", "red")}${card("Unidades pendientes", credit.unidades, "Productos asociados", "blue")}${card("Productos distintos", Object.keys(credit.items || {}).length, "Referencias fiadas", "")}</section><h3>Productos en crédito</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Producto</th><th>Unidades pendientes</th></tr></thead><tbody>${Object.entries(credit.items || {}).map(([product, amount]) => `<tr><td>${esc(product)}</td><td>${amount}</td></tr>`).join("") || `<tr><td colspan="2">Saldo agregado manualmente</td></tr>`}</tbody></table></div><h3>Movimientos del cliente</h3>${history.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Cantidad</th><th>Total</th><th>Estado</th></tr></thead><tbody>${history.map(sale => `<tr><td>${esc(sale.fecha)}</td><td>${esc(sale.gaseosa)}</td><td>${sale.cantidad || "-"}</td><td>${money(sale.total)}</td><td>${sale.tipo}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No hay movimientos detallados para este cliente.</div>`}`;
    document.querySelector("#closeDetail").addEventListener("click", () => detail.classList.add("hidden"));
    detail.scrollIntoView({ behavior:"smooth", block:"start" });
}

function addManualDebt() { if (!can("manageCredits")) return alert("Tu rol no permite agregar deudas manuales."); const state = getState(); const name = prompt("Nombre del cliente:"); if (!name?.trim()) return; const amount = Number(prompt(`Monto pendiente de ${name}:`, state.precioUnitarioGlobal)); if (!(amount > 0)) return alert("Ingresa un monto válido."); const now = new Date(); const units = Math.round(amount / state.precioUnitarioGlobal); state.creditos[name.trim()] ??= { unidades:0, deuda:0, items:{} }; state.creditos[name.trim()].deuda += amount; state.creditos[name.trim()].unidades += units; state.ventas.unshift({ fecha:now.toLocaleString(), fechaISO:now.toISOString(), gaseosa:"Saldo anterior", cantidad:units, total:amount, tipo:"Credito", observaciones:`Deuda manual agregada a: ${name.trim()}` }); saveData(); }
function payCredit(name) { if (!can("manageCredits")) return alert("Tu rol no permite registrar abonos."); const state = getState(); const credit = state.creditos[name]; const amount = Number(prompt(`Saldo de ${name}: ${money(credit.deuda)}\nMonto del abono:`, credit.deuda)); if (!(amount > 0)) return; const now = new Date(); const paid = Math.min(amount, credit.deuda); const full = paid >= credit.deuda; const units = full ? credit.unidades : Math.round(credit.unidades * paid / credit.deuda); state.totalAbonosHistorico += paid; if (full) delete state.creditos[name]; else { credit.deuda -= paid; credit.unidades = Math.max(0, credit.unidades - units); } state.ventas.unshift({ fecha:now.toLocaleString(), fechaISO:now.toISOString(), gaseosa:`Pago / Abono de ${name}`, cantidad:units, total:paid, tipo:full ? "Cancelado" : "Abono", observaciones:full ? `Cuenta de ${name} cancelada` : `Abono parcial de ${name}` }); saveData(); }

pageShell("Cargando...", "Preparando créditos.", "creditos", "");
setupApp(render);
