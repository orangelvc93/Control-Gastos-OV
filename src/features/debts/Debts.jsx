import { useEffect, useState } from 'react';
import { emptyDebt } from '../../shared/lib/finance';
import { money } from '../../shared/lib/money';
import { sum, toNumber } from '../../shared/lib/numbers';
import { Button, LinkButton } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EditModal } from '../../shared/ui/EditModal';
import { NumberInput, TextInput } from '../../shared/ui/FormControls';
import { SectionTitle } from '../../shared/ui/SectionTitle';
import { Table } from '../../shared/ui/Table';

const debtFields = [
  ['loan', 'Prestamo', 'text'],
  ['description', 'Descripcion', 'text'],
  ['total', 'Monto total', 'number'],
  ['monthlyPayment', 'Cuota mensual', 'number'],
  ['totalInstallments', 'Cuotas totales', 'number'],
  ['currentInstallment', 'Cuotas pagadas', 'number'],
];

// Guarda al salir del campo o con Enter, no en cada tecla: cada guardado reescribe todo el año.
function InstallmentInput({ debt, onCommit }) {
  const [value, setValue] = useState(String(debt.currentInstallment));

  useEffect(() => {
    setValue(String(debt.currentInstallment));
  }, [debt.currentInstallment]);

  function commit() {
    const next = toNumber(value);
    if (next !== debt.currentInstallment) onCommit(next);
  }

  return (
    <input
      className="mini-input"
      type="number"
      min="0"
      max={debt.totalInstallments}
      aria-label={`Cuotas pagadas de ${debt.loan}`}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

export function Debts({ data, debts, saveData }) {
  const [form, setForm] = useState(emptyDebt());
  const [editingDebt, setEditingDebt] = useState(null);
  const activeDebts = debts.map((debt, index) => ({ ...debt, index })).filter((debt) => !debt.archived);

  function saveDebts(debtsNext, message) {
    return saveData({ ...data, debts: debtsNext }, message);
  }

  async function addDebt(event) {
    event.preventDefault();
    const saved = await saveDebts([
      ...data.debts,
      {
        ...form,
        total: toNumber(form.total),
        monthlyPayment: toNumber(form.monthlyPayment),
        totalInstallments: toNumber(form.totalInstallments),
        currentInstallment: toNumber(form.currentInstallment),
        monthValue: form.monthValue === '' ? null : toNumber(form.monthValue),
        archived: false,
      },
    ], 'Deuda creada en Supabase');
    if (saved) setForm(emptyDebt());
  }

  function updateDebt(index, patch, message) {
    return saveDebts(data.debts.map((debt, itemIndex) => (itemIndex === index ? { ...debt, ...patch } : debt)), message);
  }

  function editDebt(debt) {
    setEditingDebt(debt);
  }

  async function saveDebtEdit(values) {
    const saved = await updateDebt(editingDebt.index, {
      loan: values.loan,
      description: values.description,
      total: toNumber(values.total),
      monthlyPayment: toNumber(values.monthlyPayment),
      totalInstallments: toNumber(values.totalInstallments),
      currentInstallment: toNumber(values.currentInstallment),
      interest: values.interest,
      monthValue: values.monthValue === '' ? null : toNumber(values.monthValue),
    }, 'Deuda editada en Supabase');
    if (saved) setEditingDebt(null);
  }

  function archiveDebt(debt) {
    if (!window.confirm('Seguro que quieres archivar esta deuda?')) return;
    updateDebt(debt.index, { archived: true }, 'Deuda archivada');
  }

  function deleteDebt(debt) {
    if (!window.confirm('Seguro que quieres eliminar esta deuda?')) return;
    saveDebts(data.debts.filter((_, itemIndex) => itemIndex !== debt.index), 'Deuda eliminada de Supabase');
  }

  return (
    <section className="stack">
      <Card className="form-card">
        <h2>Nueva deuda o cuota</h2>
        <form className="movement-form" onSubmit={addDebt}>
          {debtFields.map(([key, label, type]) => {
            const Input = type === 'number' ? NumberInput : TextInput;
            return (
              <Input
                key={key}
                placeholder={label}
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                required
              />
            );
          })}
          <TextInput placeholder="Con o sin interes" value={form.interest} onChange={(event) => setForm({ ...form, interest: event.target.value })} required />
          <NumberInput placeholder="Valor del mes opcional" value={form.monthValue} onChange={(event) => setForm({ ...form, monthValue: event.target.value })} />
          <Button type="submit">Agregar deuda</Button>
        </form>
      </Card>

      <Card>
        <SectionTitle
          actions={(
            <div className="summary-pills">
              <span>Activas: {activeDebts.length}</span>
              <span>Restante: {money.format(sum(activeDebts, (debt) => debt.remainingDebt))}</span>
            </div>
          )}
        >
          <h2>Tabla de prestamos o deudas</h2>
        </SectionTitle>
        <Table
          columns={['Prestamo', 'Descripcion', 'Cuota', 'Pagadas', 'Faltantes', 'Deuda restante', 'Acciones']}
          rows={activeDebts.map((debt) => [
            debt.loan,
            debt.description,
            { content: money.format(debt.monthlyPayment), filterValue: debt.monthlyPayment },
            {
              content: (
                <InstallmentInput
                  debt={debt}
                  onCommit={(currentInstallment) => updateDebt(debt.index, { currentInstallment }, 'Cuota pagada actualizada')}
                />
              ),
              filterValue: debt.currentInstallment,
            },
            debt.remainingMonths,
            { content: money.format(debt.remainingDebt), filterValue: debt.remainingDebt },
            {
              content: (
                <span className="actions">
                  <LinkButton onClick={() => editDebt(debt)}>Editar</LinkButton>
                  <LinkButton onClick={() => archiveDebt(debt)}>Archivar</LinkButton>
                  <LinkButton onClick={() => deleteDebt(debt)}>Eliminar</LinkButton>
                </span>
              ),
              filterValue: '',
            },
          ])}
        />
      </Card>
      {editingDebt && (
        <EditModal
          title="Editar deuda"
          initialValues={{
            loan: editingDebt.loan ?? '',
            description: editingDebt.description ?? '',
            total: editingDebt.total ?? '',
            monthlyPayment: editingDebt.monthlyPayment ?? '',
            totalInstallments: editingDebt.totalInstallments ?? '',
            currentInstallment: editingDebt.currentInstallment ?? '',
            interest: editingDebt.interest ?? '',
            monthValue: editingDebt.monthValue ?? '',
          }}
          fields={[
            { name: 'loan', label: 'Prestamo', type: 'text', required: true },
            { name: 'description', label: 'Descripcion', type: 'text', required: true },
            { name: 'total', label: 'Monto total', type: 'number', required: true },
            { name: 'monthlyPayment', label: 'Cuota mensual', type: 'number', required: true },
            { name: 'totalInstallments', label: 'Cuotas totales', type: 'number', required: true },
            { name: 'currentInstallment', label: 'Cuotas pagadas', type: 'number', required: true },
            { name: 'interest', label: 'Con o sin interes', type: 'text', required: true },
            { name: 'monthValue', label: 'Valor del mes opcional', type: 'number' },
          ]}
          onClose={() => setEditingDebt(null)}
          onSave={saveDebtEdit}
        />
      )}
    </section>
  );
}
