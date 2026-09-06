import { setupApp, pageShell, card, metrics, money, transactionsTable, chartData, dateKey, salesForDate } from "./app.js";

let selectedDate = dateKey();

function chartBars(items, valueKey, formatter, label) {
    const values = Object.values(items).slice(-12);
    if (!values.length) return '<div class="empty-state">Aún no hay registros suficientes para graficar.</div>';
    const max = Math.max(...values.map(item => Number(item[valueKey] || 0)), 1);
    const total = values.reduce((sum, item) => sum + Number(item[valueKey] || 0), 0);
    const color = valueKey === "sales" ? "cash" : valueKey === "credit" ? "credit" : "payments";
    return `<div class="chart-visual">
        <div class="chart-list">${values.map(item => `<div class="bar-row"><span>${item.label}</span><span class="bar-track"><span class="bar-fill ${color}" style="width:${Math.max(item[valueKey] ? 5 : 0, Number(item[valueKey] || 0) / max * 100)}%"></span></span><strong>${formatter(item[valueKey])}</strong></div>`).join("")}</div>
        <div class="donut-wrap"><div class="donut donut-${color}"><span>${formatter(total)}</span></div><div class="donut-legend"><span><i class="legend-dot ${color}"></i>${label}</span></div></div>
    </div>`;
}

function render(state) {
    const summary = metrics(state);
    const selected = salesForDate(state.ventas, selectedDate);
    const cash = selected.filter(sale => sale.tipo === "Contado").reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const credit = selected.filter(sale => sale.tipo === "Credito").reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const paid = selected.filter(sale => ["Abono", "Cancelado"].includes(sale.tipo)).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const data = chartData(state, selectedDate);
    const monthly = Object.fromEntries(Object.entries(data.monthly).map(([key, value]) => [key, { ...value, label: key }]));
    const daily = Object.fromEntries(Object.entries(data.daily).map(([key, value]) => [key, { ...value, label: key.slice(5) }]));

    pageShell("Reportes diarios", "Revisa cada registro por fecha y separa contado, crédito y pagos.", "reportes", `
        <section class="panel report-filter"><div class="form-actions"><label style="max-width:220px">Día del reporte<input id="reportDate" type="date" value="${selectedDate}"></label><span class="notice">El historial conserva todas las operaciones en Firestore.</span></div></section>
        <section class="section-title"><div><h2>Resumen del día</h2><p>${selectedDate === dateKey() ? "Fecha actual" : "Fecha seleccionada"}</p></div></section>
        <section class="cards">${card("Contado", money(cash), "Ventas pagadas en el día", "orange")}${card("Crédito", money(credit), "Ventas fiadas en el día", "red")}${card("Pagos recibidos", money(paid), "Abonos y cancelaciones", "blue")}${card("Movimientos", selected.length, "Registros del día", "")}</section>
        <section class="section-title"><div><h2>Gráficos de actividad</h2><p>Comparación mensual y detalle diario de ventas, créditos y pagos.</p></div></section>
        <section class="grid-two report-charts"><article class="panel chart-panel"><div class="panel-header"><h2>Últimos meses</h2><span class="chart-caption">Córdobas</span></div>${chartBars(monthly, "sales", money, "Contado")}</article><article class="panel chart-panel"><div class="panel-header"><h2>Días registrados</h2><span class="chart-caption">Córdobas</span></div>${chartBars(daily, "sales", money, "Contado")}</article></section>
        <section class="grid-three report-charts"><article class="panel chart-panel"><div class="panel-header"><h2>Crédito mensual</h2><span class="chart-caption">Córdobas</span></div>${chartBars(monthly, "credit", money, "Crédito")}</article><article class="panel chart-panel"><div class="panel-header"><h2>Pagos mensuales</h2><span class="chart-caption">Córdobas</span></div>${chartBars(monthly, "payments", money, "Pagos")}</article><article class="panel chart-panel"><div class="panel-header"><h2>Inventario del día</h2><span class="chart-caption">Movimientos</span></div><div class="inventory-chart"><strong>${data.inventory}</strong><span>unidades movidas</span><div class="inventory-track"><i style="width:${Math.min(Math.abs(data.inventory) * 5, 100)}%"></i></div></div></article></section>
        <section class="section-title"><div><h2>Registros del día</h2><p>Incluye ventas, abonos, cancelaciones y saldos manuales.</p></div></section>
        <section class="panel report-table">${transactionsTable(selected)}</section>
        <section class="section-title"><div><h2>Acumulado general</h2><p>Comparativa desde el primer registro.</p></div></section>
        <section class="grid-three"><article class="panel"><div class="summary-row"><span>Ingresos en caja</span><strong>${money(summary.cashTotal)}</strong></div><div class="summary-row"><span>Unidades vendidas</span><strong>${summary.totalUnits}</strong></div></article><article class="panel"><div class="summary-row"><span>Contado acumulado</span><strong>${money(state.ventas.filter(sale => sale.tipo === "Contado").reduce((sum, sale) => sum + Number(sale.total || 0), 0))}</strong></div><div class="summary-row"><span>Crédito pendiente</span><strong>${money(summary.debt)}</strong></div></article><article class="panel"><div class="summary-row"><span>Productos</span><strong>${state.inventario.length}</strong></div><div class="summary-row"><span>Clientes con deuda</span><strong>${Object.keys(state.creditos).length}</strong></div></article></section>
    `);
    document.querySelector("#reportDate").addEventListener("change", event => { selectedDate = event.target.value; render(state); });
}

pageShell("Cargando...", "Preparando reportes.", "reportes", "");
setupApp(render);
