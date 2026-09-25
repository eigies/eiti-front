import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  AssistantChatMessage,
  AssistantDigest,
  AssistantStreamEvent,
  StatementSummary,
  ScreenContext
} from '../models/assistant.models';

interface StatementSummaryDto {
  statement_id: number;
  file_name: string;
  movements: number;
  credits_count: number;
  credits_total: string;
  debits_count: number;
  debits_total: string;
  period_from: string;
  period_to: string;
  skipped_rows: number;
  bank_detected: string | null;
  bank_id: number | null;
  bank_options: { id: number; name: string }[];
  balance_check: { status: 'ok' | 'mismatch' | 'unknown' };
}

interface DigestDto {
  day: string;
  content: string;
  generated_at: string;
  cached: boolean;
}

/**
 * Talks to the standalone agent service (`agentApiUrl`). Chat is consumed as an
 * SSE stream via the Fetch API (HttpClient doesn't expose progressive bodies well),
 * re-entering the Angular zone on each event so OnPush views update.
 * The auth interceptor only covers `apiUrl`, so the JWT is attached here explicitly.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly baseUrl = environment.agentApiUrl;

  constructor(
    private readonly auth: AuthService,
    private readonly zone: NgZone,
    private readonly http: HttpClient
  ) {}

  chat(
    messages: AssistantChatMessage[],
    context: ScreenContext | null,
    attachments: number[] = []
  ): Observable<AssistantStreamEvent> {
    return new Observable<AssistantStreamEvent>(subscriber => {
      const controller = new AbortController();
      const emit = (e: AssistantStreamEvent) => this.zone.run(() => subscriber.next(e));

      fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.auth.getToken() ?? ''}`
        },
        body: JSON.stringify({ messages, context, attachments }),
        signal: controller.signal
      })
        .then(async res => {
          if (!res.ok || !res.body) {
            emit({ type: 'error', message: `HTTP ${res.status}` });
            this.zone.run(() => subscriber.complete());
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          // SSE frames are separated by a blank line.
          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';
            for (const frame of frames) {
              this.parseFrame(frame, emit);
            }
          }
          this.zone.run(() => subscriber.complete());
        })
        .catch(err => {
          if (!controller.signal.aborted) {
            emit({ type: 'error', message: err?.message ?? String(err) });
          }
          this.zone.run(() => subscriber.complete());
        });

      return () => controller.abort();
    });
  }

  /**
   * Pulgar arriba/abajo sobre una respuesta. En el pulgar abajo se manda además la
   * consulta del usuario: es lo único que permite saber después qué no pudo responder
   * (el agente no guarda las conversaciones).
   */
  sendFeedback(requestId: number, rating: 1 | -1, comment?: string, question?: string): Observable<void> {
    const body: Record<string, unknown> = { request_id: requestId, rating };
    if (comment?.trim()) {
      body['comment'] = comment.trim().slice(0, 1000);
    }
    if (rating === -1 && question?.trim()) {
      body['question'] = question.trim().slice(0, 2000);
    }
    return this.http.post<void>(`${this.baseUrl}/feedback`, body, { headers: this.authHeaders() });
  }

  getDigest(day?: string): Observable<AssistantDigest> {
    let params = new HttpParams();
    if (day) {
      params = params.set('day', day);
    }
    return this.http
      .get<DigestDto>(`${this.baseUrl}/digest`, { headers: this.authHeaders(), params })
      .pipe(
        map(d => ({
          day: d.day,
          content: d.content,
          generatedAt: d.generated_at,
          cached: d.cached
        }))
      );
  }

  /** Sube un extracto (Excel, CSV, PDF o foto) para conciliarlo desde el chat. */
  uploadStatement(file: File): Observable<StatementSummary> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http
      .post<StatementSummaryDto>(`${this.baseUrl}/statements`, form, { headers: this.authHeaders() })
      .pipe(
        map(d => ({
          statementId: d.statement_id,
          fileName: d.file_name,
          movements: d.movements,
          creditsCount: d.credits_count,
          creditsTotal: Number(d.credits_total),
          debitsCount: d.debits_count,
          debitsTotal: Number(d.debits_total),
          periodFrom: d.period_from,
          periodTo: d.period_to,
          skippedRows: d.skipped_rows,
          bankDetected: d.bank_detected,
          bankId: d.bank_id,
          bankOptions: d.bank_options,
          balanceStatus: d.balance_check.status
        }))
      );
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken() ?? ''}` });
  }

  private parseFrame(frame: string, emit: (e: AssistantStreamEvent) => void): void {
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data += line.slice(5).trim();
      }
    }
    if (!data) {
      return;
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    switch (event) {
      case 'delta':
        emit({ type: 'delta', text: String(parsed['text'] ?? '') });
        break;
      case 'options': {
        const options = this.stringList(parsed['options']);
        if (options.length) {
          emit({ type: 'options', options });
        }
        break;
      }
      case 'suggestions': {
        const suggestions = this.stringList(parsed['suggestions']);
        if (suggestions.length) {
          emit({ type: 'suggestions', suggestions });
        }
        break;
      }
      case 'usage': {
        const rawId = parsed['request_id'];
        emit({
          type: 'usage',
          usage: {
            inputTokens: Number(parsed['input_tokens'] ?? 0),
            outputTokens: Number(parsed['output_tokens'] ?? 0),
            total: Number(parsed['total'] ?? 0),
            requestId: typeof rawId === 'number' ? rawId : undefined
          }
        });
        break;
      }
      case 'error':
        emit({ type: 'error', message: String(parsed['message'] ?? 'Error') });
        break;
      case 'done':
        emit({ type: 'done' });
        break;
    }
  }

  private stringList(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter((o): o is string => typeof o === 'string' && o.trim().length > 0);
  }
}
