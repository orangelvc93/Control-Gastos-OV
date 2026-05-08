import { useEffect, useMemo, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import seedData from './data.json';

const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:3002/api';
const tabs = ['Dashboard', 'Movimientos', 'Ahorros', 'Deudas', 'Gastos vs Sueldo'];
const tabMeta = {
  Dashboard: 'Vista general',
  Movimientos: 'Caja diaria',
  Ahorros: 'Fondos',
  Deudas: 'Prestamos',
  'Gastos vs Sueldo': 'Presupuesto',
};

const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(items, selector) {
  return items.reduce((total, item) => total + toNumber(selector(item)), 0);
}

function finalSaving(row) {
  return toNumber(row.initial) + toNumber(row.deposit) + toNumber(row.interest);
}

function emptyPayment(month) {
  return { date: today(), month, category: '', concept: '', status: 'Pagado', amount: '' };
}

function emptyIncome(month) {
  return { date: today(), month, source: '', concept: '', type: 'Fijo', amount: '' };
}

function emptyDebt() {
  return { loan: '', description: '', total: '', monthlyPayment: '', totalInstallments: '', currentInstallment: 0, interest: 'Sin interes', monthValue: '', archived: false };
}

function openDatePicker(event) {
  event.currentTarget.showPicker?.();
}

function withJournal(data, action, detail = '') {
  return {
    ...data,
    journal: [
      ...(data.journal ?? []),
      { date: new Date().toLocaleString('es-EC'), action, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) },
    ],
  };
}

