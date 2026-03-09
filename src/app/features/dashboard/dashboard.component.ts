import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WeatherService } from '../../core/services/weather.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { AuthResponse } from '../../core/models/auth.models';
import { PermissionCodes } from '../../core/models/permission.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly permissionCodes = PermissionCodes;
  user: AuthResponse | null = null;
  currentDate = new Date();
  weatherTitle = 'Buscando ubicacion...';
  weatherDescription = 'Permite acceso a tu ubicacion para ver el clima actual.';
  weatherLoading = true;
  private clockId?: ReturnType<typeof setInterval>;

  tickers = Array.from({ length: 12 }, () =>
    'EITI CLIENT MANAGEMENT | DAILY OVERVIEW | READY TO OPERATE |'
  );

  constructor(
    public auth: AuthService,
    private weather: WeatherService
  ) { }

  get currentDateLabel(): string {
    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(this.currentDate);
  }

  get currentTimeLabel(): string {
    return new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(this.currentDate);
  }

  get timezoneLabel(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  get dayMoment(): string {
    const hour = this.currentDate.getHours();

    if (hour < 12) {
      return 'Manana operativa';
    }

    if (hour < 19) {
      return 'Ventana comercial activa';
    }

    return 'Cierre y seguimiento';
  }

  get focusHint(): string {
    const hour = this.currentDate.getHours();

    if (hour < 12) {
      return 'Abrir ventas pendientes y actualizar pipeline';
    }

    if (hour < 19) {
      return 'Priorizar cierres, cobros y seguimiento';
    }

    return 'Revisar resultados y dejar listo el proximo dia';
  }

  ngOnInit(): void {
    this.user = this.auth.currentUser;
    this.clockId = setInterval(() => {
      this.currentDate = new Date();
    }, 1000);
    this.loadWeather();
  }

  ngOnDestroy(): void {
    if (this.clockId) {
      clearInterval(this.clockId);
    }
  }

  private loadWeather(): void {
    if (!('geolocation' in navigator)) {
      this.weatherTitle = 'Clima no disponible';
      this.weatherDescription = 'Tu navegador no soporta geolocalizacion.';
      this.weatherLoading = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.weather.getCurrentWeather(coords.latitude, coords.longitude).subscribe({
          next: (response) => {
            const current = response.current;
            this.weatherTitle = `${Math.round(current.temperature_2m)} C - ${this.weather.describe(current.weather_code)}`;
            this.weatherDescription = `Sensacion ${Math.round(current.apparent_temperature)} C - ${current.is_day === 1 ? 'De dia' : 'De noche'}`;
            this.weatherLoading = false;
          },
          error: () => {
            this.weatherTitle = 'Clima no disponible';
            this.weatherDescription = 'No se pudo consultar el servicio meteorologico.';
            this.weatherLoading = false;
          }
        });
      },
      () => {
        this.weatherTitle = 'Ubicacion no compartida';
        this.weatherDescription = 'Activa la ubicacion para consultar el clima local.';
        this.weatherLoading = false;
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }
}
