export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
}

export type AssistantStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'usage'; usage: AssistantUsage }
  | { type: 'done' }
  | { type: 'error'; message: string };
