import { setupApp, pageShell, card, metrics, money, esc, getState, saveData, can } from "./app.js";

function movementLabel(type) {
    return { entrada: ["cash", "Entrada"], salida: ["credit", "Salida por venta"], eliminacion: ["paid", "Producto eliminado"] }[type] || ["paid", type];
}

function render(state) {
    const summary = metrics(state);
    const movements = [...(state.inventarioHistorial || [])].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    pageShell("Inventario", "Controla productos, existencias, precios y cada movimiento registrado.", "inventario", `
        <section class="cards">${card("Productos activos", state.inventario.length, "Referencias cargadas", "")}${card("Unidades disponibles", summary.stock, "Stock actual en tiempo real", "blue")}${card("Valor del inventario", money(summary.stockValue), "Existencias a precio de venta", "orange")}${card("Movimientos registrados", movements.length, "Entradas, salidas y ajustes", "red")}</section>
        <section class="section-title"><div><h2>Agregar existencias</h2><p>Cada entrada queda guardada con fecha y hora.</p></div></section>
        <section class="panel"><form id="inventoryForm" class="inline-form"><label>Nombre del producto<input id="productName" placeholder="Ej. Café molido 500 g" required></label><label>Existencias<input id="productStock" type="number" min="0" placeholder="0" required></label><label>Precio unitario<input id="productPrice" type="number" min="0" step="0.01" placeholder="${state.precioUnitarioGlobal}"></label><button class="button button-primary" type="submit">Agregar entrada</button></form></section>
        <section class="section-title"><div><h2>Existencias actuales</h2><p>El stock se actualiza en tiempo real después de cada operación.</p></div></section>
        <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Producto</th><th>Existencias</th><th>Precio</th><th>Valor total</th><th>Acciones</th></tr></thead><tbody>${state.inventario.length ? state.inventario.map(item => `<tr><td><strong>${esc(item.nombre)}</strong></td><td>${item.stock}</td><td>${money(item.precio ?? state.precioUnitarioGlobal)}</td><td>${money(Number(item.stock) * Number(item.precio ?? state.precioUnitarioGlobal))}</td><td><button class="button button-quiet button-small" data-edit="${item.id}">Editar precio</button> <button class="button button-danger button-small" data-delete="${item.id}">Eliminar</button></td></tr>`).join("") : `<tr><td colspan="5"><div class="empty-state">No hay productos todavía. Agrega el primero arriba.</div></td></tr>`}</tbody></table></div></section>
        <section class="section-title"><div><h2>Historial de movimientos</h2><p>Registro en tiempo real de entradas, salidas por ventas y ajustes.</p></div></section>
        <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha y hora</th><th>Producto</th><th>Tipo</th><th>Cantidad</th></tr></thead><tbody>${movements.length ? movements.slice(0, 100).map(item => { const [tone, label] = movementLabel(item.tipo); return `<tr><td>${new Date(item.fecha).toLocaleString()}</td><td><strong>${esc(item.producto)}</strong></td><td><span class="badge ${tone}">${label}</span></td><td>${item.cantidad > 0 ? "+" : ""}${item.cantidad}</td></tr>`; }).join("") : `<tr><td colspan="4"><div class="empty-state">Todavía no hay movimientos de inventario.</div></td></tr>`}</tbody></table></div></section>
        <section class="section-title"><div><h2>Precio predeterminado</h2><p>Se usa en productos nuevos sin precio propio.</p></div></section>
        <section class="panel"><form id="globalPriceForm" class="form-actions"><label style="max-width:260px">Precio predeterminado<input id="globalPrice" type="number" min="0" step="0.01" value="${state.precioUnitarioGlobal}"></label><label class="check-label"><input id="applyGlobalPrice" type="checkbox"> Aplicar a todos los productos</label><button class="button button-primary" type="submit">Guardar precio</button></form><p class="muted">Sin marcar la opción, solo cambia el valor predeterminado.</p></section>
    `);
    bindEvents();
}

function bindEvents() {
    if (!can("manageInventory")) return;
    document.querySelector("#inventoryForm").addEventListener("submit", event => {
        event.preventDefault();
        const name = document.querySelector("#productName").value.trim();
        const stock = Number(document.querySelector("#productStock").value);
        const priceInput = Number(document.querySelector("#productPrice").value);
        if (!name || stock < 0) return alert("Completa un nombre y una cantidad válida.");
        const state = getState();
        const price = priceInput > 0 ? priceInput : state.precioUnitarioGlobal;
        const existing = state.inventario.find(item => item.nombre.toLowerCase() === name.toLowerCase());
        if (existing) { existing.stock += stock; existing.precio = price; } else state.inventario.push({ id:Date.now(), nombre:name, stock, precio:price });
        state.inventarioHistorial ??= [];
        state.inventarioHistorial.push({ fecha:new Date().toISOString(), producto:name, cantidad:stock, tipo:"entrada" });
        saveData();
    });
    document.querySelector("#globalPriceForm").addEventListener("submit", event => { event.preventDefault(); const price = Number(document.querySelector("#globalPrice").value); if (price > 0) { const state = getState(); state.precioUnitarioGlobal = price; if (document.querySelector("#applyGlobalPrice").checked) state.inventario.forEach(item => { item.precio = price; }); saveData(); } });
    document.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => { const state = getState(); const item = state.inventario.find(product => String(product.id) === button.dataset.edit); const price = prompt(`Nuevo precio para ${item.nombre}`, item.precio); if (price !== null && Number(price) > 0) { item.precio = Number(price); saveData(); } }));
    document.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => { if (!confirm("¿Eliminar este producto del inventario?")) return; const state = getState(); const item = state.inventario.find(product => String(product.id) === button.dataset.delete); state.inventarioHistorial ??= []; state.inventarioHistorial.push({ fecha:new Date().toISOString(), producto:item.nombre, cantidad:-Number(item.stock || 0), tipo:"eliminacion" }); state.inventario = state.inventario.filter(product => String(product.id) !== button.dataset.delete); saveData(); }));
}
+
+pageShell("Cargando...", "Preparando inventario.", "inventario", "");
+setupApp(render);
