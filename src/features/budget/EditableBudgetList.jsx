import { useState } from 'react';
import { createAppId } from '../../shared/lib/finance';
import { money } from '../../shared/lib/money';
import { toNumber } from '../../shared/lib/numbers';
import { Button, LinkButton } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EditModal } from '../../shared/ui/EditModal';
import { NumberInput, TextInput } from '../../shared/ui/FormControls';
import { Table } from '../../shared/ui/Table';

export function EditableBudgetList({ allowInterest = false, items, onSave, title }) {
  const [form, setForm] = useState({ description: '', amount: '', useFixedAmount: false, isInterest: false });
  const [editingIndex, setEditingIndex] = useState(null);

  function addItem(event) {
    event.preventDefault();
    onSave([...items, { appId: createAppId('budget-item'), description: form.description, amount: toNumber(form.amount), useFixedAmount: form.useFixedAmount, ...(allowInterest ? { isInterest: form.isInterest } : {}) }]);
    setForm({ description: '', amount: '', useFixedAmount: false, isInterest: false });
  }

  function editItem(index) {
    setEditingIndex(index);
  }

  function saveEdit(values) {
    onSave(items.map((item, itemIndex) => (
      itemIndex === editingIndex
        ? { ...item, description: values.description, amount: toNumber(values.amount), useFixedAmount: Boolean(values.useFixedAmount), ...(allowInterest ? { isInterest: Boolean(values.isInterest) } : {}) }
        : item
    )));
    setEditingIndex(null);
  }

  function deleteItem(index) {
    if (!window.confirm('Seguro que quieres eliminar este item?')) return;
    onSave(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <Card>
      <h2>{title}</h2>
      <form className="movement-form compact-form" onSubmit={addItem}>
        <TextInput placeholder="Descripcion" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
        <NumberInput placeholder="Valor" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
        <label className="inline-check">
          <input type="checkbox" checked={form.useFixedAmount} onChange={(event) => setForm({ ...form, useFixedAmount: event.target.checked })} />
          <span>Usar valor fijo</span>
        </label>
        {allowInterest && (
          <label className="inline-check">
            <input type="checkbox" checked={form.isInterest} onChange={(event) => setForm({ ...form, isInterest: event.target.checked })} />
            <span>Es interes</span>
          </label>
        )}
        <Button type="submit">Agregar</Button>
      </form>
      <Table
        columns={['Descripcion', 'Valor', 'Valor fijo', ...(allowInterest ? ['Interes'] : []), 'Acciones']}
        rows={items.map((item, index) => [
          item.description,
          { content: money.format(item.amount), filterValue: item.amount },
          item.useFixedAmount ? 'Si' : 'No',
          ...(allowInterest ? [item.isInterest ? 'Si' : 'No'] : []),
          {
            content: (
              <span className="actions">
                <LinkButton onClick={() => editItem(index)}>Editar</LinkButton>
                <LinkButton onClick={() => deleteItem(index)}>Eliminar</LinkButton>
              </span>
            ),
            filterValue: '',
          },
        ])}
      />
      {editingIndex !== null && (
        <EditModal
          title={`Editar ${title.toLowerCase()}`}
          initialValues={{
            description: items[editingIndex].description ?? '',
            amount: items[editingIndex].amount ?? '',
            useFixedAmount: Boolean(items[editingIndex].useFixedAmount),
            isInterest: Boolean(items[editingIndex].isInterest),
          }}
          fields={[
            { name: 'description', label: 'Descripcion', type: 'text', required: true },
            { name: 'amount', label: 'Valor', type: 'number', required: true },
            { name: 'useFixedAmount', label: 'Usar valor fijo', type: 'checkbox' },
            ...(allowInterest ? [{ name: 'isInterest', label: 'Es interes', type: 'checkbox' }] : []),
          ]}
          onClose={() => setEditingIndex(null)}
          onSave={saveEdit}
        />
      )}
    </Card>
  );
}