function App() {
  const [authConfig, setAuthConfig] = useState({ username: 'orangelvc93', password: '123456' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('control-gastos-auth') === 'true');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [data, setData] = useState(seedData);
  const [years, setYears] = useState([String(new Date().getFullYear())]);
  const [activeYear, setActiveYear] = useState(String(new Date().getFullYear()));
  const [syncStatus, setSyncStatus] = useState('Conectando con JSON...');
  const [selectedMonth, setSelectedMonth] = useState('Mayo');
  const [paymentForm, setPaymentForm] = useState(emptyPayment('Mayo'));
  const [incomeForm, setIncomeForm] = useState(emptyIncome('Mayo'));

  useEffect(() => {
    fetch('/auth-config.json')
      .then((response) => response.ok ? response.json() : authConfig)
      .then((config) => {
        setAuthConfig(config);
        if (!config.username && !config.password) {
          sessionStorage.setItem('control-gastos-auth', 'true');
          setIsAuthenticated(true);
        }
      })
      .catch(() => setAuthConfig(authConfig));
    fetchYears();
  }, []);

  useEffect(() => {
    fetchData(activeYear);
  }, [activeYear]);

  const monthlySummary = useMemo(() => data.months.map((month) => {
    const payments = sum(data.payments.filter((item) => item.month === month), (item) => item.amount);
    const income = sum(data.income.filter((item) => item.month === month), (item) => item.amount);
    return { month, payments, income, balance: income - payments };
  }), [data]);

  const debtRows = useMemo(() => data.debts.map(hydrateDebt), [data.debts]);
  const activeDebts = debtRows.filter((debt) => !debt.archived);
  const selectedSummary = monthlySummary.find((item) => item.month === selectedMonth) ?? monthlySummary[0];
  const totalDebtPayment = sum(activeDebts, (item) => item.monthlyPayment);
  const totalRemainingDebt = sum(activeDebts, (item) => item.remainingDebt);
  const fixedExpenseTotal = sum(data.fixedBudget.expenses, (item) => item.amount);
  const fixedIncomeTotal = sum(data.fixedBudget.income, (item) => item.amount);
  const incomeWithoutInterest = sum(data.fixedBudget.income.filter((item) => !item.description.toLowerCase().includes('interes')), (item) => item.amount);
  const budgetWithoutInterest = incomeWithoutInterest - fixedExpenseTotal;
  const budgetWithInterest = fixedIncomeTotal - fixedExpenseTotal;

  async function fetchYears() {
    try {
      const response = await fetch(`${apiBase}/years`);
      if (!response.ok) throw new Error('No se pudieron leer los años');
      const payload = await response.json();
      setYears(payload.years);
      setActiveYear(payload.currentYear);
    } catch (error) {
      setSyncStatus(`Usando año local: ${error.message}`);
    }
  }

  async function fetchData(year = activeYear) {
    try {
      const response = await fetch(`${apiBase}/data?year=${year}`);
      if (!response.ok) throw new Error('No se pudo leer el JSON');
      setData(await response.json());
      setSyncStatus(`Sincronizado con db/years/${year}.json`);
    } catch (error) {
      setSyncStatus(`Usando respaldo: ${error.message}`);
    }
  }

  async function saveData(nextData, message, detail = '') {
    const journaledData = withJournal(nextData, message, detail);
    const response = await fetch(`${apiBase}/data?year=${activeYear}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(journaledData),
    });
    const saved = await response.json();
    setData(saved);
    setSyncStatus(message);
  }

  async function resetData() {
    if (!window.confirm('Estas seguro de que quieres restaurar el JSON inicial? Se reemplazaran los datos actuales.')) return;
    const response = await fetch(`${apiBase}/reset?year=${activeYear}`, { method: 'POST' });
    setData(await response.json());
    setSyncStatus('JSON restaurado con datos iniciales');
  }

  async function createYear() {
    const year = window.prompt('Escribe el año que quieres crear', String(Number(activeYear) + 1));
    if (!year) return;
    if (!/^\d{4}$/.test(year)) {
      window.alert('Ingresa un año válido de 4 dígitos.');
      return;
    }
    const response = await fetch(`${apiBase}/years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year }),
    });
    const payload = await response.json();
    setYears(payload.years);
    setActiveYear(payload.currentYear);
    setSyncStatus(`Año ${payload.currentYear} creado`);
  }

  async function addPayment(event) {
    event.preventDefault();
    const nextData = { ...data, payments: [...data.payments, { ...paymentForm, amount: toNumber(paymentForm.amount) }] };
    await saveData(nextData, 'Pago guardado en JSON', paymentForm);
    setPaymentForm(emptyPayment(selectedMonth));
  }

  async function addIncome(event) {
    event.preventDefault();
    const nextData = { ...data, income: [...data.income, { ...incomeForm, amount: toNumber(incomeForm.amount) }] };
    await saveData(nextData, 'Ganancia guardada en JSON', incomeForm);
    setIncomeForm(emptyIncome(selectedMonth));
  }

  async function updateCollection(collection, updater, message, detail = '') {
    const nextData = { ...data, [collection]: updater(data[collection]) };
    await saveData(nextData, message, detail);
  }

  function login(event) {
    event.preventDefault();
    if (loginForm.username === authConfig.username && loginForm.password === authConfig.password) {
      sessionStorage.setItem('control-gastos-auth', 'true');
      setIsAuthenticated(true);
      setLoginError('');
      return;
    }
    setLoginError('Usuario o contrasena incorrectos');
  }

  function logout() {
    sessionStorage.removeItem('control-gastos-auth');
    setIsAuthenticated(false);
  }

  function startHelpTour() {
    driver({
      showProgress: true,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Listo',
      steps: [
        { element: '[data-tour="header"]', popover: { title: 'Centro de control', description: 'Aqui ves el estado de sincronizacion con el JSON y puedes restaurar la base inicial.' } },
        { element: '[data-tour="nav"]', popover: { title: 'Menu principal', description: 'Cambia entre Dashboard, movimientos, ahorros, deudas y presupuesto.' } },
        { element: '[data-tour="workspace"]', popover: { title: 'Area de trabajo', description: 'Cada seccion permite crear, editar o eliminar informacion. Los cambios se guardan automaticamente en JSON.' } },
        { element: '[data-tour="help"]', popover: { title: 'Ayuda guiada', description: 'Puedes volver a ejecutar este recorrido cuando necesites recordar el flujo.' } },
      ],
    }).drive();
  }

  if (!isAuthenticated) {
    return (
      <main className="login-shell">
        <form className="login-card" onSubmit={login}>
          <p className="eyebrow">Acceso privado</p>
          <h1>Control de gastos</h1>
          <p>Ingresa tus credenciales para abrir la aplicacion financiera.</p>
          <input placeholder="Usuario" value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} required autoFocus />
          <input type="password" placeholder="Contrasena" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} required />
          {loginError && <strong className="login-error">{loginError}</strong>}
          <button className="ghost-button" type="submit">Entrar</button>
          <small>Credenciales configurables en <code>public/auth-config.json</code>.</small>
        </form>
      </main>
    );
  }

  return (
    <main className="finance-shell">
      <header className="command-center" data-tour="header">
        <span className="sync-badge">{syncStatus}</span>
        <div>
          <p className="eyebrow">Libro financiero 2026</p>
          <h1>Control de gastos</h1>
          <p>Panel operativo conectado a JSON para pagos, ingresos, ahorros, cuotas y presupuesto.</p>
        </div>
        <div className="command-actions">
          <div className="year-controls">
            <select value={activeYear} onChange={(event) => setActiveYear(event.target.value)}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <button className="ghost-button secondary" onClick={createYear}>Nuevo año</button>
          </div>
          <button className="ghost-button secondary" data-tour="help" onClick={startHelpTour}>Ayuda</button>
          <button className="ghost-button" onClick={resetData}>Restaurar JSON inicial</button>
        </div>
      </header>
      <button className="logout-sticky" onClick={logout}>Salir</button>

      <nav className="app-nav" aria-label="Secciones" data-tour="nav">
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            <strong>{tab}</strong>
            <span>{tabMeta[tab]}</span>
          </button>
        ))}
      </nav>

      <section className="workspace" data-tour="workspace">
        {activeTab === 'Dashboard' && (
          <Dashboard monthlySummary={monthlySummary} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} selectedSummary={selectedSummary} debts={activeDebts} totalDebtPayment={totalDebtPayment} totalRemainingDebt={totalRemainingDebt} />
        )}
        {activeTab === 'Movimientos' && (
          <Movements data={data} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} paymentForm={paymentForm} setPaymentForm={setPaymentForm} incomeForm={incomeForm} setIncomeForm={setIncomeForm} addPayment={addPayment} addIncome={addIncome} updateCollection={updateCollection} />
        )}
        {activeTab === 'Ahorros' && <Savings data={data} saveData={saveData} />}
        {activeTab === 'Deudas' && <Debts data={data} debts={debtRows} saveData={saveData} />}
        {activeTab === 'Gastos vs Sueldo' && <Budget data={data} saveData={saveData} budgetWithoutInterest={budgetWithoutInterest} budgetWithInterest={budgetWithInterest} />}
      </section>
    </main>
  );
}

