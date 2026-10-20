import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import * as api from '../api/ledgerApi';
import { balancesById } from '../shared/lib/ledger';

// Estado del libro contable. Cada acción guarda solo lo que cambió y luego recarga (son pocas filas).
// Las acciones devuelven true/false para que los formularios no se cierren si falla el guardado.
export function useLedger(userId, notify) {
  const [ledger, setLedger] = useState({ accounts: [], categories: [], transactions: [], recurring: [] });
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    try {
      setLedger(await api.fetchLedger(supabase));
      setStatus('ready');
      setLoadError('');
    } catch (error) {
      setStatus('error');
      setLoadError(error.message);
    }
  }, []);

  useEffect(() => {
    if (userId) reload();
  }, [userId, reload]);

  const run = useCallback(async (task, successMessage) => {
    try {
      await task();
      await reload();
      if (successMessage) notify(successMessage);
      return true;
    } catch (error) {
      notify(`No se pudo guardar: ${error.message}`, 'error');
      return false;
    }
  }, [reload, notify]);

  const balances = useMemo(() => balancesById(ledger.accounts, ledger.transactions), [ledger]);

  const actions = useMemo(() => ({
    saveTransaction: (values, existing) => run(() => {
      if (values.kind === 'transferencia') {
        return existing?.transferId
          ? api.updateTransfer(supabase, existing.transferId, values)
          : api.createTransfer(supabase, values);
      }
      return existing ? api.updateTransaction(supabase, existing.id, values) : api.createTransaction(supabase, values);
    }, existing ? 'Movimiento actualizado' : 'Movimiento guardado'),
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
      () => (existing ? api.updateRecurring(supabase, existing.id, values) : api.createRecurring(supabase, values)),
      existing ? 'Frecuente actualizado (aplica a las próximas fechas)' : 'Frecuente creado',
    ),
    archiveRecurring: (item, archived) => run(() => api.setRecurringArchived(supabase, item.id, archived), archived ? 'Frecuente pausado' : 'Frecuente reactivado'),
    archiveCategory: (category, archived) => run(() => api.setCategoryArchived(supabase, category.id, archived), archived ? 'Categoría archivada' : 'Categoría reactivada'),
  }), [run]);

  return { ...ledger, balances, status, loadError, reload, actions };
}
