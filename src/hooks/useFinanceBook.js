import { useEffect, useMemo, useState } from 'react';
import seedData from '../data.json';
import { supabase } from '../api/supabaseClient';
import { createYearForUser, fetchYearsForUser, loadYearData, resetYearData, saveYearData } from '../api/yearDataApi';
import { exportFinanceBook } from '../shared/lib/exportExcel';
import { buildDateFromParts, getDateDay } from '../shared/lib/date';
import { buildDistributionRows, emptyIncome, emptyPayment, hydrateDebt, withJournal } from '../shared/lib/finance';
import { sum, toNumber } from '../shared/lib/numbers';

export function useFinanceBook(user, startProcessing = () => () => {}) {
  const [data, setData] = useState(seedData);
  const [years, setYears] = useState([String(new Date().getFullYear())]);
  const [activeYear, setActiveYear] = useState(String(new Date().getFullYear()));
  const [syncStatus, setSyncStatus] = useState('Conectando con Supabase...');
  const [selectedMonth, setSelectedMonth] = useState('Mayo');
  const [paymentForm, setPaymentForm] = useState(emptyPayment('Mayo'));
  const [incomeForm, setIncomeForm] = useState(emptyIncome('Mayo'));

  useEffect(() => {
    if (!user) return;
    fetchYears(user.id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData(activeYear, user.id);
  }, [activeYear, user]);

  const monthlySummary = useMemo(() => data.months.map((month) => {
    const payments = sum(data.payments.filter((item) => item.month === month && item.status === 'Pagado'), (item) => item.amount);
    const income = sum(data.income.filter((item) => item.month === month && item.status === 'Pagado'), (item) => item.amount);
    return { month, payments, income, balance: income - payments };
  }), [data]);

  const debtRows = useMemo(() => data.debts.map(hydrateDebt), [data.debts]);
  const activeDebts = debtRows.filter((debt) => !debt.archived);
  const selectedSummary = monthlySummary.find((item) => item.month === selectedMonth) ?? monthlySummary[0];
  const totalDebtPayment = sum(activeDebts, (item) => item.monthlyPayment);
  const totalRemainingDebt = sum(activeDebts, (item) => item.remainingDebt);
  const fixedExpenseTotal = sum(data.fixedBudget.expenses, (item) => item.amount);
  const fixedIncomeTotal = sum(data.fixedBudget.income, (item) => item.amount);
  const incomeWithoutInterest = sum(
    data.fixedBudget.income.filter((item) => !item.description.toLowerCase().includes('interes')),
    (item) => item.amount,
  );
  const budgetWithoutInterest = incomeWithoutInterest - fixedExpenseTotal;
  const budgetWithInterest = fixedIncomeTotal - fixedExpenseTotal;
  const distributionWithInterest = useMemo(
    () => buildDistributionRows(budgetWithInterest, data.fixedBudget.distribution),
    [budgetWithInterest, data.fixedBudget.distribution],
  );
  const distributionWithoutInterest = useMemo(
    () => buildDistributionRows(budgetWithoutInterest, data.fixedBudget.distribution),
    [budgetWithoutInterest, data.fixedBudget.distribution],
  );

  async function runProcess(task) {
    const stopProcessing = startProcessing();
    try {
      return await task();
    } finally {
      stopProcessing();
    }
  }

  async function fetchYears(userId = user?.id) {
    if (!userId) return;
    return runProcess(async () => {
      try {
        const cloudYears = await fetchYearsForUser(supabase, userId);
        setYears(cloudYears);
        if (!cloudYears.includes(activeYear)) setActiveYear(cloudYears.at(-1));
      } catch (error) {
        setSyncStatus(`No se pudieron leer los anos: ${error.message}`);
      }
    });
  }

  async function fetchData(year = activeYear, userId = user?.id) {
    if (!userId) return;
    return runProcess(async () => {
      try {
        setData(await loadYearData(supabase, userId, year));
        setSyncStatus(`Sincronizado con Supabase: ${year}`);
      } catch (error) {
        setSyncStatus(`No se pudieron leer los datos: ${error.message}`);
      }
    });
  }

  async function saveData(nextData, message, detail = '') {
    if (!user) return;
    return runProcess(async () => {
      const journaledData = withJournal(nextData, message, detail);
      try {
        await saveYearData(supabase, user.id, activeYear, journaledData);
        setData(await loadYearData(supabase, user.id, activeYear));
        setSyncStatus(message);
      } catch (error) {
        setSyncStatus(`No se pudo guardar: ${error.message}`);
      }
    });
  }

  async function resetData() {
    if (!user) return;
    if (!window.confirm('Estas seguro de que quieres restaurar los datos iniciales? Se reemplazaran los datos actuales.')) return;
    return runProcess(async () => {
      try {
        setData(await resetYearData(supabase, user.id, activeYear));
        setSyncStatus('Datos iniciales restaurados en Supabase');
      } catch (error) {
        setSyncStatus(`No se pudo restaurar: ${error.message}`);
      }
    });
  }

  async function createYear() {
    const year = window.prompt('Escribe el ano que quieres crear', String(Number(activeYear) + 1));
    if (!year) return;
    if (!/^\d{4}$/.test(year)) {
      window.alert('Ingresa un ano valido de 4 digitos.');
      return;
    }
    if (!user) return;
    return runProcess(async () => {
      try {
        await createYearForUser(supabase, user.id, year);
        const nextYears = await fetchYearsForUser(supabase, user.id);
        setYears(nextYears);
        setActiveYear(year);
        setSyncStatus(`Ano ${year} creado`);
      } catch (error) {
        setSyncStatus(`No se pudo crear el ano: ${error.message}`);
      }
    });
  }

  async function addPayment(event) {
    event.preventDefault();
    const nextPayment = {
      ...paymentForm,
      date: buildDateFromParts(activeYear, paymentForm.month, getDateDay(paymentForm.date)),
      amount: toNumber(paymentForm.amount),
    };
    const nextData = { ...data, payments: [...data.payments, nextPayment] };
    await saveData(nextData, 'Pago guardado en Supabase', paymentForm);
    setPaymentForm(emptyPayment(selectedMonth));
  }

  async function addIncome(event) {
    event.preventDefault();
    const nextIncome = {
      ...incomeForm,
      date: buildDateFromParts(activeYear, incomeForm.month, getDateDay(incomeForm.date)),
      amount: toNumber(incomeForm.amount),
    };
    const nextData = { ...data, income: [...data.income, nextIncome] };
    await saveData(nextData, 'Ganancia guardada en Supabase', incomeForm);
    setIncomeForm(emptyIncome(selectedMonth));
  }

  async function updateCollection(collection, updater, message, detail = '') {
    const nextData = { ...data, [collection]: updater(data[collection]) };
    await saveData(nextData, message, detail);
  }

  function exportExcel() {
    const stopProcessing = startProcessing();
    window.setTimeout(() => {
      try {
        exportFinanceBook({ activeYear, data, debtRows, distributionWithInterest, distributionWithoutInterest, monthlySummary });
      } finally {
        stopProcessing();
      }
    }, 0);
  }

  return {
    activeDebts,
    activeYear,
    addIncome,
    addPayment,
    budgetWithInterest,
    budgetWithoutInterest,
    createYear,
    data,
    debtRows,
    distributionWithInterest,
    distributionWithoutInterest,
    exportExcel,
    incomeForm,
    monthlySummary,
    paymentForm,
    resetData,
    saveData,
    selectedMonth,
    selectedSummary,
    setActiveYear,
    setIncomeForm,
    setPaymentForm,
    setSelectedMonth,
    syncStatus,
    totalDebtPayment,
    totalRemainingDebt,
    updateCollection,
    years,
  };
}