function hydrateDebt(debt) {
  const totalInstallments = toNumber(debt.totalInstallments);
  const currentInstallment = Math.min(toNumber(debt.currentInstallment), totalInstallments);
  const remainingMonths = Math.max(totalInstallments - currentInstallment, 0);
  return { ...debt, totalInstallments, currentInstallment, remainingMonths, remainingDebt: remainingMonths * toNumber(debt.monthlyPayment), archived: Boolean(debt.archived) };
}

function Dashboard({ monthlySummary, selectedMonth, setSelectedMonth, selectedSummary, debts, totalDebtPayment, totalRemainingDebt }) {
  const maxValue = Math.max(...monthlySummary.map((item) => Math.max(item.payments, item.income)), 1);
  return (
    <section className="grid-layout dashboard-grid">
      <article className="ledger-card span-2 featured-card">
        <div className="section-title">
          <div><p className="overline">Resumen anual</p><h2>Dashboard mensual</h2></div>
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>{monthlySummary.map((item) => <option key={item.month}>{item.month}</option>)}</select>
        </div>
        <div className="kpi-grid">
          <Kpi title="Pagos" value={money.format(selectedSummary.payments)} tone="danger" />
          <Kpi title="Ganancias" value={money.format(selectedSummary.income)} tone="success" />
          <Kpi title="Total" value={money.format(selectedSummary.balance)} tone={selectedSummary.balance >= 0 ? 'success' : 'danger'} />
        </div>
        <div className="bar-chart">
          {monthlySummary.map((row) => (
            <div className="bar-row" key={row.month}>
              <span>{row.month.slice(0, 3)}</span>
              <div className="bars"><i className="payment" style={{ width: `${(row.payments / maxValue) * 100}%` }} /><i className="income" style={{ width: `${(row.income / maxValue) * 100}%` }} /></div>
              <strong>{money.format(row.balance)}</strong>
            </div>
          ))}
        </div>
      </article>
      <article className="ledger-card debt-brief"><p className="overline">Compromisos</p><h2>Resumen de deudas</h2><Kpi title="Cuotas mensuales" value={money.format(totalDebtPayment)} /><Kpi title="Deuda restante" value={money.format(totalRemainingDebt)} tone="danger" /></article>
      <article className="ledger-card span-2"><h2>Cuotas pendientes</h2><Table columns={['Descripcion', 'Valor mensual', 'Cuotas faltantes', 'Deuda restante']} rows={debts.map((debt) => [debt.loan, money.format(debt.monthlyPayment), debt.remainingMonths, money.format(debt.remainingDebt)])} /></article>
    </section>
  );
}

