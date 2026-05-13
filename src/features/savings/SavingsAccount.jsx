import { useState } from "react";
import { calendarMonths, finalSaving, recalculateSavingsRows, savingEfficiency } from "../../shared/lib/finance";
import { money } from "../../shared/lib/money";
import { toNumber } from "../../shared/lib/numbers";
import { Button, LinkButton } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { EditModal } from "../../shared/ui/EditModal";
import { NumberInput, Select, TextInput } from "../../shared/ui/FormControls";
import { SectionTitle } from "../../shared/ui/SectionTitle";
import { Table } from "../../shared/ui/Table";

const savingColors = [
  ["purple", "Morado"],
  ["orange", "Naranja"],
  ["green", "Verde"],
  ["blue", "Azul"],
  ["red", "Rojo"],
  ["pink", "Rosado"],
  ["yellow", "Amarillo"],
];

export function SavingsAccount({ account, data, index, saveSavings }) {
  const recalculatedRows = recalculateSavingsRows(account.rows);
  const lastRow = recalculatedRows.at(-1);
  const lastFinal = lastRow ? finalSaving(lastRow) : 0;
  const [form, setForm] = useState({
    month: "Mayo",
    initial: lastFinal,
    deposit: "",
    withdrawal: "",
    interest: "",
  });
  const [editingAccount, setEditingAccount] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const rows = recalculatedRows.map((row, rowIndex) => {
    const final = finalSaving(row);
    const efficiency = savingEfficiency(recalculatedRows, rowIndex, Boolean(account.useCurrentInterestEfficiency));
    return {
      rowIndex,
      display: [
        row.month,
        { content: money.format(row.initial), filterValue: row.initial },
        { content: money.format(row.deposit), filterValue: row.deposit ?? "" },
        { content: money.format(row.withdrawal), filterValue: row.withdrawal ?? "" },
        { content: money.format(row.interest), filterValue: row.interest },
        { content: money.format(final), filterValue: final },
        {
          content: efficiency === null ? "Pendiente" : `${efficiency.toFixed(2)}%`,
          filterValue: efficiency === null ? "Pendiente" : efficiency.toFixed(2),
        },
      ],
    };
  });

  function updateAccount(nextAccount, message) {
    saveSavings(
      data.savings.map((item, itemIndex) =>
        itemIndex === index ? nextAccount : item,
      ),
      message,
    );
  }

  function addRow(event) {
    event.preventDefault();
    const nextRow = {
      month: form.month,
      initial: lastFinal,
      deposit: form.deposit === "" ? null : toNumber(form.deposit),
      withdrawal: form.withdrawal === "" ? null : toNumber(form.withdrawal),
      interest: toNumber(form.interest),
    };
    updateAccount(
      { ...account, rows: recalculateSavingsRows([...recalculatedRows, nextRow]) },
      "Ahorro agregado en Supabase",
    );
    setForm({
      month: form.month,
      initial: finalSaving(nextRow),
      deposit: "",
      withdrawal: "",
      interest: "",
    });
    setIsFormOpen(false);
  }

  function renameAccount() {
    setEditingAccount(true);
  }

  function saveAccountName(values) {
    if (values.name)
      updateAccount(
        { ...account, name: values.name },
        "Cuenta de ahorro editada",
      );
    setEditingAccount(false);
  }

  function deleteAccount() {
    if (!window.confirm(`Eliminar la cuenta ${account.name}?`)) return;
    saveSavings(
      data.savings.filter((_, itemIndex) => itemIndex !== index),
      "Cuenta de ahorro eliminada",
    );
  }

  function editRow(rowIndex) {
    setEditingRowIndex(rowIndex);
  }

  function saveRowEdit(values) {
    const editingRow = recalculatedRows[editingRowIndex];
    updateAccount(
      {
        ...account,
        rows: recalculateSavingsRows(account.rows.map((row, itemIndex) =>
          row.appId === editingRow.appId
            ? {
                ...row,
                month: values.month,
                initial: editingRowIndex === 0 ? toNumber(values.initial) : row.initial,
                interest: toNumber(values.interest),
                deposit: values.deposit === "" ? null : toNumber(values.deposit),
                withdrawal: values.withdrawal === "" ? null : toNumber(values.withdrawal),
              }
            : row,
        )),
      },
      "Ahorro editado en Supabase",
    );
    setEditingRowIndex(null);
  }

  function deleteRow(rowIndex) {
    if (!window.confirm("Seguro que quieres eliminar este ahorro?")) return;
    const rowToDelete = recalculatedRows[rowIndex];
    updateAccount(
      {
        ...account,
        rows: recalculateSavingsRows(account.rows.filter((row) => row.appId !== rowToDelete.appId)),
      },
      "Ahorro eliminado de Supabase",
    );
  }

  function updateColor(color) {
    updateAccount({ ...account, color }, "Color de cuenta actualizado");
  }

  function updateEfficiencyMode(useCurrentInterestEfficiency) {
    updateAccount({ ...account, useCurrentInterestEfficiency }, "Formula de eficiencia actualizada");
  }

  return (
    <Card className={`savings-card savings-card-${account.color ?? "purple"}`}>
      <SectionTitle
        actions={
          <div className="actions">
            <Select className="color-select" value={account.color ?? "purple"} onChange={(event) => updateColor(event.target.value)}>
              {savingColors.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={Boolean(account.useCurrentInterestEfficiency)}
                onChange={(event) => updateEfficiencyMode(event.target.checked)}
              />
              <span>Interes corresponde al mismo mes</span>
            </label>
            <LinkButton onClick={renameAccount}>Editar cuenta</LinkButton>
            <LinkButton onClick={deleteAccount}>Eliminar cuenta</LinkButton>
          </div>
        }
      >
        <h2>{account.name}</h2>
      </SectionTitle>
      <Table
        className="savings-table"
        columns={[
          "Mes",
          "Saldo inicial",
          "Aporte",
          "Retiro",
          "Interes",
          "Saldo final",
          "Eficiencia",
          "Acciones",
        ]}
        rows={rows.map(({ display, rowIndex }) => [
          ...display,
          {
            content: (
              <span className="actions">
                <LinkButton onClick={() => editRow(rowIndex)}>
                  Editar
                </LinkButton>
                <LinkButton onClick={() => deleteRow(rowIndex)}>
                  Eliminar
                </LinkButton>
              </span>
            ),
            filterValue: "",
          },
        ])}
      />
      <p className="total-line">
        Ultimo saldo final: <strong>{money.format(lastFinal)}</strong>
      </p>
      <Button className="savings-form-toggle" type="button" variant="secondary" onClick={() => setIsFormOpen((open) => !open)}>
        Agregar nuevo valor {isFormOpen ? "▴" : "▾"}
      </Button>
      {isFormOpen && (
        <form className="movement-form compact-form" onSubmit={addRow}>
          <Select value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} required>
            {calendarMonths.map((month) => <option key={month}>{month}</option>)}
          </Select>
          <input value={money.format(lastFinal)} disabled />
          <NumberInput
            value={form.deposit}
            onChange={(event) =>
              setForm({ ...form, deposit: event.target.value })
            }
            placeholder="Aporte nuevo opcional"
          />
          <NumberInput
            value={form.withdrawal}
            onChange={(event) =>
              setForm({ ...form, withdrawal: event.target.value })
            }
            placeholder="Retiro opcional"
          />
          <NumberInput
            value={form.interest}
            onChange={(event) =>
              setForm({ ...form, interest: event.target.value })
            }
            placeholder="Interes ganado"
            required
          />
          <Button type="submit">Agregar ahorro</Button>
        </form>
      )}
      {editingAccount && (
        <EditModal
          title="Editar cuenta"
          initialValues={{ name: account.name }}
          fields={[
            { name: "name", label: "Nombre", type: "text", required: true },
          ]}
          onClose={() => setEditingAccount(false)}
          onSave={saveAccountName}
        />
      )}
      {editingRowIndex !== null && (
        <EditModal
          title="Editar ahorro"
          initialValues={{
            month: account.rows[editingRowIndex].month ?? "",
            initial: recalculatedRows[editingRowIndex].initial ?? "",
            deposit: recalculatedRows[editingRowIndex].deposit ?? "",
            withdrawal: recalculatedRows[editingRowIndex].withdrawal ?? "",
            interest: recalculatedRows[editingRowIndex].interest ?? "",
          }}
          fields={[
            { name: "month", label: "Mes", type: "select", options: calendarMonths, required: true },
            {
              name: "initial",
              label: "Saldo inicial",
              type: "number",
              disabled: editingRowIndex !== 0,
              required: true,
            },
            { name: "deposit", label: "Aporte nuevo", type: "number" },
            { name: "withdrawal", label: "Retiro", type: "number" },
            {
              name: "interest",
              label: "Interes ganado",
              type: "number",
              required: true,
            },
          ]}
          onClose={() => setEditingRowIndex(null)}
          onSave={saveRowEdit}
        />
      )}
    </Card>
  );
}
