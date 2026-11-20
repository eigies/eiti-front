import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { UiButtonComponent } from '../../../shared/ui';
import { CompanyFacade } from '../data-access/company.facade';

/** Contenedor de /company: configuración con explicación a la izquierda y guardar por sección. */
@Component({
  selector: 'app-company-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiButtonComponent],
  providers: [CompanyFacade],
  templateUrl: './company-page.component.html',
  styleUrls: ['./company-page.component.css']
})
export class CompanyPageComponent implements OnInit {
  readonly facade = inject(CompanyFacade);

  ngOnInit(): void {
    this.facade.init();
  }
}