function Movements({ data, selectedMonth, setSelectedMonth, paymentForm, setPaymentForm, incomeForm, setIncomeForm, addPayment, addIncome, updateCollection }) {
  const paymentConcepts = [...new Set(data.payments.map((item) => item.concept).filter(Boolean))];
  const incomeConcepts = [...new Set(data.income.map((item) => item.concept).filter(Boolean))];
  const payments = data.payments.map((row, index) => ({ ...row, index })).filter((item) => item.month === selectedMonth);
  const income = data.income.map((row, index) => ({ ...row, index })).filter((item) => item.month === selectedMonth);

  function updateMonth(month) {
    setSelectedMonth(month);
    setPaymentForm((current) => ({ ...current, month }));
    setIncomeForm((current) => ({ ...current, month }));
  }

  async function editMovement(collection, row) {
    const amount = window.prompt('Monto', row.amount);
    if (amount === null) return;
    const concept = window.prompt('Concepto', row.concept ?? '');
    if (concept === null) return;
    await updateCollection(collection, (items) => items.map((item, index) => index === row.index ? { ...item, amount: toNumber(amount), concept } : item), 'Movimiento editado en JSON');
  }

  return (
    <section className="stack">
      <div className="section-title"><h2>Tabla de flujo de caja</h2><select value={selectedMonth} onChange={(event) => updateMonth(event.target.value)}>{data.months.map((month) => <option key={month}>{month}</option>)}</select></div>
      <div className="stack">
        <MovementPanel title="Pagos recurrentes" form={paymentForm} setForm={setPaymentForm} onSubmit={addPayment} type="payment" concepts={paymentConcepts} />
        <MovementPanel title="Ganancias" form={incomeForm} setForm={setIncomeForm} onSubmit={addIncome} type="income" concepts={incomeConcepts} />
      </div>
      <div className="stack">
        <article className="ledger-card form-card"><h3>Pagos de {selectedMonth}</h3><DataTable rows={payments} collection="payments" updateCollection={updateCollection} editMovement={editMovement} type="payment" /></article>
        <article className="ledger-card form-card"><h3>Ganancias de {selectedMonth}</h3><DataTable rows={income} collection="income" updateCollection={updateCollection} editMovement={editMovement} type="income" /></article>
      </div>
    </section>
  );
}

function MovementPanel({ title, form, setForm, onSubmit, type, concepts }) {
  const sourceLabel = type === 'payment' ? 'Categoria' : 'Origen';
  const sourceKey = type === 'payment' ? 'category' : 'source';
  const statusLabel = type === 'payment' ? 'Estado' : 'Tipo';
  const statusKey = type === 'payment' ? 'status' : 'type';
  const listId = `${type}-concepts`;
  return (
    <article className="ledger-card form-card">
      <h3>{title}</h3>
      <form className="movement-form" onSubmit={onSubmit}>
        <input type="date" value={form.date || today()} onClick={openDatePicker} onFocus={openDatePicker} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
        <input placeholder={sourceLabel} value={form[sourceKey]} onChange={(event) => setForm({ ...form, [sourceKey]: event.target.value })} required />
        <input placeholder="Concepto" list={listId} value={form.concept} onChange={(event) => setForm({ ...form, concept: event.target.value })} required />
        <datalist id={listId}>{concepts.map((concept) => <option key={concept} value={concept} />)}</datalist>
        {type === 'payment' ? (
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} required>
            <option value="Pendiente">Pendiente</option>
            <option value="Pagado">Pagado</option>
          </select>
        ) : (
          <input placeholder={statusLabel} value={form[statusKey]} onChange={(event) => setForm({ ...form, [statusKey]: event.target.value })} required />
        )}
        <input type="number" step="0.01" min="0" placeholder="Monto" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
        <button type="submit">Agregar</button>
      </form>
    </article>
  );
}

