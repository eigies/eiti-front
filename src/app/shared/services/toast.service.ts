import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
    private idCounter = 0;
    private _toasts$ = new BehaviorSubject<Toast[]>([]);
    toasts$ = this._toasts$.asObservable();

    show(message: string, type: Toast['type'] = 'info', duration = 4000): void {
        const id = ++this.idCounter;
        const current = this._toasts$.value;
        this._toasts$.next([...current, { id, message, type }]);
        setTimeout(() => this.dismiss(id), duration);
    }

    success(message: string): void { this.show(message, 'success'); }
    error(message: string): void { this.show(message, 'error'); }

    dismiss(id: number): void {
        this._toasts$.next(this._toasts$.value.filter(t => t.id !== id));
    }
}
