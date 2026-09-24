export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
  options?: string[];
  suggestions?: string[];
  requestId?: number;
  rating?: 1 | -1;
  /** Consulta que originó esta respuesta; se envía solo al marcar pulgar abajo. */
  question?: string;
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

export type AssistantStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'options'; options: string[] }
  | { type: 'suggestions'; suggestions: string[] }
  | { type: 'usage'; usage: AssistantUsage }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface AssistantDigest {
  day: string;
  content: string;
  generatedAt: string;
  cached: boolean;
}
