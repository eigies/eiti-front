import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../shared/ui';
import { TransportFacade } from '../data-access/transport.facade';
import { DriverListComponent } from '../components/driver-list/driver-list.component';
import { DriverFormModalComponent } from '../components/transport-modals/driver-form-modal.component';
import { LogFormModalComponent } from '../components/transport-modals/log-form-modal.component';
import { VehicleFormModalComponent } from '../components/transport-modals/vehicle-form-modal.component';
import { VehicleActivityComponent } from '../components/vehicle-activity/vehicle-activity.component';
import { VehicleListComponent } from '../components/vehicle-list/vehicle-list.component';

type TransportTab = 'vehicles' | 'drivers';

/** Contenedor de /transport: Vehículos y Conductores en pestañas; altas y ediciones en popup. */
@Component({
  selector: 'app-transport-page',
  standalone: true,
  imports: [
    CommonModule, UiButtonComponent, UiCardComponent, UiEmptyComponent, VehicleListComponent, VehicleActivityComponent,
    DriverListComponent, VehicleFormModalComponent, DriverFormModalComponent, LogFormModalComponent
  ],
  providers: [TransportFacade],
  templateUrl: './transport-page.component.html',
  styleUrls: ['./transport-page.component.css']
})
export class TransportPageComponent implements OnInit {
  readonly facade = inject(TransportFacade);
  private readonly destroyRef = inject(DestroyRef);
  readonly logLabel = (typeName: string): string => this.facade.logTypeLabel(typeName);

  tab: TransportTab = 'vehicles';
  vehicleCreateOpen = false;
  driverCreateOpen = false;
  logCreateOpen = false;

  ngOnInit(): void {
    this.facade.vehicleCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.vehicleCreateOpen = false);
    this.facade.driverCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.driverCreateOpen = false);
    this.facade.logCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.logCreateOpen = false);
    this.facade.init();
  }
}
