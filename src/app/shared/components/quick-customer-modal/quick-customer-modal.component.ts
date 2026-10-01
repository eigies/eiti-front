import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomerService } from '../../../core/services/customer.service';
import { BILLING_IVA_CONDITION_OPTIONS, CustomerSearchItem, toCustomerSearchItem } from '../../../core/models/customer.models';
import { isValidCuit } from '../../../core/models/sale.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../searchable-select/searchable-select.component';
import { ToastService } from '../../services/toast.service';
import { extractApiError } from '../../utils/api-error.util';

// Alta rapida de cliente para no interrumpir un flujo en curso (ej. convertir un presupuesto
// de un prospecto sin cuenta). Pide lo esencial y, opcional, los datos de facturacion (CUIT y
// condicion frente al IVA) para poder facturar la venta despues, incluso como Factura A. El resto
// (documento, domicilio) se completa desde la pantalla de Clientes si hace falta.
@Component({
    selector: 'app-quick-customer-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
    templateUrl: './quick-customer-modal.component.html',
    styleUrls: ['./quick-customer-modal.component.css']
})
export class QuickCustomerModalComponent implements OnChanges {
    @Input() initialFirstName = '';
    @Input() initialLastName = '';
    @Input() initialPhone = '';

    @Output() created = new EventEmitter<CustomerSearchItem>();
    @Output() cancel = new EventEmitter<void>();

    readonly form: FormGroup;
    readonly ivaConditionOptions: SearchableSelectOption[] = [...BILLING_IVA_CONDITION_OPTIONS];
    saving = false;
    billingOpen = false;

    constructor(
        private readonly fb: FormBuilder,
        private readonly customerService: CustomerService,
        private readonly toast: ToastService
    ) {
        this.form = this.fb.group({
            firstName: ['', Validators.required],
            lastName: [''],
            phone: [''],
            ivaCondition: [null as number | null],
            taxId: ['']
        });
    }

    ngOnChanges(): void {
        this.form.reset({
            firstName: this.initialFirstName,
            lastName: this.initialLastName,
            phone: this.initialPhone,
            ivaCondition: null,
            taxId: ''
        });
        this.billingOpen = false;
    }

    /** Opcional, pero un CUIT cargado tiene que ser valido: si no, despues frena la Factura A. */
    get taxIdIssue(): string | null {
        const taxId = String(this.form.get('taxId')?.value ?? '').trim();
        return this.billingOpen && taxId && !isValidCuit(taxId) ? 'El CUIT no es válido: revisá los 11 dígitos.' : null;
    }

    isInvalid(field: string): boolean {
        const control = this.form.get(field);
        return !!(control && control.invalid && (control.dirty || control.touched));
    }

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.toast.error('El nombre es obligatorio');
            return;
        }
        if (this.taxIdIssue) {
            return;
        }

        this.saving = true;
        const raw = this.form.getRawValue();
        this.customerService.createCustomer({
            name: `${raw.firstName} ${raw.lastName}`.trim(),
            firstName: raw.firstName,
            lastName: raw.lastName,
            phone: raw.phone,
            taxId: this.billingOpen ? (String(raw.taxId ?? '').trim() || null) : null,
            ivaCondition: this.billingOpen ? raw.ivaCondition : null
        }).subscribe({
            next: customer => {
                this.saving = false;
                this.toast.success(`Cliente "${customer.name}" creado correctamente`);
                this.created.emit(toCustomerSearchItem(customer));
            },
            error: err => {
                this.saving = false;
                this.toast.error(extractApiError(err, 'No se pudo crear el cliente'));
            }
        });
    }
}
