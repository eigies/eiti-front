import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { UiCardComponent, UiEmptyComponent } from '../../../shared/ui';
import { EmployeeListComponent } from '../components/employee-list/employee-list.component';
import { SalaryModalComponent } from '../components/salary-modal/salary-modal.component';
import { EmployeesFacade } from '../data-access/employees.facade';

/** Contenedor de /employees: la nómina con sueldo base y periodicidad, edición en popup. */
@Component({
  selector: 'app-employees-page',
  standalone: true,
  imports: [CommonModule, UiCardComponent, UiEmptyComponent, EmployeeListComponent, SalaryModalComponent],
  providers: [EmployeesFacade],
  templateUrl: './employees-page.component.html',
  styleUrls: ['./employees-page.component.css']
})
export class EmployeesPageComponent implements OnInit {
  readonly facade = inject(EmployeesFacade);
  readonly periodicityOf = (value: number | null): string => this.facade.periodicityLabel(value);

  ngOnInit(): void {
    this.facade.init();
  }
}
