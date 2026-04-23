import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmployeeService } from '../../core/services/employee.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { DriverResponse } from '../../core/models/employee.models';
import { FleetLogResponse, VehicleResponse } from '../../core/models/vehicle.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-transport',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transport.component.html',
  styleUrls: ['./transport.component.css']
})
export class TransportComponent implements OnInit {
  driverForm: FormGroup;
  vehicleForm: FormGroup;
  logForm: FormGroup;
  editDriverForm: FormGroup;
  drivers: DriverResponse[] = [];
  vehicles: VehicleResponse[] = [];
  logs: FleetLogResponse[] = [];
  selectedVehicleId = '';
  driversExpanded = true;
  vehiclesExpanded = true;
  activityExpanded = true;

  editingDriver: DriverResponse | null = null;
  isEditModalClosing = false;
  isSavingEdit = false;

  editingVehicle: VehicleResponse | null = null;
  isVehicleEditModalClosing = false;
  isSavingVehicleEdit = false;
  editVehicleForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private employeeService: EmployeeService,
    private vehicleService: VehicleService,
    private toast: ToastService
  ) {
    this.driverForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      documentNumber: [''],
      phone: [''],
      licenseNumber: ['', Validators.required],
      licenseExpiresAt: ['']
    });
    this.editDriverForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      documentNumber: [''],
      phone: [''],
      licenseNumber: ['', Validators.required],
      licenseExpiresAt: ['']
    });
    this.vehicleForm = this.fb.group({
      plate: ['', Validators.required],
      model: ['', Validators.required],
      brand: [''],
      year: [null],
      fuelType: [1, Validators.required],
      assignedDriverEmployeeId: ['']
    });
    this.logForm = this.fb.group({
      type: [1, Validators.required],
      occurredAt: [this.toInputDate(new Date()), Validators.required],
      odometer: [null],
      fuelLiters: [null],
      fuelCost: [null],
      description: ['', Validators.required]
    });
    this.editVehicleForm = this.fb.group({
      plate: ['', Validators.required],
      model: ['', Validators.required],
      brand: [''],
      year: [null],
      fuelType: [1, Validators.required],
      assignedDriverEmployeeId: ['']
    });
  }

  ngOnInit(): void {
    this.loadDrivers();
    this.loadVehicles();
  }

  get activeDrivers(): DriverResponse[] {
    return this.drivers.filter(driver => driver.isActive && !driver.isLicenseExpired);
  }

  get selectedVehicle(): VehicleResponse | null {
    return this.vehicles.find(vehicle => vehicle.id === this.selectedVehicleId) ?? null;
  }

  createDriver(): void {
    if (this.driverForm.invalid) {
      this.driverForm.markAllAsTouched();
      return;
    }

    const raw = this.driverForm.getRawValue();
    this.employeeService.createEmployee({
      firstName: raw.firstName,
      lastName: raw.lastName,
      documentNumber: raw.documentNumber || null,
      phone: raw.phone || null,
      email: null,
      employeeRole: 2
    }).subscribe({
      next: employee => {
        this.employeeService.upsertDriverProfile({
          employeeId: employee.id,
          licenseNumber: raw.licenseNumber,
          licenseExpiresAt: raw.licenseExpiresAt || null
        }).subscribe({
          next: () => {
            this.driverForm.reset({ firstName: '', lastName: '', documentNumber: '', phone: '', licenseNumber: '', licenseExpiresAt: '' });
            this.toast.success('Conductor creado');
            this.loadDrivers();
          },
          error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo guardar el perfil del conductor')
        });
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear el conductor')
    });
  }

  openEditModal(driver: DriverResponse): void {
    this.employeeService.getEmployee(driver.employeeId).subscribe({
      next: employee => {
        this.editingDriver = driver;
        this.isEditModalClosing = false;
        this.editDriverForm.reset({
          firstName: employee.firstName,
          lastName: employee.lastName,
          documentNumber: employee.documentNumber || '',
          phone: employee.phone || '',
          licenseNumber: driver.licenseNumber,
          licenseExpiresAt: driver.licenseExpiresAt ? driver.licenseExpiresAt.slice(0, 10) : ''
        });
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cargar el conductor')
    });
  }

  closeEditModal(): void {
    if (this.isSavingEdit) return;
    this.isEditModalClosing = true;
    setTimeout(() => {
      this.editingDriver = null;
      this.isEditModalClosing = false;
    }, 220);
  }

  saveDriverEdit(): void {
    if (!this.editingDriver || this.editDriverForm.invalid) {
      this.editDriverForm.markAllAsTouched();
      return;
    }

    this.isSavingEdit = true;
    const raw = this.editDriverForm.getRawValue();
    const driver = this.editingDriver;

    this.employeeService.updateEmployee(driver.employeeId, {
      firstName: raw.firstName,
      lastName: raw.lastName,
      documentNumber: raw.documentNumber || null,
      phone: raw.phone || null,
      email: null,
      employeeRole: 2
    }).subscribe({
      next: () => {
        this.employeeService.upsertDriverProfile({
          employeeId: driver.employeeId,
          licenseNumber: raw.licenseNumber,
          licenseExpiresAt: raw.licenseExpiresAt || null
        }).subscribe({
          next: () => {
            this.isSavingEdit = false;
            this.isEditModalClosing = true;
            setTimeout(() => {
              this.editingDriver = null;
              this.isEditModalClosing = false;
            }, 220);
            this.toast.success('Conductor actualizado');
            this.loadDrivers();
          },
          error: err => {
            this.isSavingEdit = false;
            this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el perfil del conductor');
          }
        });
      },
      error: err => {
        this.isSavingEdit = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el conductor');
      }
    });
  }

  openVehicleEditModal(vehicle: VehicleResponse): void {
    this.editingVehicle = vehicle;
    this.isVehicleEditModalClosing = false;
    this.editVehicleForm.reset({
      plate: vehicle.plate,
      model: vehicle.model,
      brand: vehicle.brand || '',
      year: vehicle.year ?? null,
      fuelType: vehicle.fuelType,
      assignedDriverEmployeeId: vehicle.assignedDriverEmployeeId || ''
    });
  }

  closeVehicleEditModal(): void {
    if (this.isSavingVehicleEdit) return;
    this.isVehicleEditModalClosing = true;
    setTimeout(() => {
      this.editingVehicle = null;
      this.isVehicleEditModalClosing = false;
    }, 220);
  }

  saveVehicleEdit(): void {
    if (!this.editingVehicle || this.editVehicleForm.invalid) {
      this.editVehicleForm.markAllAsTouched();
      return;
    }

    this.isSavingVehicleEdit = true;
    const raw = this.editVehicleForm.getRawValue();
    const vehicle = this.editingVehicle;

    this.vehicleService.updateVehicle(vehicle.id, {
      branchId: vehicle.branchId || null,
      plate: raw.plate,
      model: raw.model,
      brand: raw.brand || null,
      year: raw.year ? Number(raw.year) : null,
      fuelType: Number(raw.fuelType),
      currentOdometer: vehicle.currentOdometer ?? null,
      notes: vehicle.notes || null,
      assignedDriverEmployeeId: raw.assignedDriverEmployeeId || null
    }).subscribe({
      next: () => {
        this.isSavingVehicleEdit = false;
        this.isVehicleEditModalClosing = true;
        setTimeout(() => {
          this.editingVehicle = null;
          this.isVehicleEditModalClosing = false;
        }, 220);
        this.toast.success('Vehiculo actualizado');
        this.loadVehicles();
      },
      error: err => {
        this.isSavingVehicleEdit = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el vehiculo');
      }
    });
  }

  createVehicle(): void {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }

    const raw = this.vehicleForm.getRawValue();
    this.vehicleService.createVehicle({
      plate: raw.plate,
      model: raw.model,
      brand: raw.brand || null,
      year: raw.year ? Number(raw.year) : null,
      fuelType: Number(raw.fuelType),
      assignedDriverEmployeeId: raw.assignedDriverEmployeeId || null
    }).subscribe({
      next: () => {
        this.vehicleForm.reset({ plate: '', model: '', brand: '', year: null, fuelType: 1, assignedDriverEmployeeId: '' });
        this.toast.success('Vehiculo creado');
        this.loadVehicles();
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear el vehiculo')
    });
  }

  selectVehicle(vehicleId: string): void {
    this.selectedVehicleId = vehicleId;
    this.loadLogs();
  }

  createLog(): void {
    if (!this.selectedVehicle || this.logForm.invalid) {
      this.logForm.markAllAsTouched();
      return;
    }

    const raw = this.logForm.getRawValue();
    this.vehicleService.createLog(this.selectedVehicle.id, {
      type: Number(raw.type),
      occurredAt: new Date(raw.occurredAt).toISOString(),
      odometer: raw.odometer ? Number(raw.odometer) : null,
      fuelLiters: raw.fuelLiters ? Number(raw.fuelLiters) : null,
      fuelCost: raw.fuelCost ? Number(raw.fuelCost) : null,
      description: raw.description
    }).subscribe({
      next: () => {
        this.logForm.patchValue({ occurredAt: this.toInputDate(new Date()), odometer: null, fuelLiters: null, fuelCost: null, description: '' });
        this.toast.success('Registro de flota creado');
        this.loadVehicles();
        this.loadLogs();
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear el registro de flota')
    });
  }

  private loadDrivers(): void {
    this.employeeService.listDrivers().subscribe({
      next: drivers => this.drivers = drivers,
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los conductores')
    });
  }

  private loadVehicles(): void {
    this.vehicleService.listVehicles().subscribe({
      next: vehicles => {
        this.vehicles = vehicles;

        if (!this.selectedVehicleId && vehicles.length > 0) {
          this.selectedVehicleId = vehicles[0].id;
          this.loadLogs();
        }
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los vehiculos')
    });
  }

  private loadLogs(): void {
    if (!this.selectedVehicleId) {
      this.logs = [];
      return;
    }

    this.vehicleService.listLogs(this.selectedVehicleId).subscribe({
      next: logs => this.logs = logs,
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los registros de flota')
    });
  }

  private toInputDate(value: Date): string {
    const iso = new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString();
    return iso.slice(0, 16);
  }

  logTypeLabel(typeName: string): string {
    const labels: Record<string, string> = {
      FuelLoad: 'Carga de combustible',
      Maintenance: 'Mantenimiento',
      Inspection: 'Inspeccion',
      Incident: 'Incidente',
      Note: 'Nota'
    };

    return labels[typeName] ?? typeName;
  }
}
