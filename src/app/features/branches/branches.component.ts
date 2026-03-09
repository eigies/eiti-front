import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { BranchResponse } from '../../core/models/branch.models';
import { BranchService } from '../../core/services/branch.service';
import { ToastService } from '../../shared/services/toast.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';

type BranchView = {
  branch: BranchResponse;
  expanded: boolean;
};

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavbarComponent, OnboardingBannerComponent],
  templateUrl: './branches.component.html',
  styleUrls: ['./branches.component.css']
})
export class BranchesComponent implements OnInit {
  createForm: FormGroup;
  editForm: FormGroup;
  branches: BranchView[] = [];
  editingBranch: BranchResponse | null = null;
  savingCreate = false;
  savingEdit = false;
  onboardingStatus: OnboardingStatusResponse | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly branchService: BranchService,
    private readonly toast: ToastService,
    private readonly onboardingService: OnboardingService,
    private readonly router: Router
  ) {
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      code: [''],
      address: ['']
    });
    this.editForm = this.fb.group({
      name: ['', Validators.required],
      code: [''],
      address: ['']
    });
  }

  ngOnInit(): void {
    this.refreshOnboarding();
    this.loadBranches();
  }

  get isOnboardingStep(): boolean {
    return !!this.onboardingStatus && !this.onboardingStatus.isCompleted && this.onboardingStatus.nextStep === 'Branch';
  }

  get isOnboardingFocusLocked(): boolean {
    return this.isOnboardingStep && !this.onboardingService.isStepAccepted('Branch');
  }

  loadBranches(expandBranchId?: string): void {
    this.branchService.listBranches().subscribe({
      next: branches => {
        const expandedMap = new Map(this.branches.map(item => [item.branch.id, item.expanded]));
        this.branches = branches.map(branch => ({
          branch,
          expanded: branch.id === expandBranchId ? true : (expandedMap.get(branch.id) ?? false)
        }));
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar las sucursales')
    });
  }

  createBranch(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.savingCreate = true;
    this.branchService.createBranch(this.createForm.getRawValue()).subscribe({
      next: () => {
        this.createForm.reset({ name: '', code: '', address: '' });
        this.savingCreate = false;
        this.loadBranches();
        this.toast.success('Sucursal creada');
        this.refreshOnboarding(true);
      },
      error: err => {
        this.savingCreate = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear la sucursal');
      }
    });
  }

  beginEdit(branch: BranchResponse): void {
    this.editingBranch = branch;
    this.editForm.reset({
      name: branch.name,
      code: branch.code || '',
      address: branch.address || ''
    });
  }

  saveEdit(): void {
    if (!this.editingBranch || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.savingEdit = true;
    this.branchService.updateBranch(this.editingBranch.id, this.editForm.getRawValue()).subscribe({
      next: () => {
        const editedBranchId = this.editingBranch?.id;
        this.savingEdit = false;
        this.editingBranch = null;
        this.loadBranches(editedBranchId);
        this.toast.success('Sucursal actualizada');
      },
      error: err => {
        this.savingEdit = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar la sucursal');
      }
    });
  }

  closeEdit(): void {
    if (this.savingEdit) {
      return;
    }

    this.editingBranch = null;
  }

  toggleBranch(branchId: string, forceExpand?: boolean): void {
    this.branches = this.branches.map(item =>
      item.branch.id === branchId
        ? { ...item, expanded: forceExpand ?? !item.expanded }
        : item
    );
  }

  acceptOnboardingStep(): void {
    this.onboardingService.acceptStep('Branch');
  }

  private refreshOnboarding(force = false): void {
    this.onboardingService.fetchStatus(force).subscribe({
      next: status => {
        this.onboardingStatus = status;
        const nextRoute = this.onboardingService.routeForStep(status.nextStep);

        if (!status.isCompleted && nextRoute && nextRoute !== '/branches') {
          this.router.navigate([nextRoute]);
        }
      }
    });
  }
}
