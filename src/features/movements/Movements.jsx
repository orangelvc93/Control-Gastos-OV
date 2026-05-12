import { useState } from 'react';
import { MovementPanel } from './MovementPanel';
import { MovementsTable } from './MovementsTable';
import { buildDateFromParts, daysInMonth, getDateDay } from '../../shared/lib/date';
import { toNumber } from '../../shared/lib/numbers';
import { Card } from '../../shared/ui/Card';
import { EditModal } from '../../shared/ui/EditModal';
import { Select } from '../../shared/ui/FormControls';
import { SectionTitle } from '../../shared/ui/SectionTitle';

export function Movements({
  addIncome,
  addPayment,
  activeYear,
  data,
  incomeForm,
  paymentForm,
  selectedMonth,
  setIncomeForm,
  setPaymentForm,
  setSelectedMonth,
  updateCollection,
}) {
  const [editingMovement, setEditingMovement] = useState(null);
  const paymentConcepts = [...new Set(data.payments.map((item) => item.concept).filter(Boolean))];
  const paymentCategories = [...new Set(data.payments.map((item) => item.category).filter(Boolean))];
  const incomeConcepts = [...new Set(data.income.map((item) => item.concept).filter(Boolean))];
  const incomeSources = [...new Set(data.income.map((item) => item.source).filter(Boolean))];
  const payments = data.payments.map((row, index) => ({ ...row, index })).filter((item) => item.month === selectedMonth);
  const income = data.income.map((row, index) => ({ ...row, index })).filter((item) => item.month === selectedMonth);

  function updateMonth(month) {
    setSelectedMonth(month);
    setPaymentForm((current) => ({ ...current, month, date: buildDateFromParts(activeYear, month, getDateDay(current.date)) }));
    setIncomeForm((current) => ({ ...current, month, date: buildDateFromParts(activeYear, month, getDateDay(current.date)) }));
  }

  function editMovement(collection, row) {
    setEditingMovement({ collection, row });
  }

  async function saveMovement(values) {
    const { collection, row } = editingMovement;
    const sourceKey = collection === 'payments' ? 'category' : 'source';

    await updateCollection(
      collection,
      (items) => items.map((item, index) => (
        index === row.index
          ? {
            ...item,
            date: buildDateFromParts(activeYear, values.month, values.day),
            month: values.month,
            [sourceKey]: values.source,
            concept: values.concept,
            ...(collection === 'income' ? { type: values.type } : {}),
            status: values.status,
            amount: toNumber(values.amount),
          }
          : item
      )),
      'Movimiento editado en Supabase',
    );
    setEditingMovement(null);
  }

  function deleteMovement(collection, row) {
    if (!window.confirm('Seguro que quieres eliminar este movimiento?')) return;
    updateCollection(collection, (items) => items.filter((_, index) => index !== row.index), 'Movimiento eliminado de Supabase');
  }

  return (
    <section className="stack">
      <SectionTitle
        actions={(
          <Select value={selectedMonth} onChange={(event) => updateMonth(event.target.value)}>
            {data.months.map((month) => <option key={month}>{month}</option>)}
          </Select>
        )}
      >
        <h2>Tabla de flujo de caja</h2>
      </SectionTitle>
      <div className="stack">
        <MovementPanel activeYear={activeYear} title="Pagos recurrentes" form={paymentForm} setForm={setPaymentForm} onSubmit={addPayment} type="payment" concepts={paymentConcepts} sources={paymentCategories} />
        <Card className="form-card">
          <h3>Pagos de {selectedMonth}</h3>
          <MovementsTable rows={payments} collection="payments" deleteMovement={deleteMovement} editMovement={editMovement} type="payment" />
        </Card>
      </div>
      <div className="stack">
        <MovementPanel activeYear={activeYear} title="Ganancias" form={incomeForm} setForm={setIncomeForm} onSubmit={addIncome} type="income" concepts={incomeConcepts} sources={incomeSources} />
        <Card className="form-card">
          <h3>Ganancias de {selectedMonth}</h3>
          <MovementsTable rows={income} collection="income" deleteMovement={deleteMovement} editMovement={editMovement} type="income" />
        </Card>
      </div>
      {editingMovement && (
        <EditModal
          title="Editar movimiento"
          initialValues={{
            day: getDateDay(editingMovement.row.date),
            month: editingMovement.row.month ?? selectedMonth,
            source: editingMovement.collection === 'payments' ? editingMovement.row.category ?? '' : editingMovement.row.source ?? '',
            concept: editingMovement.row.concept ?? '',
            type: editingMovement.row.type ?? 'Fijo',
            status: editingMovement.row.status ?? 'Pagado',
            amount: editingMovement.row.amount ?? '',
          }}
          fields={[
            { name: 'day', label: 'Dia', type: 'number', min: 1, max: daysInMonth(activeYear, editingMovement.row.month ?? selectedMonth), required: true },
            { name: 'month', label: 'Mes', type: 'select', options: data.months, required: true },
            { name: 'source', label: editingMovement.collection === 'payments' ? 'Categoria' : 'Origen', type: 'text', required: true },
            { name: 'concept', label: 'Concepto', type: 'text', required: true },
            ...(editingMovement.collection === 'income' ? [{ name: 'type', label: 'Tipo', type: 'select', options: ['Fijo', 'Variable'], required: true }] : []),
            { name: 'status', label: 'Estado', type: 'select', options: ['Pendiente', 'Pagado'], required: true },
            { name: 'amount', label: 'Monto', type: 'number', required: true },
          ]}
          onClose={() => setEditingMovement(null)}
          onSave={saveMovement}
        />
      )}
    </section>
  );
}