function DataTable({ rows, collection, updateCollection, editMovement, type }) {
  return (
    <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>{type === 'payment' ? 'Categoria' : 'Origen'}</th><th>Concepto</th><th>{type === 'payment' ? 'Estado' : 'Tipo'}</th><th>Monto</th><th>Acciones</th></tr></thead><tbody>
      {rows.map((row) => <tr key={`${collection}-${row.index}`}><td>{row.date || '-'}</td><td>{type === 'payment' ? row.category : row.source}</td><td>{row.concept}</td><td>{type === 'payment' ? row.status : row.type}</td><td>{money.format(toNumber(row.amount))}</td><td className="actions"><button className="link-button" onClick={() => editMovement(collection, row)}>Editar</button><button className="link-button" onClick={() => updateCollection(collection, (items) => items.filter((_, index) => index !== row.index), 'Movimiento eliminado del JSON')}>Eliminar</button></td></tr>)}
    </tbody></table></div>
  );
}

function Savings({ data, saveData }) {
  function saveSavings(savings, message) {
    return saveData({ ...data, savings }, message);
  }
  function createAccount() {
    const name = window.prompt('Nombre de la nueva cuenta de ahorro');
    if (!name) return;
    saveSavings([...data.savings, { name, rows: [] }], 'Cuenta de ahorro creada');
  }
  return (
    <section className="stack">
      <div className="section-title"><h2>Ahorros</h2><button className="ghost-button" onClick={createAccount}>Crear cuenta</button></div>
      <div className="stack">{data.savings.map((account, index) => <SavingsAccount key={`${account.name}-${index}`} account={account} index={index} data={data} saveSavings={saveSavings} />)}</div>
    </section>
  );
}

function SavingsAccount({ account, index, data, saveSavings }) {
  const lastRow = account.rows.at(-1);
  const lastFinal = lastRow ? finalSaving(lastRow) : 0;
  const [form, setForm] = useState({ month: 'Mayo', initial: lastFinal, deposit: '', interest: '' });
  const rows = account.rows.map((row, rowIndex) => {
    const final = finalSaving(row);
    const base = toNumber(row.initial) + toNumber(row.deposit);
    const efficiency = base > 0 ? ((1 + toNumber(row.interest) / base) ** 12 - 1) * 100 : 0;
    return { row, rowIndex, display: [row.month, money.format(row.initial), money.format(row.deposit), money.format(row.interest), money.format(final), `${efficiency.toFixed(2)}%`] };
  });

  function updateAccount(nextAccount, message) {
    saveSavings(data.savings.map((item, itemIndex) => itemIndex === index ? nextAccount : item), message);
  }
  function addRow(event) {
    event.preventDefault();
    const nextRow = { month: form.month, initial: lastFinal, deposit: form.deposit === '' ? null : toNumber(form.deposit), interest: toNumber(form.interest) };
    updateAccount({ ...account, rows: [...account.rows, nextRow] }, 'Ahorro agregado al JSON');
    setForm({ month: form.month, initial: finalSaving(nextRow), deposit: '', interest: '' });
  }
  function renameAccount() {
    const name = window.prompt('Nuevo nombre', account.name);
    if (name) updateAccount({ ...account, name }, 'Cuenta de ahorro editada');
  }
  function deleteAccount() {
    if (window.confirm(`Eliminar la cuenta ${account.name}?`)) saveSavings(data.savings.filter((_, itemIndex) => itemIndex !== index), 'Cuenta de ahorro eliminada');
  }
  function editRow(rowIndex) {
    const current = account.rows[rowIndex];
    const interest = window.prompt('Interes ganado', current.interest ?? 0);
    if (interest === null) return;
    const deposit = window.prompt('Aporte nuevo', current.deposit ?? '');
    if (deposit === null) return;
    updateAccount({ ...account, rows: account.rows.map((row, itemIndex) => itemIndex === rowIndex ? { ...row, interest: toNumber(interest), deposit: deposit === '' ? null : toNumber(deposit) } : row) }, 'Ahorro editado en JSON');
  }
  return (
    <article className="ledger-card savings-card">
      <div className="section-title"><h2>{account.name}</h2><div className="actions"><button className="link-button" onClick={renameAccount}>Editar cuenta</button><button className="link-button" onClick={deleteAccount}>Eliminar cuenta</button></div></div>
      <Table columns={['Mes', 'Saldo inicial', 'Aporte', 'Interes', 'Saldo final', 'Eficiencia', 'Acciones']} rows={rows.map(({ display, rowIndex }) => [...display, <span className="actions"><button className="link-button" onClick={() => editRow(rowIndex)}>Editar</button><button className="link-button" onClick={() => updateAccount({ ...account, rows: account.rows.filter((_, itemIndex) => itemIndex !== rowIndex) }, 'Ahorro eliminado del JSON')}>Eliminar</button></span>])} />
      <p className="total-line">Ultimo saldo final: <strong>{money.format(lastFinal)}</strong></p>
      <form className="movement-form compact-form" onSubmit={addRow}>
        <input value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} placeholder="Mes" required />
        <input value={money.format(lastFinal)} disabled />
        <input type="number" step="0.01" min="0" value={form.deposit} onChange={(event) => setForm({ ...form, deposit: event.target.value })} placeholder="Aporte nuevo opcional" />
        <input type="number" step="0.01" min="0" value={form.interest} onChange={(event) => setForm({ ...form, interest: event.target.value })} placeholder="Interes ganado" required />
        <button type="submit">Agregar ahorro</button>
      </form>
    </article>
  );
}

