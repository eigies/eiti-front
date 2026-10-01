import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { BranchResponse, formatPointOfSale } from '../../core/models/branch.models';
import {
    FiscalPointOfSaleResponse,
    FiscalSettingsResponse,
    ISSUER_IVA_CONDITIONS,
    formatCuit
} from '../../core/models/fiscal-settings.models';
import { PermissionCodes } from '../../core/models/permission.models';
import { AuthService } from '../../core/services/auth.service';
import { BranchService } from '../../core/services/branch.service';
import { FiscalSettingsService } from '../../core/services/fiscal-settings.service';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { ToastService } from '../../shared/services/toast.service';

/** Dias antes del vencimiento del certificado en que se avisa. */
const CERTIFICATE_WARNING_DAYS = 30;

/**
 * Pantalla "Facturacion electronica": si la empresa factura sola, los datos del emisor que van
 * impresos en la factura y los puntos de venta de ARCA, cada uno atado a su sucursal (1:1).
 */
@Component({
    selector: 'app-fiscal-settings',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, SearchableSelectComponent],
    templateUrl: './fiscal-settings.component.html',
    styleUrls: ['../../shared/styles/config-page.css', './fiscal-settings.component.css']
})
export class FiscalSettingsComponent implements OnInit {
    readonly ivaOptions: SearchableSelectOption[] = ISSUER_IVA_CONDITIONS.map(c => ({ value: c.value, label: c.label }));
    readonly issuerForm: FormGroup;
    readonly canConfigure: boolean;
    savingAutomatic = false;

    settings: FiscalSettingsResponse | null = null;
    branches: BranchResponse[] = [];
    loading = false;
    savingIssuer = false;
    /** Punto de venta con un cambio en curso (asignar o borrar), para no pisar dos pedidos. */
    busyPointOfSaleId: string | null = null;
    newNumber: number | null = null;
    newBranchId: string | null = null;
    creating = false;

    private readonly destroyRef = inject(DestroyRef);

    constructor(
        private readonly fb: FormBuilder,
        private readonly fiscalSettings: FiscalSettingsService,
        private readonly branchService: BranchService,
        private readonly confirmation: ConfirmationService,
        private readonly toast: ToastService,
        auth: AuthService
    ) {
        this.canConfigure = auth.hasPermission(PermissionCodes.salesInvoice);
        this.issuerForm = this.fb.group({
            legalName: ['', [Validators.required, Validators.maxLength(250)]],
            ivaCondition: [1, Validators.required],
            iibb: ['', Validators.maxLength(32)],
            activityStartDate: ['', Validators.required],
            commercialAddress: ['', Validators.maxLength(250)]
        });
    }

    ngOnInit(): void {
        if (this.canConfigure) {
            this.load();
        }
    }

    get today(): string {
        return new Date().toLocaleDateString('en-CA');
    }

    cuitLabel(cuit: string): string {
        return formatCuit(cuit);
    }

    pointOfSaleLabel(number: number): string {
        return formatPointOfSale(number);
    }

    /** Dias que le quedan al certificado; null si no se sabe (vive en variables de entorno). */
    get certificateDaysLeft(): number | null {
        const notAfter = this.settings?.issuer?.certificateNotAfter;
        return notAfter ? Math.floor((new Date(notAfter).getTime() - Date.now()) / 86_400_000) : null;
    }

    get certificateExpiresSoon(): boolean {
        const days = this.certificateDaysLeft;
        return days !== null && days <= CERTIFICATE_WARNING_DAYS;
    }

    isInvalid(field: string): boolean {
        const control = this.issuerForm.get(field);
        return !!(control && control.invalid && (control.dirty || control.touched));
    }

    /** Sucursales que se le pueden dar a un punto de venta: las libres y la que ya tiene. */
    branchOptions(pointOfSale: FiscalPointOfSaleResponse | null): SearchableSelectOption[] {
        const free = this.branches.filter(b => !b.fiscalPointOfSaleId || b.fiscalPointOfSaleId === pointOfSale?.id);
        return [{ value: null, label: 'Sin sucursal' }, ...free.map(b => ({ value: b.id, label: b.name }))];
    }

