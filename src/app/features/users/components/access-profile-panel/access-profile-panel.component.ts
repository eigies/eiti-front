import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccessProfileResponse } from '../../../../core/models/access-profile.models';
import { PermissionCatalog as DefaultPermissionCatalog } from '../../../../core/models/permission.models';
import { AccessPanelMode, AccessProfileDraft } from '../../users-ui.models';
import { PermissionMatrixComponent } from '../permission-matrix/permission-matrix.component';

type PermissionCatalogEntry = Readonly<{
  code: string;
  label: string;
  description: string;
}>;

@Component({
  selector: 'app-access-profile-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PermissionMatrixComponent],
  templateUrl: './access-profile-panel.component.html',
  styleUrls: ['./access-profile-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessProfilePanelComponent implements OnChanges, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) mode!: Exclude<AccessPanelMode, 'closed'>;
  @Input() profile: AccessProfileResponse | null = null;
  @Input() permissionCatalog: ReadonlyArray<PermissionCatalogEntry> = DefaultPermissionCatalog;
  @Input() usageCount = 0;
  @Input() saving = false;

  @Output() readonly saveRequested = new EventEmitter<AccessProfileDraft>();
  @Output() readonly closeRequested = new EventEmitter<boolean>();

  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;
  @ViewChild('panelTitle') private panelTitle?: ElementRef<HTMLElement>;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]]
  });

  selectedCodes: string[] = [];
  permissionsTouched = false;

  private loadedKey = '';
  private initialCodesSnapshot = '';
  private previouslyFocusedElement: HTMLElement | null = null;
  private inertSiblings: Array<{ element: HTMLElement; wasInert: boolean }> = [];

  constructor() {
    this.form.valueChanges.subscribe(() => this.cdr.markForCheck());
  }

  get title(): string {
    return this.mode === 'create' ? 'Crear perfil' : `Editar ${this.profile?.name ?? 'perfil'}`;
  }

  get actionLabel(): string {
    if (this.saving) return 'Guardando…';
    return this.mode === 'create' ? 'Crear perfil' : 'Guardar perfil';
  }

  get permissionsDirty(): boolean {
    return this.codesSnapshot(this.selectedCodes) !== this.initialCodesSnapshot;
  }

  get isDirty(): boolean {
    return this.form.dirty || this.permissionsDirty;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const nextKey = this.mode === 'edit'
      ? `edit:${this.profile?.id ?? 'missing'}`
      : 'create';

    if (nextKey !== this.loadedKey || (changes['profile'] && !this.isDirty)) {
      this.loadedKey = nextKey;
      this.loadDraft();
    } else if (changes['saving']) {
      this.syncSavingState();
    }
  }

  ngAfterViewInit(): void {
    this.previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    this.makeBackgroundInert();
    setTimeout(() => this.panelTitle?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.restoreBackground();
    if (this.previouslyFocusedElement?.isConnected) {
      this.previouslyFocusedElement.focus();
    }
  }

  updateSelectedCodes(codes: readonly string[]): void {
    if (this.saving) return;
    this.selectedCodes = [...codes];
    this.permissionsTouched = true;
    this.cdr.markForCheck();
  }

  submit(): void {
    if (this.saving) return;

    this.form.controls.name.setValue(this.form.controls.name.value.trim(), { emitEvent: false });
    this.form.controls.description.setValue(
      this.form.controls.description.value.trim(),
      { emitEvent: false }
    );

    if (this.form.invalid || this.selectedCodes.length === 0) {
      this.form.markAllAsTouched();
      this.permissionsTouched = true;
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    this.saveRequested.emit({
      name: raw.name,
      description: raw.description || null,
      permissionCodes: [...this.selectedCodes]
    });
  }

  requestClose(): void {
    if (this.saving) return;
    this.closeRequested.emit(this.isDirty);
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (!this.saving) this.requestClose();
  }

  @HostListener('document:keydown', ['$event'])
  handleTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const panel = this.panel?.nativeElement;
    if (!panel) return;

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), '
      + 'select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

    if (!focusable.length) {
      event.preventDefault();
      this.panelTitle?.nativeElement.focus();
      return;
    }

    const active = document.activeElement;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  private loadDraft(): void {
    this.form.reset({
      name: this.profile?.name ?? '',
      description: this.profile?.description ?? ''
    }, { emitEvent: false });
    this.selectedCodes = [...(this.profile?.permissionCodes ?? [])];
    this.initialCodesSnapshot = this.codesSnapshot(this.selectedCodes);
    this.permissionsTouched = false;
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.syncSavingState();
  }

  private syncSavingState(): void {
    this.saving
      ? this.form.disable({ emitEvent: false })
      : this.form.enable({ emitEvent: false });
  }

  private codesSnapshot(codes: readonly string[]): string {
    return [...codes].sort().join('|');
  }

  private makeBackgroundInert(): void {
    let overlayPathElement: HTMLElement | null = this.panel?.nativeElement.parentElement ?? null;
    if (!overlayPathElement) return;

    this.inertSiblings = [];
    while (true) {
      const parentElement: HTMLElement | null = overlayPathElement?.parentElement ?? null;
      if (!parentElement) break;
      Array.from(parentElement.children)
        .filter((element): element is HTMLElement =>
          element instanceof HTMLElement && element !== overlayPathElement
        )
        .forEach(element => {
          this.inertSiblings.push({ element, wasInert: element.inert });
          element.inert = true;
        });
      if (parentElement === document.body) break;
      overlayPathElement = parentElement;
    }
  }

  private restoreBackground(): void {
    [...this.inertSiblings].reverse().forEach(({ element, wasInert }) => {
      element.inert = wasInert;
    });
    this.inertSiblings = [];
  }
}
