export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
  options?: string[];
  suggestions?: string[];
  /** Factura / nota de crédito que el usuario puede descargar desde la respuesta. */
  documents?: AssistantFiscalDocument[];
  requestId?: number;
  rating?: 1 | -1;
  /** Consulta que originó esta respuesta; se envía solo al marcar pulgar abajo. */
  question?: string;
  /** Extracto adjuntado por el usuario (tarjeta en la conversación, no viaja como mensaje). */
  attachment?: AssistantAttachment;
}

/** Lo que el usuario está viendo en la pantalla actual, enviado con cada consulta. */
export interface ScreenContext {
  screen?: string;
  description?: string;
  filters?: Record<string, unknown>;
  data?: unknown;
}

export interface AssistantUsage {
  inputTokens: number;
  outputTokens: number;
  total: number;
  requestId?: number;
}

/** Comprobante descargable que ofrece el asistente (el PDF se arma con los datos de impresión de EITI). */
export interface AssistantFiscalDocument {
  saleId: string;
  saleCode: string;
  kind: 'invoice' | 'creditNote';
  label: string;
}

export type AssistantStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'options'; options: string[] }
  | { type: 'suggestions'; suggestions: string[] }
  | { type: 'documents'; documents: AssistantFiscalDocument[] }
  | { type: 'usage'; usage: AssistantUsage }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface AssistantDigest {
  day: string;
  content: string;
  generatedAt: string;
  cached: boolean;
}

export interface StatementBankOption {
  id: number;
  name: string;
}

/** Resumen de un extracto bancario leído por el agente (POST /statements). */
export interface StatementSummary {
  statementId: number;
  fileName: string;
  movements: number;
  creditsCount: number;
  creditsTotal: number;
  debitsCount: number;
  debitsTotal: number;
  periodFrom: string;
  periodTo: string;
  skippedRows: number;
  bankDetected: string | null;
  bankId: number | null;
  bankOptions: StatementBankOption[];
  /** "mismatch": los saldos del propio extracto no cierran con los movimientos leídos. */
  balanceStatus: 'ok' | 'mismatch' | 'unknown';
}

export interface AssistantAttachment {
  fileName: string;
  status: 'uploading' | 'ready' | 'error';
  summary?: StatementSummary;
  error?: string;
}
