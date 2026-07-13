import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BonusConceptResponse } from '../../../core/models/payroll.models';
import { PermissionCodes } from '../../../core/models/permission.models';
import { AuthService } from '../../../core/services/auth.service';
import { PayrollBonusConceptService } from '../../../core/services/payroll-bonus-concept.service';
import { ToastService } from '../../../shared/services/toast.service';

type ConceptView = {
  concept: BonusConceptResponse;
  expanded: boolean;
};

@Component({
  selector: 'app-bonus-concepts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './bonus-concepts.component.html',
  styleUrls: ['./bonus-concepts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BonusConceptsComponent implements OnInit {
  readonly permissionCodes = PermissionCodes;

  createForm: FormGroup;
  editForm: FormGroup;
  concepts: ConceptView[] = [];
  editingConcept: BonusConceptResponse | null = null;
  savingCreate = false;
  savingEdit = false;
  savingToggle = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly service: PayrollBonusConceptService,
    public readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.createForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]]
    });
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]]
    });
  }

  ngOnInit(): void {
    this.loadConcepts();
  }

  get canManage(): boolean {
    return this.auth.hasPermission(PermissionCodes.payrollManage);
  }

  loadConcepts(): void {
    this.service.list(false).subscribe({
      next: concepts => {
        this.concepts = concepts.map(concept => ({ concept, expanded: false }));
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('No se pudieron cargar los conceptos de bonificación');
        this.cdr.markForCheck();
      }
    });
  }

  toggleExpand(view: ConceptView): void {
    view.expanded = !view.expanded;
  }

  startEdit(view: ConceptView): void {
    if (!this.canManage) return;
    this.editingConcept = view.concept;
    this.editForm.setValue({ name: view.concept.name });
    view.expanded = true;
  }

  cancelEdit(): void {
    this.editingConcept = null;
    this.editForm.reset({ name: '' });
  }

  submitCreate(): void {
    if (!this.canManage || this.createForm.invalid || this.savingCreate) return;
    const payload = this.formPayload(this.createForm);
    this.savingCreate = true;
    this.service.create(payload).subscribe({
      next: () => {
        this.createForm.reset({ name: '' });
        this.savingCreate = false;
        this.loadConcepts();
        this.toast.success('Concepto creado');
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingCreate = false;
        this.toast.error('Error al crear concepto');
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingEdit = false;
        this.toast.error('Error al actualizar concepto');
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingToggle = false;
        this.toast.error('Error al actualizar el estado del concepto');
        this.cdr.markForCheck();
      }
    });
  }

  trackById(_index: number, view: ConceptView): string {
    return view.concept.id;
  }

  private formPayload(form: FormGroup): { name: string } {
    return { name: String(form.get('name')?.value ?? '').trim() };
  }

  private replaceConcept(updated: BonusConceptResponse): void {
    this.concepts = this.concepts.map(view =>
      view.concept.id === updated.id ? { ...view, concept: updated } : view
    );
  }
}
