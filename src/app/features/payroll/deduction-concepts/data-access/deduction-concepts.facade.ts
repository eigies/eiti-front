import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DeductionConceptResponse } from '../../../../core/models/payroll.models';
import { PermissionCodes } from '../../../../core/models/permission.models';
import { AuthService } from '../../../../core/services/auth.service';
import { PayrollDeductionConceptService } from '../../../../core/services/payroll-deduction-concept.service';
import { ToastService } from '../../../../shared/services/toast.service';

type ConceptView = {
  concept: DeductionConceptResponse;
  expanded: boolean;
};

/**
 * Estado y reglas de los conceptos de descuento. Movido tal cual desde DeductionConceptsComponent: mismas llamadas, validaciones y mensajes.
 */
@Injectable()
export class DeductionConceptsFacade {
  readonly permissionCodes = PermissionCodes;

  createForm: FormGroup;
  editForm: FormGroup;
  concepts: ConceptView[] = [];
  editingConcept: DeductionConceptResponse | null = null;
  savingCreate = false;
  savingEdit = false;
  savingToggle = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly service: PayrollDeductionConceptService,
    public readonly auth: AuthService,
    private readonly toast: ToastService
  ) {
    this.createForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      percentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]]
    });
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      percentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]]
    });
  }

  init(): void {
    this.loadConcepts();
  }

  get canManage(): boolean {
    return this.auth.hasPermission(PermissionCodes.payrollManage);
  }

  loadConcepts(): void {
    this.service.list(false).subscribe({
      next: concepts => {
        this.concepts = concepts.map(concept => ({ concept, expanded: false }));
      },
      error: () => {
        this.toast.error('No se pudieron cargar los conceptos de descuento');
      }
    });
  }

  toggleExpand(view: ConceptView): void {
    view.expanded = !view.expanded;
  }

  startEdit(view: ConceptView): void {
    if (!this.canManage) return;
    this.editingConcept = view.concept;
    this.editForm.setValue({
      name: view.concept.name,
      percentage: view.concept.percentage
    });
    view.expanded = true;
  }

  cancelEdit(): void {
    this.editingConcept = null;
    this.editForm.reset({ name: '', percentage: 0 });
  }

  submitCreate(): void {
    if (!this.canManage || this.createForm.invalid || this.savingCreate) return;
    const payload = this.formPayload(this.createForm);
    this.savingCreate = true;
    this.service.create(payload).subscribe({
      next: () => {
        this.createForm.reset({ name: '', percentage: 0 });
        this.savingCreate = false;
        this.loadConcepts();
        this.toast.success('Concepto creado');
      },
      error: () => {
        this.savingCreate = false;
        this.toast.error('Error al crear concepto');
      }
    });
  }

  submitEdit(): void {
    if (!this.canManage || !this.editingConcept || this.editForm.invalid || this.savingEdit) return;
    const id = this.editingConcept.id;
    this.savingEdit = true;
    this.service.update(id, this.formPayload(this.editForm)).subscribe({
      next: updated => {
        this.replaceConcept(updated);
        this.editingConcept = null;
        this.savingEdit = false;
        this.toast.success('Concepto actualizado');
      },
      error: () => {
        this.savingEdit = false;
        this.toast.error('Error al actualizar concepto');
      }
    });
  }

  toggleActive(view: ConceptView): void {
    if (!this.canManage || this.savingToggle) return;
    this.savingToggle = true;
    this.service.setActive(view.concept.id, !view.concept.isActive).subscribe({
      next: updated => {
        this.replaceConcept(updated);
        this.savingToggle = false;
        this.toast.success(updated.isActive ? 'Concepto activado' : 'Concepto desactivado');
      },
      error: () => {
        this.savingToggle = false;
        this.toast.error('Error al actualizar el estado del concepto');
      }
    });
  }

  trackById(_index: number, view: ConceptView): string {
    return view.concept.id;
  }

  private formPayload(form: FormGroup): { name: string; percentage: number } {
    return {
      name: String(form.get('name')?.value ?? '').trim(),
      percentage: Number(form.get('percentage')?.value ?? 0)
    };
  }

  private replaceConcept(updated: DeductionConceptResponse): void {
    this.concepts = this.concepts.map(view =>
      view.concept.id === updated.id ? { ...view, concept: updated } : view
    );
  }
}