function Debts({ data, debts, saveData }) {
  const [form, setForm] = useState(emptyDebt());
  const activeDebts = debts.map((debt, index) => ({ ...debt, index })).filter((debt) => !debt.archived);
  function saveDebts(debtsNext, message) { return saveData({ ...data, debts: debtsNext }, message); }
  function addDebt(event) {
    event.preventDefault();
    saveDebts([...data.debts, { ...form, total: toNumber(form.total), monthlyPayment: toNumber(form.monthlyPayment), totalInstallments: toNumber(form.totalInstallments), currentInstallment: toNumber(form.currentInstallment), monthValue: form.monthValue === '' ? null : toNumber(form.monthValue), archived: false }], 'Deuda creada en JSON');
    setForm(emptyDebt());
  }
  function updateDebt(index, patch, message) {
    saveDebts(data.debts.map((debt, itemIndex) => itemIndex === index ? { ...debt, ...patch } : debt), message);
  }
  function editDebt(debt) {
    const monthlyPayment = window.prompt('Cuota mensual', debt.monthlyPayment);
    if (monthlyPayment === null) return;
    const totalInstallments = window.prompt('Cuotas totales', debt.totalInstallments);
    if (totalInstallments === null) return;
    updateDebt(debt.index, { monthlyPayment: toNumber(monthlyPayment), totalInstallments: toNumber(totalInstallments) }, 'Deuda editada en JSON');
  }
  return (
    <section className="stack">
      <article className="ledger-card form-card"><h2>Nueva deuda o cuota</h2><form className="movement-form" onSubmit={addDebt}>{['loan:Prestamo', 'description:Descripcion', 'total:Monto total', 'monthlyPayment:Cuota mensual', 'totalInstallments:Cuotas totales', 'currentInstallment:Cuotas pagadas'].map((field) => { const [key, label] = field.split(':'); return <input key={key} type={['total', 'monthlyPayment', 'totalInstallments', 'currentInstallment'].includes(key) ? 'number' : 'text'} step="0.01" min="0" placeholder={label} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required />; })}<input placeholder="Con o sin interes" value={form.interest} onChange={(event) => setForm({ ...form, interest: event.target.value })} required /><input type="number" step="0.01" min="0" placeholder="Valor del mes opcional" value={form.monthValue} onChange={(event) => setForm({ ...form, monthValue: event.target.value })} /><button type="submit">Agregar deuda</button></form></article>
      <article className="ledger-card"><div className="section-title"><h2>Tabla de prestamos o deudas</h2><div className="summary-pills"><span>Activas: {activeDebts.length}</span><span>Restante: {money.format(sum(activeDebts, (debt) => debt.remainingDebt))}</span></div></div><div className="table-wrap"><table><thead><tr><th>Prestamo</th><th>Descripcion</th><th>Cuota</th><th>Pagadas</th><th>Faltantes</th><th>Deuda restante</th><th>Acciones</th></tr></thead><tbody>{activeDebts.map((debt) => <tr key={debt.index}><td>{debt.loan}</td><td>{debt.description}</td><td>{money.format(debt.monthlyPayment)}</td><td><input className="mini-input" type="number" min="0" max={debt.totalInstallments} value={debt.currentInstallment} onChange={(event) => updateDebt(debt.index, { currentInstallment: toNumber(event.target.value) }, 'Cuota pagada actualizada')} /></td><td>{debt.remainingMonths}</td><td>{money.format(debt.remainingDebt)}</td><td className="actions"><button className="link-button" onClick={() => editDebt(debt)}>Editar</button><button className="link-button" onClick={() => updateDebt(debt.index, { archived: true }, 'Deuda archivada')}>Archivar</button><button className="link-button" onClick={() => saveDebts(data.debts.filter((_, itemIndex) => itemIndex !== debt.index), 'Deuda eliminada del JSON')}>Eliminar</button></td></tr>)}</tbody></table></div></article>
    </section>
  );
}

