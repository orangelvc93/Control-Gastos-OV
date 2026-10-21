import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import * as api from '../api/ledgerApi';
import { cutOnOrAfter } from '../shared/lib/cards';
import { addDays } from '../shared/lib/date';
import { balancesById } from '../shared/lib/ledger';

// Justo después de iniciar sesión o renovar el token, el servidor de datos de Supabase puede tener el reloj
// unos segundos atrás del de autenticación y responder "JWT issued at future". Se resuelve solo: se reintenta.
const CLOCK_SKEW_ERROR = /issued at future/i;

async function withClockRetry(task, attempts = 4) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts || !CLOCK_SKEW_ERROR.test(error?.message ?? '')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
}

function friendlyError(error) {
  return CLOCK_SKEW_ERROR.test(error?.message ?? '')
    ? 'Supabase no reconoció la sesión todavía (diferencia de reloj en su servidor). Espera unos segundos y pulsa Reintentar.'
    : error.message;
}

// Estado del libro contable. Cada acción guarda solo lo que cambió y luego recarga (son pocas filas).
// Las acciones devuelven true/false para que los formularios no se cierren si falla el guardado.
export function useLedger(userId, notify) {
  const [ledger, setLedger] = useState({
    accounts: [], categories: [], transactions: [], recurring: [], notifications: [], settings: null, installments: [], statements: [], loans: [],
  });
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    try {
      setLedger(await withClockRetry(() => api.fetchLedger(supabase)));
      setStatus('ready');
      setLoadError('');
    } catch (error) {
      setStatus('error');
      setLoadError(friendlyError(error));
    }
  }, []);

  // Al abrir la app se registran los frecuentes de hoy (la tarea de las 06:00 lo hace igual,
  // esto solo adelanta lo que toque si la app se abre antes o la tarea falló).
  useEffect(() => {
    if (!userId) return;
    (async () => {
      await reload();
      try {
        const result = await withClockRetry(() => api.runMyDailyJobs(supabase));
        if (result?.registrados || result?.avisos) await reload();
      } catch {
        // Si falla, la tarea diaria del servidor lo hará igualmente.
      }
    })();
  }, [userId, reload]);

  const run = useCallback(async (task, successMessage) => {
    try {
      await withClockRetry(task);
      await reload();
      if (successMessage) notify(successMessage);
      return true;
    } catch (error) {
      notify(`No se pudo guardar: ${friendlyError(error)}`, 'error');
      return false;
    }
  }, [reload, notify]);

  const balances = useMemo(() => balancesById(ledger.accounts, ledger.transactions), [ledger]);

  // Registros del mismo frecuente con fecha posterior (una fila por transferencia: la de salida).
  const laterOccurrences = useCallback((existing) => ledger.transactions.filter((transaction) => (
    transaction.recurringId === existing.recurringId
    && transaction.occurrenceDate > existing.occurrenceDate
    && !transaction.deletedAt
    && !(transaction.transferId && transaction.cents > 0)
  )), [ledger.transactions]);

  const actions = useMemo(() => {
    // Compra diferida con tarjeta: values.installment = { months, withInterest }; null = corriente.
    // El diferido se guarda aparte y se cobra desde el corte que incluye la fecha de compra.
    async function syncInstallment(values, transactionId) {
      const plan = ledger.installments.find((item) => item.transactionId === transactionId && !item.archivedAt);
      if (!values.installment) {
        if (plan) await api.setInstallmentArchived(supabase, plan.id, true);
        return;
      }
      const account = ledger.accounts.find((item) => item.id === values.accountId);
      const planValues = {
        accountId: values.accountId,
        transactionId,
        description: values.description,
        principalCents: Math.abs(values.cents),
        months: values.installment.months,
        withInterest: values.installment.withInterest,
        firstCut: cutOnOrAfter(values.date, account.statementDay),
      };
      await (plan ? api.updateInstallment(supabase, plan.id, planValues) : api.createInstallment(supabase, planValues));
    }

    async function saveOne(values, existing) {
      if (values.kind === 'transferencia') {
        return existing?.transferId
          ? api.updateTransfer(supabase, existing.transferId, values)
          : api.createTransfer(supabase, values);
      }
      if (existing) await api.updateTransaction(supabase, existing.id, values);
      const id = existing ? existing.id : await api.createTransaction(supabase, values);
      if (values.installment !== undefined) await syncInstallment(values, id);
      return id;
    }

    return {
      saveTransaction: (values, existing) => run(() => saveOne(values, existing), existing ? 'Movimiento actualizado' : 'Movimiento guardado'),
      // "Este y los siguientes": el frecuente toma el monto, las cuentas y la categoría nuevos,
      // y también se corrigen los registros posteriores que ya existan (cada uno conserva su fecha, estado y notas).
      saveTransactionAndFollowing: (values, existing, item) => run(async () => {
        await saveOne(values, existing);
        await api.updateRecurring(supabase, item.id, {
          ...item,
          cents: Math.abs(values.cents),
          accountId: values.accountId,
          toAccountId: values.toAccountId,
          categoryId: values.categoryId,
        });
        for (const later of laterOccurrences(existing)) {
          const own = { date: later.date, status: later.status, description: later.description, note: later.note };
          await saveOne({ ...values, ...own }, later.transferId ? later : { id: later.id });
        }
      }, 'Actualizado este registro y los siguientes'),
      // "Este y los siguientes" al eliminar: van a la papelera y el frecuente termina el día anterior.
      trashTransactionAndFollowing: (existing, item) => run(async () => {
        await api.moveToTrash(supabase, existing);
        for (const later of laterOccurrences(existing)) await api.moveToTrash(supabase, later);
        const endDate = addDays(existing.occurrenceDate, -1);
        if (endDate < item.startDate) await api.setRecurringArchived(supabase, item.id, true);
        else await api.updateRecurring(supabase, item.id, { ...item, endDate });
      }, `Eliminados este y los siguientes; «${item.name}» ya no se registrará más`),
      // Cambiar un movimiento normal a transferencia (o al revés) no se puede editar en sitio: se reemplaza.
      replaceTransaction: (values, existing) => run(async () => {
        if (values.kind === 'transferencia') await api.createTransfer(supabase, values);
        else await api.createTransaction(supabase, values);
        await api.moveToTrash(supabase, existing);
      }, 'Movimiento actualizado'),
      trashTransaction: (transaction) => run(() => api.moveToTrash(supabase, transaction), 'Movimiento enviado a la papelera'),
      restoreTransaction: (transaction) => run(() => api.restoreFromTrash(supabase, transaction), 'Movimiento restaurado'),
      deleteForever: (transaction) => run(() => api.deleteForever(supabase, transaction), 'Movimiento eliminado definitivamente'),
      saveAccount: (values, existing) => run(
        () => (existing ? api.updateAccount(supabase, existing.id, values) : api.createAccount(supabase, values)),
        existing ? 'Cuenta actualizada' : 'Cuenta creada',
      ),
      archiveAccount: (account, archived) => run(() => api.setAccountArchived(supabase, account.id, archived), archived ? 'Cuenta archivada' : 'Cuenta reactivada'),
      saveCategory: (values, existing) => run(
        () => (existing ? api.updateCategory(supabase, existing.id, values) : api.createCategory(supabase, values)),
        existing ? 'Categoría actualizada' : 'Categoría creada',
      ),
      // Cambiar un frecuente afecta solo a las próximas fechas; lo ya registrado no se toca.
      saveRecurring: (values, existing) => run(
        async () => {
          await (existing ? api.updateRecurring(supabase, existing.id, values) : api.createRecurring(supabase, values));
          await api.runMyDailyJobs(supabase);
        },
        existing ? 'Frecuente actualizado (aplica a las próximas fechas)' : 'Frecuente creado',
      ),
      markNotificationsRead: async (ids) => {
        try {
          await api.markNotificationsRead(supabase, ids);
          await reload();
        } catch {
          // Marcar como leído no es crítico: se reintenta la próxima vez.
        }
      },
      saveSettings: (values) => run(() => api.saveSettings(supabase, userId, values), 'Ajustes guardados'),
      saveMonthlyIncome: (cents) => run(() => api.saveMonthlyIncome(supabase, userId, cents), cents === null ? 'Se usará el promedio de tus ingresos' : 'Ingreso mensual guardado'),
      checkNow: () => run(async () => {
        const result = await api.runMyDailyJobs(supabase);
        notify(`Revisión hecha: ${result.registrados} registrado(s), ${result.avisos} aviso(s) nuevo(s).`);
      }),
      sendTelegramTest: async () => {
        try {
          const result = await withClockRetry(() => api.sendTelegramTest(supabase));
          const messages = {
            enviado: 'Mensaje de prueba enviado. Revisa Telegram.',
            'sin-token': 'Falta guardar el token del bot en Supabase (paso 2).',
            'sin-chat': 'Guarda primero tu chat ID y activa Telegram.',
          };
          notify(messages[result] ?? result, result === 'enviado' ? 'success' : 'error');
          await reload();
        } catch (error) {
          notify(`No se pudo enviar: ${friendlyError(error)}`, 'error');
        }
      },
      archiveRecurring: (item, archived) => run(() => api.setRecurringArchived(supabase, item.id, archived), archived ? 'Frecuente pausado' : 'Frecuente reactivado'),
      archiveCategory: (category, archived) => run(() => api.setCategoryArchived(supabase, category.id, archived), archived ? 'Categoría archivada' : 'Categoría reactivada'),
      // Diferidos que ya tenías al empezar (no tienen compra: su saldo está en el saldo inicial de la tarjeta).
      saveInstallment: (values, existing) => run(
        () => (existing ? api.updateInstallment(supabase, existing.id, values) : api.createInstallment(supabase, values)),
        existing ? 'Diferido actualizado' : 'Diferido agregado',
      ),
      archiveInstallment: (plan) => run(() => api.setInstallmentArchived(supabase, plan.id, true), 'Diferido eliminado'),
      saveStatement: (values) => run(() => api.saveStatement(supabase, values), 'Estado de cuenta anotado'),
      payCard: (values) => run(() => api.createTransfer(supabase, values), 'Pago de la tarjeta registrado'),
      // Crédito nuevo: cuenta de deuda (saldo 0) + ficha + desembolso (transferencia del crédito a la cuenta donde entró el dinero).
      // Crédito que ya tenías: la cuenta empieza hoy con el saldo pendiente como deuda.
      saveLoan: (values, existing) => run(async () => {
        if (existing) {
          await api.updateAccount(supabase, existing.account.id, { ...existing.account, ...values.account });
          await api.updateLoan(supabase, existing.loan.id, { ...values.loan, accountId: existing.account.id });
          return;
        }
        const accountId = await api.createAccount(supabase, values.account);
        await api.createLoan(supabase, { ...values.loan, accountId });
        if (values.disbursement) {
          await api.createTransfer(supabase, {
            fromAccountId: accountId, toAccountId: values.disbursement.toAccountId, cents: values.loan.principalCents,
            date: values.account.openingDate, description: `Desembolso ${values.account.name}`, note: '', status: 'confirmado',
          });
        }
        await api.runMyDailyJobs(supabase);
      }, existing ? 'Crédito actualizado' : 'Crédito creado'),
      // Abono extra a capital; "reducir cuota" además guarda la cuota nueva.
      payLoanExtra: ({ loan, account, fromAccountId, cents, date, newPaymentCents }) => run(async () => {
        await api.createTransfer(supabase, {
          fromAccountId, toAccountId: account.id, cents, date, description: `Abono extra a capital: ${account.name}`, note: '', status: 'confirmado',
        });
        if (newPaymentCents) await api.setLoanPayment(supabase, loan.id, newPaymentCents);
      }, 'Abono registrado'),
    };
  }, [run, reload, notify, userId, laterOccurrences, ledger.accounts, ledger.installments]);

  return { ...ledger, balances, status, loadError, reload, actions };
}
