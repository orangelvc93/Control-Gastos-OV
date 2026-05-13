import { useState } from 'react';
import { EditableBudgetList } from './EditableBudgetList';
import { normalizeDistribution, withBudgetRecurring } from '../../shared/lib/finance';
import { money } from '../../shared/lib/money';
import { LinkButton } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EditModal } from '../../shared/ui/EditModal';
import { Kpi } from '../../shared/ui/Kpi';
import { Table } from '../../shared/ui/Table';

function DistributionTable({ items, onEdit, title }) {
  const hasAvailableBalance = items.some((item) => item.value > 0);

  return (
    <Card className="featured-card">
      <h2>{title}</h2>
      {!hasAvailableBalance && <p className="notice-line">No hay restante disponible para distribuir.</p>}
      <Table
        columns={['Categoria', 'Porcentaje', 'Valor', 'Destino / descripcion', 'Acciones']}
        rows={items.map((item) => [
          item.description,
          `${(item.percent * 100).toFixed(0)}%`,
          { content: money.format(item.value), filterValue: item.value },
          item.destination || '-',
          {
            content: <LinkButton onClick={() => onEdit(item)}>Editar</LinkButton>,
            filterValue: '',
          },
        ])}
      />
    </Card>
  );
}

export function Budget({ budgetWithInterest, budgetWithoutInterest, data, distributionWithInterest, distributionWithoutInterest, saveData }) {
  const [editingDistribution, setEditingDistribution] = useState(null);

  function saveBudget(fixedBudget, message) {
    return saveData(withBudgetRecurring(data, fixedBudget), message);
  }

  function saveDistribution(values) {
    const distribution = normalizeDistribution(data.fixedBudget.distribution).map((item) => (
      item.description === editingDistribution.description ? { ...item, destination: values.destination } : item
    ));

    saveBudget({ ...data.fixedBudget, distribution }, 'Distribucion actualizada');
    setEditingDistribution(null);
  }

  return (
    <section className="stack">
      <EditableBudgetList
        title="Gastos fijos"
        items={data.fixedBudget.expenses}
        onSave={(items) => saveBudget({ ...data.fixedBudget, expenses: items }, 'Gastos fijos actualizados')}
      />
      <EditableBudgetList
        title="Ganancias fijas"
        allowInterest
        items={data.fixedBudget.income}
        onSave={(items) => saveBudget({ ...data.fixedBudget, income: items }, 'Ganancias fijas actualizadas')}
      />
      <Card className="featured-card">
        <div className="kpi-grid">
          <Kpi title="Total con interes" value={money.format(budgetWithInterest)} />
          <Kpi title="Total sin interes" value={money.format(budgetWithoutInterest)} />
        </div>
      </Card>
      <DistributionTable title="Distribucion informativa con interes" items={distributionWithInterest} onEdit={setEditingDistribution} />
      <DistributionTable title="Distribucion real sin interes" items={distributionWithoutInterest} onEdit={setEditingDistribution} />
      {editingDistribution && (
        <EditModal
          title={`Editar destino de ${editingDistribution.description}`}
          initialValues={{ destination: editingDistribution.destination ?? '' }}
          fields={[{ name: 'destination', label: 'Destino / descripcion', type: 'text' }]}
          onClose={() => setEditingDistribution(null)}
          onSave={saveDistribution}
        />
      )}
    </section>
  );
}
