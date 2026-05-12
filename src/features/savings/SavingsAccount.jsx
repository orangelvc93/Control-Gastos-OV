import { useState } from 'react';
import { finalSaving } from '../../shared/lib/finance';
import { money } from '../../shared/lib/money';
import { toNumber } from '../../shared/lib/numbers';
import { Button, LinkButton } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EditModal } from '../../shared/ui/EditModal';
import { NumberInput, TextInput } from '../../shared/ui/FormControls';
import { SectionTitle } from '../../shared/ui/SectionTitle';
import { Table } from '../../shared/ui/Table';

export function SavingsAccount({ account, data, index, saveSavings }) {
  const lastRow = account.rows.at(-1);
  const lastFinal = lastRow ? finalSaving(lastRow) : 0;
  const [form, setForm] = useState({ month: 'Mayo', initial: lastFinal, deposit: '', interest: '' });
  const [editingAccount, setEditingAccount] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const rows = account.rows.map((row, rowIndex) => {
    const final = finalSaving(row);
    const base = toNumber(row.initial) + toNumber(row.deposit);
    const efficiency = base > 0 ? ((1 + toNumber(row.interest) / base) ** 12 - 1) * 100 : 0;
    return {
      rowIndex,
      display: [
        row.month,
        { content: money.format(row.initial), filterValue: row.initial },
        { content: money.format(row.deposit), filterValue: row.deposit ?? '' },
        { content: money.format(row.interest), filterValue: row.interest },
        { content: money.format(final), filterValue: final },
        { content: `${efficiency.toFixed(2)}%`, filterValue: efficiency.toFixed(2) },
      ],
    };
  });

  function updateAccount(nextAccount, message) {
    saveSavings(data.savings.map((item, itemIndex) => (itemIndex === index ? nextAccount : item)), message);
  }

  function addRow(event) {
    event.preventDefault();
    const nextRow = {
      month: form.month,
      initial: lastFinal,
      deposit: form.deposit === '' ? null : toNumber(form.deposit),
      interest: toNumber(form.interest),
    };
    updateAccount({ ...account, rows: [...account.rows, nextRow] }, 'Ahorro agregado en Supabase');
    setForm({ month: form.month, initial: finalSaving(nextRow), deposit: '', interest: '' });
  }

  function renameAccount() {
    setEditingAccount(true);
  }

  function saveAccountName(values) {
    if (values.name) updateAccount({ ...account, name: values.name }, 'Cuenta de ahorro editada');
    setEditingAccount(false);
  }

  function deleteAccount() {
    if (!window.confirm(`Eliminar la cuenta ${account.name}?`)) return;
    saveSavings(data.savings.filter((_, itemIndex) => itemIndex !== index), 'Cuenta de ahorro eliminada');
  }

  function editRow(rowIndex) {
    setEditingRowIndex(rowIndex);
  }

  function saveRowEdit(values) {
    updateAccount(
      {
        ...account,
        rows: account.rows.map((row, itemIndex) => (
          itemIndex === editingRowIndex
            ? {
              ...row,
              month: values.month,
              initial: toNumber(values.initial),
              interest: toNumber(values.interest),
              deposit: values.deposit === '' ? null : toNumber(values.deposit),
            }
            : row
        )),
      },
      'Ahorro editado en Supabase',
    );
    setEditingRowIndex(null);
  }

  function deleteRow(rowIndex) {
    if (!window.confirm('Seguro que quieres eliminar este ahorro?')) return;
    updateAccount({ ...account, rows: account.rows.filter((_, itemIndex) => itemIndex !== rowIndex) }, 'Ahorro eliminado de Supabase');
  }

  return (
    <Card className="savings-card">
      <SectionTitle
        actions={(
          <div className="actions">
            <LinkButton onClick={renameAccount}>Editar cuenta</LinkButton>
            <LinkButton onClick={deleteAccount}>Eliminar cuenta</LinkButton>
          </div>
        )}
      >
        <h2>{account.name}</h2>
      </SectionTitle>
      <Table
        columns={['Mes', 'Saldo inicial', 'Aporte', 'Interes', 'Saldo final', 'Eficiencia', 'Acciones']}
        rows={rows.map(({ display, rowIndex }) => [
          ...display,
          {
            content: (
              <span className="actions">
                <LinkButton onClick={() => editRow(rowIndex)}>Editar</LinkButton>
                <LinkButton onClick={() => deleteRow(rowIndex)}>Eliminar</LinkButton>
              </span>
            ),
            filterValue: '',
          },
        ])}
      />
      <p className="total-line">Ultimo saldo final: <strong>{money.format(lastFinal)}</strong></p>
      <form className="movement-form compact-form" onSubmit={addRow}>
        <TextInput value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} placeholder="Mes" required />
        <input value={money.format(lastFinal)} disabled />
        <NumberInput value={form.deposit} onChange={(event) => setForm({ ...form, deposit: event.target.value })} placeholder="Aporte nuevo opcional" />
        <NumberInput value={form.interest} onChange={(event) => setForm({ ...form, interest: event.target.value })} placeholder="Interes ganado" required />
        <Button type="submit">Agregar ahorro</Button>
      </form>
      {editingAccount && (
        <EditModal
          title="Editar cuenta"
          initialValues={{ name: account.name }}
          fields={[{ name: 'name', label: 'Nombre', type: 'text', required: true }]}
          onClose={() => setEditingAccount(false)}
          onSave={saveAccountName}
        />
      )}
      {editingRowIndex !== null && (
        <EditModal
          title="Editar ahorro"
          initialValues={{
            month: account.rows[editingRowIndex].month ?? '',
            initial: account.rows[editingRowIndex].initial ?? '',
            deposit: account.rows[editingRowIndex].deposit ?? '',
            interest: account.rows[editingRowIndex].interest ?? '',
          }}
          fields={[
            { name: 'month', label: 'Mes', type: 'text', required: true },
            { name: 'initial', label: 'Saldo inicial', type: 'number', required: true },
            { name: 'deposit', label: 'Aporte nuevo', type: 'number' },
            { name: 'interest', label: 'Interes ganado', type: 'number', required: true },
          ]}
          onClose={() => setEditingRowIndex(null)}
          onSave={saveRowEdit}
        />
      )}
    </Card>
  );
}
