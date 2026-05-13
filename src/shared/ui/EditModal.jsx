import { useEffect, useState } from 'react';
import { Button } from './Button';
import { DateInput, NumberInput, Select, TextInput } from './FormControls';

export function EditModal({ fields, initialValues, onClose, onSave, title }) {
  const [form, setForm] = useState(initialValues);

  useEffect(() => {
    setForm(initialValues);
  }, [initialValues]);

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="edit-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-fields">
          {fields.map((field) => {
            const value = form[field.name] ?? '';

            if (field.type === 'checkbox') {
              return (
                <label className="checkbox-field" key={field.name}>
                  <input
                    type="checkbox"
                    checked={Boolean(form[field.name])}
                    onChange={(event) => setForm({ ...form, [field.name]: event.target.checked })}
                  />
                  <span>{field.label}</span>
                </label>
              );
            }

            if (field.type === 'select') {
              return (
                <label key={field.name}>
                  <span>{field.label}</span>
                  <Select value={value} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} required={field.required}>
                    {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </Select>
                </label>
              );
            }

            const Input = field.type === 'number' ? NumberInput : field.type === 'date' ? DateInput : TextInput;

            return (
              <label key={field.name}>
                <span>{field.label}</span>
                <Input
                  disabled={field.disabled}
                  max={field.max}
                  min={field.min}
                  step={field.step}
                  value={value}
                  onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
                  required={field.required}
                />
              </label>
            );
          })}
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Guardar</Button>
        </div>
      </form>
    </div>
  );
}
