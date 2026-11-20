import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiEmptyComponent } from '../../../shared/ui';
import { FiscalSettingsFacade } from '../data-access/fiscal-settings.facade';

/** Contenedor de /fiscal-settings: configuración con explicación a la izquierda y guardar por sección. */
@Component({
  selector: 'app-fiscal-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiEmptyComponent],
  providers: [FiscalSettingsFacade],
  templateUrl: './fiscal-settings-page.component.html',
  styleUrls: ['./fiscal-settings-page.component.css']
})
export class FiscalSettingsPageComponent implements OnInit {
  readonly facade = inject(FiscalSettingsFacade);

  ngOnInit(): void {
    this.facade.init();
  }
}
