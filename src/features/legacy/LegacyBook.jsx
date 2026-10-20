import { useState } from 'react';
import { Budget } from '../budget/Budget';
import { Dashboard } from '../dashboard/Dashboard';
import { Debts } from '../debts/Debts';
import { AppNav } from '../layout/AppNav';
import { CommandCenter } from '../layout/CommandCenter';
import { Movements } from '../movements/Movements';
import { Savings } from '../savings/Savings';
import { useFinanceBook } from '../../hooks/useFinanceBook';
import { LoadingOverlay } from '../../shared/ui/LoadingOverlay';

// La app anterior (libro por año), conservada tal cual para consultar el histórico 2026,
// el presupuesto fijo y las deudas hasta que las fases 2–4 los reemplacen.
export function LegacyBook({ user }) {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [processingCount, setProcessingCount] = useState(0);

  function startProcessing() {
    setProcessingCount((count) => count + 1);
    return () => setProcessingCount((count) => Math.max(count - 1, 0));
  }

  const finance = useFinanceBook(user, startProcessing);

  return (
    <div className="legacy">
      <main className="finance-shell">
        <CommandCenter
          activeYear={finance.activeYear}
          createYear={finance.createYear}
          exportExcel={finance.exportExcel}
          resetData={finance.resetData}
          setActiveYear={finance.setActiveYear}
          syncStatus={finance.syncStatus}
          years={finance.years}
        />

        <AppNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <section className="workspace" data-tour="workspace">
          {activeTab === 'Dashboard' && (
            <Dashboard
              monthlySummary={finance.monthlySummary}
              selectedMonth={finance.selectedMonth}
              setSelectedMonth={finance.setSelectedMonth}
              selectedSummary={finance.selectedSummary}
              savingsGrowthSummary={finance.savingsGrowthSummary}
              debts={finance.activeDebts}
              totalDebtPayment={finance.totalDebtPayment}
              totalRemainingDebt={finance.totalRemainingDebt}
            />
          )}
          {activeTab === 'Movimientos' && (
            <Movements
              activeYear={finance.activeYear}
              data={finance.data}
              selectedMonth={finance.selectedMonth}
              setSelectedMonth={finance.setSelectedMonth}
              paymentForm={finance.paymentForm}
              setPaymentForm={finance.setPaymentForm}
              incomeForm={finance.incomeForm}
              setIncomeForm={finance.setIncomeForm}
              addPayment={finance.addPayment}
              addIncome={finance.addIncome}
              updateCollection={finance.updateCollection}
            />
          )}
          {activeTab === 'Ahorros' && <Savings data={finance.data} saveData={finance.saveData} />}
          {activeTab === 'Deudas' && <Debts data={finance.data} debts={finance.debtRows} saveData={finance.saveData} />}
          {activeTab === 'Gastos vs Sueldo' && (
            <Budget
              data={finance.data}
              distributionWithInterest={finance.distributionWithInterest}
              distributionWithoutInterest={finance.distributionWithoutInterest}
              saveData={finance.saveData}
              budgetWithoutInterest={finance.budgetWithoutInterest}
              budgetWithInterest={finance.budgetWithInterest}
            />
          )}
        </section>
      </main>
      {processingCount > 0 && <LoadingOverlay />}
    </div>
  );
}
