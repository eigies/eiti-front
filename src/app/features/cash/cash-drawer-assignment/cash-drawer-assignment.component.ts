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
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';

@Component({
    selector: 'app-cash-drawer-assignment',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, SearchableSelectComponent],
    templateUrl: './cash-drawer-assignment.component.html',
    styleUrls: ['./cash-drawer-assignment.component.css']
})
export class CashDrawerAssignmentComponent implements OnInit {
    branches: BranchResponse[] = [];
    selectedBranchId = '';
    drawers: CashDrawerResponse[] = [];
    users: UserResponse[] = [];
    drawerAssignments: Record<string, string[]> = {};
    saving: Record<string, boolean> = {};
    selectValue: Record<string, string> = {};
    loading = false;
    loadingDrawers = false;

    get branchOptions(): SearchableSelectOption[] {
        return this.branches.map(branch => ({
            value: branch.id,
            label: branch.name
        }));
    }

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
                    this.drawerAssignments[drawer.id] = [...(drawer.assignedUserIds ?? (drawer.assignedUserId ? [drawer.assignedUserId] : []))];
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

        const userIds = [...(this.drawerAssignments[drawer.id] ?? [])];

        this.cashService.assignCashDrawer(drawer.id, userIds).subscribe({
            next: () => {
                this.saving = { ...this.saving, [drawer.id]: false };
                this.syncDrawerAssignments(drawer.id, userIds);
                const label = userIds.length > 0
                    ? `${userIds.length} usuario${userIds.length === 1 ? '' : 's'}`
                    : 'sin usuarios';
                this.toast.success(`Caja "${drawer.name}" actualizada con ${label}`);
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

    toggleUser(drawerId: string, userId: string, checked: boolean): void {
        const current = new Set(this.drawerAssignments[drawerId] ?? []);
        if (checked) {
            current.add(userId);
        } else {
            current.delete(userId);
        }

        this.drawerAssignments = {
            ...this.drawerAssignments,
            [drawerId]: Array.from(current)
        };
    }

    isUserAssigned(drawerId: string, userId: string): boolean {
        return (this.drawerAssignments[drawerId] ?? []).includes(userId);
    }

    availableUsers(drawerId: string): UserResponse[] {
        const assigned = new Set(this.drawerAssignments[drawerId] ?? []);
        return this.users.filter(u => !assigned.has(u.id));
    }

    availableUserOptions(drawerId: string): SearchableSelectOption[] {
        return this.availableUsers(drawerId).map(user => ({
            value: user.id,
            label: user.username
        }));
    }

    assignedUsersFor(drawerId: string): UserResponse[] {
        const ids = this.drawerAssignments[drawerId] ?? [];
        return ids
            .map(id => this.users.find(u => u.id === id) ?? null)
            .filter((u): u is UserResponse => u !== null);
    }

    addUser(drawerId: string, userId: string): void {
        if (!userId) return;
        this.toggleUser(drawerId, userId, true);
        this.selectValue = { ...this.selectValue, [drawerId]: '' };
        this.cdr.markForCheck();
    }

    getAssignedUsers(drawer: CashDrawerResponse): UserResponse[] {
        const ids = drawer.assignedUserIds ?? (drawer.assignedUserId ? [drawer.assignedUserId] : []);
        return ids
            .map(userId => this.users.find(user => user.id === userId) ?? null)
            .filter((user): user is UserResponse => user !== null);
    }

    getUserDisplayName(userId: string | null | undefined): string {
        if (!userId) {
            return 'Sin asignar';
        }
        const user = this.users.find(u => u.id === userId);
        return user ? user.username : 'Desconocido';
    }

    private syncDrawerAssignments(savedDrawerId: string, userIds: string[]): void {
        const userSet = new Set(userIds);

        this.drawers = this.drawers.map(drawer => {
            if (drawer.id === savedDrawerId) {
                return {
                    ...drawer,
                    assignedUserId: userIds[0] ?? null,
                    assignedUserIds: [...userIds]
                };
            }

            const remainingUserIds = (drawer.assignedUserIds ?? (drawer.assignedUserId ? [drawer.assignedUserId] : []))
                .filter(existingUserId => !userSet.has(existingUserId));

            return {
                ...drawer,
                assignedUserId: remainingUserIds[0] ?? null,
                assignedUserIds: remainingUserIds
            };
        });

        const nextAssignments: Record<string, string[]> = {};
        for (const drawer of this.drawers) {
            nextAssignments[drawer.id] = [...(drawer.assignedUserIds ?? (drawer.assignedUserId ? [drawer.assignedUserId] : []))];
        }
        this.drawerAssignments = nextAssignments;
    }
}
