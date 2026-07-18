import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomerService } from '../../../core/services/customer.service';
import { CustomerSearchItem, toCustomerSearchItem } from '../../../core/models/customer.models';
import { ToastService } from '../../services/toast.service';
import { extractApiError } from '../../utils/api-error.util';

// Alta rapida de cliente para no interrumpir un flujo en curso (ej. convertir un presupuesto
// de un prospecto sin cuenta). Solo pide lo esencial - el resto (documento, domicilio) se
// completa despues desde la pantalla de administracion de Clientes si hace falta.
@Component({
    selector: 'app-quick-customer-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
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
    saving = false;

    constructor(
        private readonly fb: FormBuilder,
        private readonly customerService: CustomerService,
        private readonly toast: ToastService
    ) {
        this.form = this.fb.group({
            firstName: ['', Validators.required],
            lastName: [''],
            phone: ['']
        });
    }

    ngOnChanges(): void {
        this.form.reset({
            firstName: this.initialFirstName,
            lastName: this.initialLastName,
            phone: this.initialPhone
        });
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

        this.saving = true;
        const raw = this.form.getRawValue();
        this.customerService.createCustomer({
            name: `${raw.firstName} ${raw.lastName}`.trim(),
            firstName: raw.firstName,
            lastName: raw.lastName,
            phone: raw.phone
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
