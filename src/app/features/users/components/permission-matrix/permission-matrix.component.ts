import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { buildPermissionModules, PermissionModuleView } from '../../users-ui.models';

@Component({
  selector: 'app-permission-matrix',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permission-matrix.component.html',
  styleUrls: ['./permission-matrix.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PermissionMatrixComponent {
  @Input() permissions: ReadonlyArray<{
    code: string;
    label: string;
    description: string;
  }> = [];
  @Input() selectedCodes: readonly string[] = [];
  @Output() selectedCodesChange = new EventEmitter<string[]>();

  query = '';
  selectedOnly = false;
  expandedModules = new Set<string>();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  get modules(): PermissionModuleView[] {
    return buildPermissionModules(
      this.permissions,
      this.selectedCodes,
      this.query,
      this.selectedOnly
    );
  }

  get selectedCount(): number {
    return this.selectedCodes.length;
  }

  setQuery(query: string): void {
    this.query = query;
    this.cdr.markForCheck();
  }

  setSelectedOnly(selectedOnly: boolean): void {
    this.selectedOnly = selectedOnly;
    this.cdr.markForCheck();
  }

  togglePermission(code: string): void {
    const next = new Set(this.selectedCodes);
    next.has(code) ? next.delete(code) : next.add(code);
    this.selectedCodesChange.emit([...next]);
  }

  toggleModule(codes: string[]): void {
    const next = new Set(this.selectedCodes);
    const allSelected = codes.length > 0 && codes.every(code => next.has(code));
    codes.forEach(code => allSelected ? next.delete(code) : next.add(code));
    this.selectedCodesChange.emit([...next]);
  }

  clearModule(codes: string[]): void {
    const next = new Set(this.selectedCodes);
    codes.forEach(code => next.delete(code));
    this.selectedCodesChange.emit([...next]);
  }

  toggleExpanded(label: string): void {
    const next = new Set(this.expandedModules);
    next.has(label) ? next.delete(label) : next.add(label);
    this.expandedModules = next;
    this.cdr.markForCheck();
  }

  isExpanded(label: string): boolean {
    return this.expandedModules.has(label);
  }

  areAllSelected(module: PermissionModuleView): boolean {
    return module.codes.length > 0
      && module.codes.every(code => this.selectedCodes.includes(code));
  }

  moduleId(label: string): string {
    const slug = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `permission-module-${slug || 'general'}`;
  }

  trackModule(_: number, module: PermissionModuleView): string {
    return module.label;
  }

  trackPermission(_: number, permission: PermissionModuleView['permissions'][number]): string {
    return permission.code;
  }
}
