import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
    /** Milisegundos hasta irse solo; null = queda hasta que se cierre (errores). */
    duration: number | null;
    paused: boolean;
}

interface ToastTimer {
    handle: ReturnType<typeof setTimeout> | null;
    startedAt: number;
    remaining: number;
}

/** Como mucho tres mensajes a la vista: al llegar el cuarto se va el más viejo. */
const MAX_VISIBLE = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
    private idCounter = 0;
    private _toasts$ = new BehaviorSubject<Toast[]>([]);
    private timers = new Map<number, ToastTimer>();
    toasts$ = this._toasts$.asObservable();

    /**
     * Muestra un mensaje abajo a la derecha. Los de éxito e info se van solos a los 4 s
     * (con el mouse encima se pausan); los de error quedan hasta que se cierran.
     */
    show(message: string, type: Toast['type'] = 'info', duration = 4000): void {
        const id = ++this.idCounter;
        const autoDismiss = type === 'error' ? null : duration;
        let next = [...this._toasts$.value, { id, message, type, duration: autoDismiss, paused: false }];
        while (next.length > MAX_VISIBLE) {
            this.clearTimer(next[0].id);
            next = next.slice(1);
        }
        this._toasts$.next(next);
        if (autoDismiss !== null) {
            this.startTimer(id, autoDismiss);
        }
    }

    success(message: string): void { this.show(message, 'success'); }
    error(message: string): void { this.show(message, 'error'); }

    dismiss(id: number): void {
        this.clearTimer(id);
        this._toasts$.next(this._toasts$.value.filter(t => t.id !== id));
    }

    /** Frena la cuenta regresiva mientras el mouse está encima. */
    pause(id: number): void {
        const timer = this.timers.get(id);
        if (!timer || timer.handle === null) return;
        clearTimeout(timer.handle);
        timer.handle = null;
        timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
        this.setPaused(id, true);
    }

    resume(id: number): void {
        const timer = this.timers.get(id);
        if (!timer || timer.handle !== null) return;
        this.setPaused(id, false);
        this.startTimer(id, timer.remaining);
    }

    private startTimer(id: number, ms: number): void {
        const handle = setTimeout(() => this.dismiss(id), ms);
        this.timers.set(id, { handle, startedAt: Date.now(), remaining: ms });
    }

    private clearTimer(id: number): void {
        const timer = this.timers.get(id);
        if (timer?.handle) clearTimeout(timer.handle);
        this.timers.delete(id);
    }

    private setPaused(id: number, paused: boolean): void {
        this._toasts$.next(this._toasts$.value.map(t => (t.id === id ? { ...t, paused } : t)));
    }
}
