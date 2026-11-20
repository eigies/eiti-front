import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type ThemeMode = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly storageKey = 'eiti_theme';
    private readonly currentThemeSubject = new BehaviorSubject<ThemeMode>(this.loadTheme());

    readonly currentTheme$ = this.currentThemeSubject.asObservable();

    constructor(@Inject(DOCUMENT) private document: Document) {
        this.applyTheme(this.currentThemeSubject.value);
    }

    get currentTheme(): ThemeMode {
        return this.currentThemeSubject.value;
    }

    get isDarkTheme(): boolean {
        return this.currentTheme === 'dark';
    }

    toggleTheme(): void {
        this.setTheme(this.isDarkTheme ? 'light' : 'dark');
    }

    setTheme(theme: ThemeMode): void {
        localStorage.setItem(this.storageKey, theme);
        this.currentThemeSubject.next(theme);
        this.applyTheme(theme);
    }

    private loadTheme(): ThemeMode {
        const stored = localStorage.getItem(this.storageKey);
        // EITI 2: claro por defecto; el oscuro (grafito) se elige y queda guardado en el navegador.
        return stored === 'dark' ? 'dark' : 'light';
    }

    private applyTheme(theme: ThemeMode): void {
        // data-theme en <html> maneja los tokens de EITI 2; las clases en <body> quedan para los estilos viejos.
        this.document.documentElement.setAttribute('data-theme', theme);
        const body = this.document.body;
        body.classList.toggle('theme-light', theme === 'light');
        body.classList.toggle('theme-dark', theme === 'dark');
    }
}
