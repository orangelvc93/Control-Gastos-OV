import { buildDateFromParts, daysInMonth, getDateDay } from '../../shared/lib/date';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { NumberInput, Select, TextInput } from '../../shared/ui/FormControls';

export function MovementPanel({ activeYear, concepts, form, onSubmit, setForm, sources = [], title, type }) {
  const sourceLabel = type === 'payment' ? 'Categoria' : 'Origen';
  const sourceKey = type === 'payment' ? 'category' : 'source';
  const listId = `${type}-concepts`;
  const sourceListId = `${type}-sources`;

  return (
    <Card className="form-card">
      <h3>{title}</h3>
      <form className="movement-form" onSubmit={onSubmit}>
        <NumberInput
          placeholder="Dia"
          min="1"
          max={daysInMonth(activeYear, form.month)}
          step="1"
          value={getDateDay(form.date)}
          onChange={(event) => setForm({ ...form, date: buildDateFromParts(activeYear, form.month, event.target.value) })}
          required
        />
        <TextInput
          placeholder={sourceLabel}
          list={sourceListId}
          value={form[sourceKey]}
          onChange={(event) => setForm({ ...form, [sourceKey]: event.target.value })}
          required
        />
        <datalist id={sourceListId}>{sources.map((source) => <option key={source} value={source} />)}</datalist>
        <TextInput
          placeholder="Concepto"
          list={listId}
          value={form.concept}
          onChange={(event) => setForm({ ...form, concept: event.target.value })}
          required
        />
        <datalist id={listId}>{concepts.map((concept) => <option key={concept} value={concept} />)}</datalist>
        {type === 'income' && (
          <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} required>
            <option value="Fijo">Fijo</option>
            <option value="Variable">Variable</option>
          </Select>
        )}
        <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} required>
          <option value="Pendiente">Pendiente</option>
          <option value="Pagado">Pagado</option>
        </Select>
        <NumberInput
          placeholder="Monto"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
          required
        />
        <Button type="submit">Agregar</Button>
      </form>
    </Card>
  );
}