    saveIssuer(): void {
        if (this.issuerForm.invalid) {
            this.issuerForm.markAllAsTouched();
            return;
        }

        const raw = this.issuerForm.getRawValue();
        this.savingIssuer = true;
        this.fiscalSettings.updateIssuer({
            legalName: String(raw.legalName).trim(),
            ivaCondition: Number(raw.ivaCondition),
            iibb: this.nullIfEmpty(raw.iibb),
            activityStartDate: raw.activityStartDate,
            commercialAddress: this.nullIfEmpty(raw.commercialAddress)
        }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: issuer => {
                if (this.settings) {
                    this.settings = { ...this.settings, issuer };
                }
                this.patchIssuer();
                this.savingIssuer = false;
                this.toast.success('Datos fiscales guardados');
            },
            error: err => {
                this.savingIssuer = false;
                this.toast.error(this.errorMessage(err, 'No se pudieron guardar los datos fiscales'));
            }
        });
    }

    /** Se guarda al tocarlo, igual que los puntos de venta: no hay nada mas que confirmar. */
    setAutomaticInvoicing(event: Event): void {
        const input = event.target as HTMLInputElement;
        const enabled = input.checked;
        this.savingAutomatic = true;
        this.fiscalSettings.setAutomaticInvoicing(enabled)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.savingAutomatic = false;
                    if (this.settings) {
                        this.settings = { ...this.settings, automaticInvoicing: enabled };
                    }
                    this.toast.success(enabled ? 'Facturación automática activada' : 'Facturación automática desactivada');
                },
                error: err => {
                    this.savingAutomatic = false;
                    input.checked = !enabled;
                    this.toast.error(this.errorMessage(err, 'No se pudo cambiar la facturación automática'));
                }
            });
    }

    addPointOfSale(): void {
        const number = Number(this.newNumber);
        if (!Number.isInteger(number) || number < 1 || number > 99999) {
            this.toast.error('El punto de venta tiene que ser un número entre 1 y 99999.');
            return;
        }

        this.creating = true;
        this.fiscalSettings.createPointOfSale({ number, branchId: this.newBranchId })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: created => {
                    this.creating = false;
                    this.newNumber = null;
                    this.newBranchId = null;
                    this.toast.success(created.branchName
                        ? `Punto de venta ${formatPointOfSale(created.number)} cargado para ${created.branchName}`
                        : `Punto de venta ${formatPointOfSale(created.number)} cargado`);
                    this.load();
                },
                error: err => {
                    this.creating = false;
                    this.toast.error(this.errorMessage(err, 'No se pudo cargar el punto de venta'));
                }
            });
    }

    async assign(pointOfSale: FiscalPointOfSaleResponse, branchId: string | null): Promise<void> {
        if (branchId === pointOfSale.branchId || this.busyPointOfSaleId) {
            return;
        }

        // Sacarlo de una sucursal la deja sin poder facturar: se confirma.
        if (pointOfSale.branchId) {
            const confirmed = await this.confirmation.confirm({
                eyebrow: 'Facturación electrónica',
                title: branchId ? 'Mover punto de venta' : 'Dejar sin punto de venta',
                message: `La sucursal ${pointOfSale.branchName} deja de poder facturar hasta que le asignes otro punto de venta.`,
                confirmLabel: branchId ? 'Mover' : 'Quitar',
                tone: 'warning'
            });
            if (!confirmed) {
                this.load();
                return;
            }
        }

        this.busyPointOfSaleId = pointOfSale.id;
        this.fiscalSettings.assignPointOfSale(pointOfSale.id, branchId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.busyPointOfSaleId = null;
                    this.load();
                },
                error: err => {
                    this.busyPointOfSaleId = null;
                    this.toast.error(this.errorMessage(err, 'No se pudo asignar el punto de venta'));
                    this.load();
                }
            });
    }

    async remove(pointOfSale: FiscalPointOfSaleResponse): Promise<void> {
        if (this.busyPointOfSaleId) {
            return;
        }

        const confirmed = await this.confirmation.confirm({
            eyebrow: 'Facturación electrónica',
            title: 'Borrar punto de venta',
            message: `Vas a borrar el punto de venta ${formatPointOfSale(pointOfSale.number)}.`,
            detail: 'Las facturas ya emitidas con ese número no cambian.',
            confirmLabel: 'Borrar',
            tone: 'danger'
        });
        if (!confirmed) {
            return;
        }

        this.busyPointOfSaleId = pointOfSale.id;
        this.fiscalSettings.deletePointOfSale(pointOfSale.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.busyPointOfSaleId = null;
                    this.load();
                },
                error: err => {
                    this.busyPointOfSaleId = null;
                    this.toast.error(this.errorMessage(err, 'No se pudo borrar el punto de venta'));
                }
            });
    }

    private load(): void {
        this.loading = this.settings === null;
        forkJoin({ settings: this.fiscalSettings.get(), branches: this.branchService.listBranches() })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ settings, branches }) => {
                    this.settings = settings;
                    this.branches = branches;
                    this.loading = false;
                    this.patchIssuer();
                },
                error: err => {
                    this.loading = false;
                    this.toast.error(this.errorMessage(err, 'No se pudo cargar la facturación electrónica'));
                }
            });
    }

    private patchIssuer(): void {
        const issuer = this.settings?.issuer;
        if (!issuer) {
            return;
        }
        this.issuerForm.reset({
            legalName: issuer.legalName,
            ivaCondition: issuer.ivaCondition,
            iibb: issuer.iibb ?? '',
            activityStartDate: issuer.activityStartDate,
            commercialAddress: issuer.commercialAddress ?? ''
        });
    }

    private nullIfEmpty(value: string | null | undefined): string | null {
        return value && value.trim().length > 0 ? value.trim() : null;
    }

    private errorMessage(err: { error?: { detail?: string; message?: string } } | null, fallback: string): string {
        return err?.error?.detail || err?.error?.message || fallback;
    }
}
