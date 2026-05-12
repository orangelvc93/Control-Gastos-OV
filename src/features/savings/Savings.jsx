import { SavingsAccount } from './SavingsAccount';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { SectionTitle } from '../../shared/ui/SectionTitle';

export function Savings({ data, saveData }) {
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
      <SectionTitle actions={<Button onClick={createAccount}>Crear cuenta</Button>}>
        <h2>Ahorros</h2>
      </SectionTitle>
      {data.savings.length ? (
        <div className="stack">
          {data.savings.map((account, index) => (
            <SavingsAccount key={`${account.name}-${index}`} account={account} index={index} data={data} saveSavings={saveSavings} />
          ))}
        </div>
      ) : (
        <EmptyState title="No tienes cuentas de ahorro creadas todavia.">
          Crea una cuenta para empezar a registrar tus aportes e intereses.
        </EmptyState>
      )}
    </section>
  );
}
