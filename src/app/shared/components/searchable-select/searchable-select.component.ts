import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, forwardRef, HostListener, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SearchableSelectOption {
    value: string | number | null;
    label: string;
    searchText?: string;
    meta?: string;
}

@Component({
    selector: 'app-searchable-select',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './searchable-select.component.html',
    styleUrls: ['./searchable-select.component.css'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => SearchableSelectComponent),
            multi: true
        }
    ]
})
export class SearchableSelectComponent implements ControlValueAccessor, AfterViewInit {
    @Input() options: SearchableSelectOption[] = [];
    @Input() placeholder = 'Seleccionar';
    @Input() searchPlaceholder = 'Filtrar opciones...';
    @Input() emptyMessage = 'No hay coincidencias.';
    @Input() compact = false;
    @Input() disabled = false;
    @Input() panelInline = false;
    @Input() allowClear = false;
    @Input() clearLabel = 'Limpiar seleccion';
    @Input() clearValue: string | number | null = null;
    @Output() valueChange = new EventEmitter<string | number | null>();

    @ViewChild('filterInput') filterInput?: ElementRef<HTMLInputElement>;

    open = false;
    query = '';
    private value: string | number | null = null;
    private onChange: (value: string | number | null) => void = () => {};
    private onTouched: () => void = () => {};

    constructor(private host: ElementRef<HTMLElement>) {}

    ngAfterViewInit(): void {
        if (this.open) {
            this.focusFilter();
        }
    }

    get filteredOptions(): SearchableSelectOption[] {
        const term = this.normalize(this.query);
        if (!term) {
            return this.options;
        }
        return this.options.filter(option => this.normalize(`${option.label} ${option.searchText ?? ''} ${option.meta ?? ''}`).includes(term));
    }

    get selectedOption(): SearchableSelectOption | null {
        return this.options.find(option => this.valuesMatch(option.value, this.value)) ?? null;
    }

    writeValue(value: string | number | null): void {
        this.value = value;
    }

    registerOnChange(fn: (value: string | number | null) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
        if (isDisabled) {
            this.open = false;
        }
    }

    toggle(): void {
        if (this.disabled) {
            return;
        }
        this.open = !this.open;
        this.onTouched();
        if (this.open) {
            this.query = '';
            this.focusFilter();
        }
    }

    close(): void {
        this.open = false;
        this.query = '';
    }

    selectOption(option: SearchableSelectOption): void {
        this.value = option.value;
        this.onChange(option.value);
        this.valueChange.emit(option.value);
        this.close();
    }

    clearSelection(): void {
        this.value = this.clearValue;
        this.onChange(this.clearValue);
        this.valueChange.emit(this.clearValue);
        this.close();
    }

    trackByValue(_: number, option: SearchableSelectOption): string {
        return `${option.value ?? 'null'}::${option.label}`;
    }

    isSelected(option: SearchableSelectOption): boolean {
        return this.valuesMatch(option.value, this.value);
    }

    @HostListener('document:click', ['$event'])
    handleDocumentClick(event: MouseEvent): void {
        if (!this.open) {
            return;
        }
        if (!this.host.nativeElement.contains(event.target as Node)) {
            this.close();
        }
    }

    private focusFilter(): void {
        setTimeout(() => this.filterInput?.nativeElement.focus(), 0);
    }

    private normalize(value: string): string {
        return value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    private valuesMatch(left: string | number | null, right: string | number | null): boolean {
        if (left === right) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        const leftNumber = Number(left);
        const rightNumber = Number(right);
        if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && `${left}` !== '' && `${right}` !== '') {
            return leftNumber === rightNumber;
        }
        return String(left) === String(right);
    }
}