function Budget({ data, saveData, budgetWithoutInterest, budgetWithInterest }) {
  function saveBudget(fixedBudget, message) { return saveData({ ...data, fixedBudget }, message); }
  return (
    <section className="stack">
      <EditableBudgetList title="Gastos fijos" items={data.fixedBudget.expenses} onSave={(items) => saveBudget({ ...data.fixedBudget, expenses: items }, 'Gastos fijos actualizados')} />
      <EditableBudgetList title="Ganancias fijas" items={data.fixedBudget.income} onSave={(items) => saveBudget({ ...data.fixedBudget, income: items }, 'Ganancias fijas actualizadas')} />
      <article className="ledger-card featured-card"><div className="kpi-grid"><Kpi title="Total con interes" value={money.format(budgetWithInterest)} /><Kpi title="Total sin interes" value={money.format(budgetWithoutInterest)} /></div><h2>Distribucion sugerida</h2><Table columns={['Descripcion', 'Valor', 'Destino']} rows={data.fixedBudget.distribution.map((item) => [item.description, money.format(budgetWithoutInterest * item.percent), item.destination])} /></article>
    </section>
  );
}

function EditableBudgetList({ title, items, onSave }) {
  const [form, setForm] = useState({ description: '', amount: '' });
  function addItem(event) {
    event.preventDefault();
    onSave([...items, { description: form.description, amount: toNumber(form.amount) }]);
    setForm({ description: '', amount: '' });
  }
  function editItem(index) {
    const description = window.prompt('Descripcion', items[index].description);
    if (description === null) return;
    const amount = window.prompt('Valor', items[index].amount);
    if (amount === null) return;
    onSave(items.map((item, itemIndex) => itemIndex === index ? { description, amount: toNumber(amount) } : item));
  }
  return <article className="ledger-card"><h2>{title}</h2><form className="movement-form compact-form" onSubmit={addItem}><input placeholder="Descripcion" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /><input type="number" step="0.01" min="0" placeholder="Valor" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /><button type="submit">Agregar</button></form><Table columns={['Descripcion', 'Valor', 'Acciones']} rows={items.map((item, index) => [item.description, money.format(item.amount), <span className="actions"><button className="link-button" onClick={() => editItem(index)}>Editar</button><button className="link-button" onClick={() => onSave(items.filter((_, itemIndex) => itemIndex !== index))}>Eliminar</button></span>])} /></article>;
}

function Kpi({ title, value, tone = 'neutral' }) {
  return <div className={`kpi ${tone}`}><span>{title}</span><strong>{value}</strong></div>;
}

function Table({ columns, rows }) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export default App;
