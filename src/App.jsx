import { useState } from 'react';
import { LoginPage } from './features/auth/LoginPage';
import { Budget } from './features/budget/Budget';
import { Dashboard } from './features/dashboard/Dashboard';
import { Debts } from './features/debts/Debts';
import { AppNav } from './features/layout/AppNav';
import { CommandCenter } from './features/layout/CommandCenter';
import { Movements } from './features/movements/Movements';
import { Savings } from './features/savings/Savings';
import { useAuth } from './hooks/useAuth';
import { useFinanceBook } from './hooks/useFinanceBook';
import { LoadingOverlay } from './shared/ui/LoadingOverlay';

function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [processingCount, setProcessingCount] = useState(0);

  function startProcessing() {
    setProcessingCount((count) => count + 1);
    return () => setProcessingCount((count) => Math.max(count - 1, 0));
  }

  const { user, setUser, isAuthenticated, setIsAuthenticated, logout } = useAuth(startProcessing);
  const finance = useFinanceBook(user, startProcessing);
  const isProcessing = processingCount > 0;

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage setUser={setUser} setIsAuthenticated={setIsAuthenticated} startProcessing={startProcessing} />
        {isProcessing && <LoadingOverlay />}
      </>
    );
  }

  return (
    <>
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
        <button className="logout-sticky" onClick={logout}>Salir</button>

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
      {isProcessing && <LoadingOverlay />}
    </>
  );
}

export default App;
