import { HttpParams } from '@angular/common/http';
import { LedgerQuery } from '../models/account-ledger.models';

/** Query string del extracto de cuenta corriente (proveedores y clientes usan el mismo filtro). */
export function ledgerParams(query: LedgerQuery): HttpParams {
  let params = new HttpParams().set('includeCancelled', String(query.includeCancelled));
  if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params = params.set('dateTo', query.dateTo);
  return params;
}
