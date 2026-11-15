import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionCodes } from '../../../core/models/permission.models';

interface ReportLink { title: string; hint: string; link: string; permission: string; }
interface ReportGroup { label: string; tone: 'sale' | 'neutral' | 'in'; reports: ReportLink[]; }

const P = PermissionCodes;

const REPORT_GROUPS: ReportGroup[] = [
  {
    label: 'Ventas', tone: 'sale', reports: [
      { title: 'Control diario de ventas', hint: 'Lo vendido en el día, por sucursal y medio de pago.', link: '/reportes/ventas/control-diario', permission: P.reportsSalesDailyControl },
      { title: 'Ventas por cliente', hint: 'Lo que compró cada cliente mayorista.', link: '/reportes/ventas/mayorista-cliente', permission: P.reportsWholesaleByCustomer },
      { title: 'Ventas por modelo', hint: 'Unidades e importes por modelo.', link: '/reportes/ventas/modelo', permission: P.reportsSalesModel },
      { title: 'Ventas por marca', hint: 'Qué marcas se venden más.', link: '/reportes/ventas/marca', permission: P.reportsSalesBrand },
      { title: 'Ventas por canal', hint: 'Mostrador, redes, Mercado Libre y demás.', link: '/reportes/ventas/canal', permission: P.reportsSalesChannel },
      { title: 'Ventas por canal y marca', hint: 'El cruce de los dos anteriores.', link: '/reportes/ventas/canal-marca', permission: P.reportsSalesChannelBrand },
      { title: 'Ventas por instalador o vehículo', hint: 'Trabajos de cada instalador y vehículo.', link: '/reportes/ventas/transporte', permission: P.reportsSalesTransport },
      { title: 'Ranking de artículos', hint: 'Los más vendidos del período.', link: '/reportes/ventas/ranking', permission: P.reportsSalesRanking },
      { title: 'Comparativo', hint: 'Un período contra otro.', link: '/reportes/comparativo', permission: P.reportsSalesComparison },
      { title: 'Canjes por sucursal', hint: 'Productos recibidos en parte de pago.', link: '/reportes/ventas/canjes', permission: P.reportsSalesTradeIns },
      { title: 'Descuentos', hint: 'Descuentos dados y quién los hizo.', link: '/reportes/ventas/descuentos', permission: P.reportsSalesDiscounts }
    ]
  },
  {
    label: 'Stock', tone: 'neutral', reports: [
      { title: 'Stock por sucursal', hint: 'Cuánto hay de cada producto y dónde.', link: '/reportes/stock', permission: P.reportsStock },
      { title: 'Movimientos de stock', hint: 'Entradas, salidas y traslados.', link: '/reportes/movimientos-stock', permission: P.reportsStock }
    ]
  },
  {
    label: 'Finanzas', tone: 'in', reports: [
      { title: 'Clientes deudores', hint: 'Quién debe y desde cuándo.', link: '/reportes/deudores', permission: P.reportsDebtors },
      { title: 'Caja por motivo', hint: 'Ingresos y egresos de caja agrupados.', link: '/reportes/caja', permission: P.reportsCash },
      { title: 'Medios de pago', hint: 'Cómo te pagaron en el período.', link: '/reportes/medios-pago', permission: P.reportsPayments }
    ]
  }
];

/** Índice de reportes: la entrada "Reportes" del menú abre esta página. */
@Component({
  selector: 'app-reports-index',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './reports-index.component.html',
  styleUrls: ['./reports-index.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsIndexComponent {
  readonly groups: ReportGroup[];

  constructor(auth: AuthService) {
    this.groups = REPORT_GROUPS
      .map(group => ({ ...group, reports: group.reports.filter(report => auth.hasPermission(report.permission)) }))
      .filter(group => group.reports.length > 0);
  }
}
