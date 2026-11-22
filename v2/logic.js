// Pure budget logic: no DOM, no Firebase. Tested by logic.test.js (node v2/logic.test.js).
(function(root){
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const vals = o => Object.values(o || {});
  const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);

  // Accepts "4.400", "1,250.50", "12,5", "CA$12.50"; money never has 3 decimals, so x.xxx = miles.
  function parseN(v){
    if(typeof v === 'number') return isFinite(v) ? v : 0;
    let s = String(v || '').replace(/[^0-9.,-]/g, '');
    const neg = s.startsWith('-');
    s = s.replace(/-/g, '');
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.'), dec = Math.max(lc, ld);
    if(dec > -1){
      const after = s.length - dec - 1;
      if((lc === -1 || ld === -1) && after === 3) s = s.replace(/[.,]/g, '');
      else s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1);
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : (neg ? -n : n);
  }

  function fmt(n){
    const r = Math.round(n * 100) / 100;
    const s = Math.abs(r).toLocaleString('es-CO', {minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2});
    return (r < 0 ? '−$' : '$') + s;
  }

  const monthKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const monthLabel = k => { const [y, m] = k.split('-'); return MESES[+m - 1] + ' ' + y; };
  const monthName = k => MESES[+k.split('-')[1] - 1];
  const addMonths = (k, n) => { const [y, m] = k.split('-').map(Number); return monthKey(new Date(y, m - 1 + n, 1)); };
  const daysInMonth = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const dueDay = (k, dia) => Math.min(Math.max(1, dia | 0 || 1), daysInMonth(k));

  // A plan line (mes.fijos) is covered by the month's payments (mes.gastos) in the same category › subcategory.
  const lineKey = (catId, subId) => (catId || '') + '|' + (subId || '');
  function realPorLinea(mes){
    const r = {};
    vals((mes || {}).gastos).forEach(g => { const k = lineKey(g.catId, g.subId); r[k] = (r[k] || 0) + parseN(g.monto); });
    return r;
  }
  const realDe = (mes, l) => realPorLinea(mes)[lineKey(l.catId, l.subId)] || 0;

  // today: Date. real: amount paid so far for this line. dia 0/empty = no due date.
  function lineStatus(l, real, k, today){
    const monto = parseN(l.monto);
    if(real > 0 && real >= monto) return {code:'pagado', label:'Pagado'};
    if(real > 0) return {code:'parcial', label:'Faltan ' + fmt(monto - real)};
    const cur = monthKey(today);
    if(!l.dia) return k < cur ? {code:'atrasado', label:'No pagado'} : {code:'mes', label:'Este mes'};
    if(k < cur) return {code:'atrasado', label:'Atrasado'};
    if(k > cur) return {code:'pendiente', label:'Día ' + dueDay(k, l.dia)};
    const diff = dueDay(k, l.dia) - today.getDate();
    if(diff < 0) return {code:'atrasado', label:'Atrasado'};
    if(diff === 0) return {code:'hoy', label:'Vence hoy'};
    if(diff === 1) return {code:'pronto', label:'Mañana'};
    if(diff <= 3) return {code:'pronto', label:'En ' + diff + ' días'};
    return {code:'pendiente', label:'Día ' + dueDay(k, l.dia)};
  }

  function totals(mes){
    mes = mes || {};
    const ing = mes.ingresos || {};
    const plan = vals(mes.fijos), gastos = vals(mes.gastos);
    const real = realPorLinea(mes);
    const planKeys = new Set(plan.map(l => lineKey(l.catId, l.subId)));
    const porPersona = {p1: sum(vals(ing.p1), e => parseN(e.monto)), p2: sum(vals(ing.p2), e => parseN(e.monto))};
    const ingresos = porPersona.p1 + porPersona.p2;
    const planTotal = sum(plan, l => parseN(l.monto));
    const pendiente = sum(plan, l => Math.max(0, parseN(l.monto) - (real[lineKey(l.catId, l.subId)] || 0)));
    const gastado = sum(gastos, g => parseN(g.monto));
    const fueraPlan = sum(gastos.filter(g => !planKeys.has(lineKey(g.catId, g.subId))), g => parseN(g.monto));
    const porCat = {}, planCat = {};
    gastos.forEach(g => porCat[g.catId] = (porCat[g.catId] || 0) + parseN(g.monto));
    plan.forEach(l => planCat[l.catId] = (planCat[l.catId] || 0) + parseN(l.monto));
    const proyeccion = gastado + pendiente;
    const presupuestado = planTotal + parseN(mes.presuVariable);
    return {porPersona, ingresos, planTotal, pendiente, gastado, enPlan: gastado - fueraPlan, fueraPlan, proyeccion, presupuestado,
            disponible: ingresos - proyeccion, vsPresupuesto: presupuestado - proyeccion, porCat, planCat};
  }

  const planLine = l => ({label: l.label || '', catId: l.catId || '', subId: l.subId || '', monto: parseN(l.monto), dia: l.dia | 0});

  // New month: base salaries + recurring plan lines; presuVariable carries over from the previous month.
  function newMonth(config, prev, uid){
    config = config || {};
    const ingresos = {};
    ['p1', 'p2'].forEach(p => {
      const base = parseN(((config.personas || {})[p] || {}).base);
      ingresos[p] = base ? {[uid()]: {label: 'Salario', monto: base}} : {};
    });
    const fijos = {};
    Object.entries(config.fijos || {}).forEach(([id, l]) => fijos[id] = planLine(l));
    return {ingresos, fijos, gastos: {}, presuVariable: parseN((prev || {}).presuVariable)};
  }

  // Turns a month's recorded amounts into plan lines, one per category › subcategory, in category order.
  function planFromGastos(gastos, categorias){
    const out = {};
    vals(gastos).forEach(g => {
      const k = lineKey(g.catId, g.subId);
      const c = (categorias || {})[g.catId] || {};
      if(!out[k]) out[k] = {catId: g.catId || '', subId: g.subId || '', label: (c.subs || {})[g.subId] || c.label || 'Pago', monto: 0, dia: 0, orden: c.orden ?? 99};
      out[k].monto += parseN(g.monto);
    });
    return Object.values(out).sort((a, b) => a.orden - b.orden).map(({orden, ...l}) => l);
  }

  // v1 → v2. v1: meses/{k}: {income:{ella:[],el:[]}, budget, expenses:[]}, categorias: [{id,label,icon,subs:[]}]
  function importV1(v1meses, v1cats){
    const categorias = {};
    (v1cats || []).filter(Boolean).forEach((c, i) => {
      const subs = {};
      (c.subs || []).filter(Boolean).forEach(s => subs[s.id] = s.label);
      categorias[c.id] = {label: c.label, icon: c.icon || '📦', orden: i, subs};
    });
    const meses = {};
    Object.entries(v1meses || {}).forEach(([k, m]) => {
      if(!/^\d{4}-\d{2}$/.test(k) || !m) return;
      const ingresos = {p1: {}, p2: {}};
      [['ella', 'p1'], ['el', 'p2']].forEach(([from, to]) => {
        vals((m.income || {})[from]).forEach(e => { if(e && e.id) ingresos[to][e.id] = {label: e.label || 'Ingreso', monto: parseN(e.amount)}; });
      });
      const gastos = {};
      vals(m.expenses).forEach(e => { if(e && e.id) gastos[e.id] = {catId: e.catId, subId: e.subId || '', monto: parseN(e.amount), fecha: e.date || 0, nota: ''}; });
      meses[k] = {ingresos, fijos: {}, gastos, presuVariable: parseN(m.budget)};
    });
    return {categorias, meses};
  }

  root.L = {MESES, vals, parseN, fmt, monthKey, monthLabel, monthName, addMonths, daysInMonth, dueDay, lineKey, realPorLinea, realDe, lineStatus, totals, planLine, newMonth, planFromGastos, importV1};
  if(typeof module !== 'undefined') module.exports = root.L;
})(typeof window !== 'undefined' ? window : globalThis);
