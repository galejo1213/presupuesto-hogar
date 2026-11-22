// Run: node v2/logic.test.js
const a = require('assert');
const L = require('./logic.js');

// parseN
a.strictEqual(L.parseN('4.400'), 4400);
a.strictEqual(L.parseN('1.250.000'), 1250000);
a.strictEqual(L.parseN('1,234.56'), 1234.56);
a.strictEqual(L.parseN('1.234,56'), 1234.56);
a.strictEqual(L.parseN('12,5'), 12.5);
a.strictEqual(L.parseN('CA$12.50'), 12.5);
a.strictEqual(L.parseN('-300'), -300);
a.strictEqual(L.parseN(''), 0);
a.strictEqual(L.parseN(undefined), 0);

// fmt
a.strictEqual(L.fmt(4400), '$4.400');
a.strictEqual(L.fmt(12.5), '$12,50');
a.strictEqual(L.fmt(-80), '−$80');

// months, incl. year change
a.strictEqual(L.addMonths('2026-12', 1), '2027-01');
a.strictEqual(L.addMonths('2027-01', -1), '2026-12');
a.strictEqual(L.monthLabel('2027-01'), 'Enero 2027');
a.strictEqual(L.daysInMonth('2027-02'), 28);
a.strictEqual(L.dueDay('2027-02', 31), 28);

// fijoStatus
const nov21 = new Date(2026, 10, 21);
a.strictEqual(L.fijoStatus({dia: 1, pagado: true}, '2026-11', nov21).code, 'pagado');
a.strictEqual(L.fijoStatus({dia: 10}, '2026-11', nov21).code, 'atrasado');
a.strictEqual(L.fijoStatus({dia: 21}, '2026-11', nov21).code, 'hoy');
a.strictEqual(L.fijoStatus({dia: 23}, '2026-11', nov21).label, 'En 2 días');
a.strictEqual(L.fijoStatus({dia: 28}, '2026-11', nov21).code, 'pendiente');
a.strictEqual(L.fijoStatus({dia: 1}, '2026-10', nov21).code, 'atrasado');
a.strictEqual(L.fijoStatus({dia: 1}, '2026-12', nov21).code, 'pendiente');

// totals
const mes = {
  ingresos: {p1: {a: {monto: 1000}}, p2: {b: {monto: 2000}, c: {monto: -100}}},
  presuVariable: 500,
  fijos: {r: {monto: 800, pagado: true, montoPagado: 820, catId: 'hogar'}, l: {monto: 100, pagado: false, catId: 'hogar'}},
  gastos: {g1: {catId: 'comida', monto: 60}, g2: {catId: 'hogar', monto: 40}},
};
const t = L.totals(mes);
a.strictEqual(t.ingresos, 2900);
a.strictEqual(t.fijosPresu, 900);
a.strictEqual(t.fijosPagado, 820);
a.strictEqual(t.pendiente, 100);
a.strictEqual(t.variables, 100);
a.strictEqual(t.gastado, 920);
a.strictEqual(t.proyeccion, 1020);
a.strictEqual(t.presupuestado, 1400);
a.strictEqual(t.disponible, 1880);
a.deepStrictEqual(t.porCat, {comida: 60, hogar: 860});
a.strictEqual(L.totals(undefined).ingresos, 0); // empty month from Firebase (empty objects are dropped)

// newMonth
let n = 0;
const nm = L.newMonth({personas: {p1: {base: 4400}, p2: {base: 0}}, fijos: {r: {label: 'Renta', monto: 800, dia: 1, catId: 'hogar'}}}, {presuVariable: 500}, () => 'id' + n++);
a.deepStrictEqual(nm.ingresos.p1, {id0: {label: 'Salario', monto: 4400}});
a.deepStrictEqual(nm.ingresos.p2, {});
a.strictEqual(nm.fijos.r.pagado, false);
a.strictEqual(nm.presuVariable, 500);

// importV1
const v = L.importV1(
  {'2026-08': {income: {ella: [{id: 'i1', label: 'Salario', amount: '4.400'}]}, budget: '3000', expenses: [{id: 'e1', catId: 'comida', subId: 'mercado', amount: 50, date: 1}]}, basura: {}},
  [{id: 'comida', label: 'Comida', icon: '🛒', subs: [{id: 'mercado', label: 'Mercado'}]}]
);
a.deepStrictEqual(Object.keys(v.meses), ['2026-08']);
a.strictEqual(v.meses['2026-08'].ingresos.p1.i1.monto, 4400);
a.strictEqual(v.meses['2026-08'].presuVariable, 3000);
a.strictEqual(v.meses['2026-08'].gastos.e1.monto, 50);
a.strictEqual(v.categorias.comida.subs.mercado, 'Mercado');

console.log('logic.test.js: OK');
