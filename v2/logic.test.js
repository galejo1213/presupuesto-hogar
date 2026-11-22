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

// lineStatus
const nov21 = new Date(2026, 10, 21);
const st = (l, real, k) => L.lineStatus(l, real, k || '2026-11', nov21);
a.strictEqual(st({monto: 100, dia: 1}, 100).code, 'pagado');
a.strictEqual(st({monto: 100, dia: 1}, 130).code, 'pagado');
a.strictEqual(st({monto: 700}, 430).label, 'Faltan $270');
a.strictEqual(st({monto: 100, dia: 10}, 0).code, 'atrasado');
a.strictEqual(st({monto: 100, dia: 21}, 0).code, 'hoy');
a.strictEqual(st({monto: 100, dia: 23}, 0).label, 'En 2 días');
a.strictEqual(st({monto: 100, dia: 28}, 0).code, 'pendiente');
a.strictEqual(st({monto: 100}, 0).code, 'mes');                 // no due date
a.strictEqual(st({monto: 100}, 0, '2026-10').code, 'atrasado'); // past month, unpaid
a.strictEqual(st({monto: 100, dia: 1}, 0, '2026-12').code, 'pendiente');

// totals: plan lines are covered by payments in the same category › subcategory
const mes = {
  ingresos: {p1: {a: {monto: 1000}}, p2: {b: {monto: 2000}, c: {monto: -100}}},
  presuVariable: 200,
  fijos: {
    r: {catId: 'hogar', subId: 'renta', monto: 800},   // paid 820 (over)
    m: {catId: 'comida', subId: 'mercado', monto: 700}, // paid 430 of 700
    l: {catId: 'hogar', subId: 'luz', monto: 100},      // unpaid
  },
  gastos: {
    g1: {catId: 'hogar', subId: 'renta', monto: 820},
    g2: {catId: 'comida', subId: 'mercado', monto: 400},
    g3: {catId: 'comida', subId: 'mercado', monto: 30},
    g4: {catId: 'ocio', subId: 'cafe', monto: 15},       // outside the plan
  },
};
const t = L.totals(mes);
a.strictEqual(t.ingresos, 2900);
a.strictEqual(t.planTotal, 1600);
a.strictEqual(t.gastado, 1265);
a.strictEqual(t.fueraPlan, 15);
a.strictEqual(t.enPlan, 1250);
a.strictEqual(t.pendiente, 270 + 100);
a.strictEqual(t.proyeccion, 1265 + 370);
a.strictEqual(t.presupuestado, 1800);
a.strictEqual(t.disponible, 2900 - 1635);
a.deepStrictEqual(t.porCat, {hogar: 820, comida: 430, ocio: 15});
a.deepStrictEqual(t.planCat, {hogar: 900, comida: 700});
a.strictEqual(L.realDe(mes, mes.fijos.m), 430);
a.strictEqual(L.totals(undefined).ingresos, 0); // empty month from Firebase (empty objects are dropped)

// newMonth
let n = 0;
const nm = L.newMonth({personas: {p1: {base: 4400}, p2: {base: 0}}, fijos: {r: {label: 'Renta', catId: 'hogar', subId: 'renta', monto: 800, dia: 1}}}, {presuVariable: 500}, () => 'id' + n++);
a.deepStrictEqual(nm.ingresos.p1, {id0: {label: 'Salario', monto: 4400}});
a.deepStrictEqual(nm.ingresos.p2, {});
a.deepStrictEqual(nm.fijos.r, {label: 'Renta', catId: 'hogar', subId: 'renta', monto: 800, dia: 1});
a.deepStrictEqual(nm.gastos, {});
a.strictEqual(nm.presuVariable, 500);

// planFromGastos: aggregates per subcategory, ordered by category
const cats = {hogar: {label: 'Hogar', orden: 0, subs: {renta: 'Renta'}}, comida: {label: 'Comida', orden: 1, subs: {mercado: 'Mercado'}}};
const plan = L.planFromGastos({x: {catId: 'comida', subId: 'mercado', monto: 500}, y: {catId: 'hogar', subId: 'renta', monto: '2.149'}, z: {catId: 'comida', subId: 'mercado', monto: 200}}, cats);
a.deepStrictEqual(plan, [
  {catId: 'hogar', subId: 'renta', label: 'Renta', monto: 2149, dia: 0},
  {catId: 'comida', subId: 'mercado', label: 'Mercado', monto: 700, dia: 0},
]);

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
