import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BranchService } from '../../../core/services/branch.service';
import { CashService } from '../../../core/services/cash.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../shared/services/toast.service';
import { BranchResponse } from '../../../core/models/branch.models';
import { CashDrawerResponse } from '../../../core/models/cash.models';
import { UserResponse } from '../../../core/models/user.models';

@Component({
    selector: 'app-cash-drawer-assignment',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule],
    templateUrl: './cash-drawer-assignment.component.html',
    styleUrls: ['./cash-drawer-assignment.component.css']
})
export class CashDrawerAssignmentComponent implements OnInit {
    branches: BranchResponse[] = [];
    selectedBranchId = '';
    drawers: CashDrawerResponse[] = [];
    users: UserResponse[] = [];
    drawerAssignments: Record<string, string> = {};
    saving: Record<string, boolean> = {};
    loading = false;
    loadingDrawers = false;

    constructor(
        private readonly branchService: BranchService,
        private readonly cashService: CashService,
        private readonly userService: UserService,
        private readonly toast: ToastService,
        private readonly cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.branchService.listBranches().subscribe({
            next: branches => {
                this.branches = branches;
                this.cdr.markForCheck();
            },
            error: () => {
                this.toast.error('No se pudieron cargar las sucursales');
                this.cdr.markForCheck();
            }
        });

        this.userService.listUsers().subscribe({
            next: users => {
                this.users = users.filter(u => u.isActive);
                this.cdr.markForCheck();
            },
            error: () => {
                this.toast.error('No se pudieron cargar los usuarios');
                this.cdr.markForCheck();
            }
        });
    }

    onBranchChange(): void {
        this.drawers = [];
        this.drawerAssignments = {};

        if (!this.selectedBranchId) {
            return;
        }

        this.loadingDrawers = true;
        this.cdr.markForCheck();

        this.cashService.listCashDrawers(this.selectedBranchId).subscribe({
            next: drawers => {
                this.drawers = drawers.filter(d => d.isActive);
                for (const drawer of this.drawers) {
                    this.drawerAssignments[drawer.id] = drawer.assignedUserId ?? '';
                }
                this.loadingDrawers = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.toast.error('No se pudieron cargar las cajas');
                this.loadingDrawers = false;
                this.cdr.markForCheck();
            }
        });
    }

    saveAssignment(drawer: CashDrawerResponse): void {
        this.saving = { ...this.saving, [drawer.id]: true };
        this.cdr.markForCheck();

        const userId = this.drawerAssignments[drawer.id] || null;

        this.cashService.assignCashDrawer(drawer.id, userId).subscribe({
            next: () => {
                this.saving = { ...this.saving, [drawer.id]: false };
                this.drawers = this.drawers.map(d =>
                    d.id === drawer.id ? { ...d, assignedUserId: userId } : d
                );
                const userName = userId
                    ? (this.users.find(u => u.id === userId)?.username ?? 'Usuario')
                    : 'Sin asignar';
                this.toast.success(`Caja "${drawer.name}" asignada a ${userName}`);
                this.cdr.markForCheck();
            },
            error: err => {
                this.saving = { ...this.saving, [drawer.id]: false };
                this.toast.error(err?.error?.detail ?? err?.error?.message ?? 'No se pudo guardar la asignacion');
                this.cdr.markForCheck();
            }
        });
    }

    isSaving(drawerId: string): boolean {
        return !!this.saving[drawerId];
    }

    getUserDisplayName(userId: string | null | undefined): string {
        if (!userId) {
            return 'Sin asignar';
        }
        const user = this.users.find(u => u.id === userId);
        return user ? user.username : 'Desconocido';
    }
}
