import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  AssistantChatMessage,
  AssistantStreamEvent,
  ScreenContext
} from '../models/assistant.models';

/**
 * Talks to the standalone agent service (`agentApiUrl`). Chat is consumed as an
 * SSE stream via the Fetch API (HttpClient doesn't expose progressive bodies well),
 * re-entering the Angular zone on each event so OnPush views update.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  constructor(private readonly auth: AuthService, private readonly zone: NgZone) {}

  chat(
    messages: AssistantChatMessage[],
    context: ScreenContext | null
  ): Observable<AssistantStreamEvent> {
    return new Observable<AssistantStreamEvent>(subscriber => {
      const controller = new AbortController();
      const emit = (e: AssistantStreamEvent) => this.zone.run(() => subscriber.next(e));

      fetch(`${environment.agentApiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.auth.getToken() ?? ''}`
        },
        body: JSON.stringify({ messages, context }),
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
      case 'usage':
        emit({
          type: 'usage',
          usage: {
            inputTokens: Number(parsed['input_tokens'] ?? 0),
            outputTokens: Number(parsed['output_tokens'] ?? 0),
            total: Number(parsed['total'] ?? 0)
          }
        });
        break;
      case 'error':
        emit({ type: 'error', message: String(parsed['message'] ?? 'Error') });
        break;
      case 'done':
        emit({ type: 'done' });
        break;
    }
  }
}
