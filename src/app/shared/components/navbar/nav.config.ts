import { PermissionCodes } from '../../../core/models/permission.models';

/** Chequeo de permisos que recibe cada entrada del menú (AuthService.hasPermission). */
export type PermissionCheck = (code: string) => boolean;

export interface NavChild {
  label: string;
  link: string;
  exact?: boolean;
  visible?: (can: PermissionCheck) => boolean;
}

export interface NavItem {
  label: string;
  icon: string;
  /** Destino fijo; si falta se usa el primer hijo visible. */
  link?: string;
  exact?: boolean;
  /** Prefijos de ruta que marcan la entrada como activa. */
  match: string[];
  visible?: (can: PermissionCheck) => boolean;
  children?: NavChild[];
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const P = PermissionCodes;

export const PAYROLL_PERMISSIONS = [P.payrollManage, P.payrollAdvancesManage, P.payrollLiquidationsGenerate, P.payrollLiquidationsPay];

export const REPORT_PERMISSIONS = [
  P.reportsSalesModel, P.reportsSalesComparison, P.reportsSalesTransport, P.reportsSalesChannel,
  P.reportsSalesChannelBrand, P.reportsSalesBrand, P.reportsSalesRanking, P.reportsSalesDailyControl,
  P.reportsDebtors, P.reportsCash, P.reportsStock, P.reportsPayments, P.reportsWholesaleByCustomer,
  P.reportsSalesTradeIns, P.reportsSalesDiscounts
];

/** Menú EITI 2: mismas rutas y permisos de siempre, agrupados en 13 entradas. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ label: 'Inicio', icon: 'home', link: '/dashboard', exact: true, match: ['/dashboard'] }]
  },
  {
    label: 'Operación',
    items: [
      {
        label: 'Ventas', icon: 'sales', match: ['/sales', '/sales-cc'],
        visible: can => can(P.salesAccess),
        children: [
          { label: 'Mostrador', link: '/sales', exact: true },
          { label: 'Venta guiada', link: '/sales/full' },
          { label: 'Cuenta corriente', link: '/sales-cc' }
        ]
      },
      {
        label: 'Presupuestos', icon: 'quotes', link: '/quotes', match: ['/quotes'],
        visible: can => can(P.salesAccess) && can(P.quotesAccess)
      },
      {
        label: 'Caja', icon: 'cash', match: ['/cash'],
        visible: can => can(P.cashAccess),
        children: [
          { label: 'Caja', link: '/cash', exact: true },
          { label: 'Asignación', link: '/cash/assignment', visible: can => can(P.cashDrawerAssign) }
        ]
      },
      {
        label: 'Clientes', icon: 'customers', match: ['/customers', '/clients-cc', '/clients'],
        children: [
          { label: 'Clientes', link: '/customers', exact: true },
          { label: 'Cuenta corriente', link: '/clients-cc' }
        ]
      },
      {
        label: 'Productos', icon: 'products', match: ['/products', '/product-categories'],
        children: [
          { label: 'Productos', link: '/products' },
          { label: 'Categorías', link: '/product-categories', visible: can => can(P.categoriesManage) }
        ]
      },
      {
        label: 'Compras', icon: 'purchases', match: ['/purchases', '/suppliers'],
        visible: can => can(P.purchasesAccess) || can(P.suppliersManage),
        children: [
          { label: 'Compras', link: '/purchases', exact: true, visible: can => can(P.purchasesAccess) },
          { label: 'Proveedores', link: '/suppliers', visible: can => can(P.suppliersManage) }
        ]
      },
      { label: 'Transporte', icon: 'transport', link: '/transport', match: ['/transport'] },
      {
        label: 'Sueldos', icon: 'payroll', match: ['/employees', '/payroll'],
        visible: can => PAYROLL_PERMISSIONS.some(code => can(code)),
        children: [
          { label: 'Empleados', link: '/employees', visible: can => can(P.payrollManage) },
          { label: 'Adelantos', link: '/payroll/advances', visible: can => can(P.payrollAdvancesManage) },
          { label: 'Liquidaciones', link: '/payroll/liquidations', visible: can => can(P.payrollManage) },
          { label: 'Bonificaciones', link: '/payroll/bonuses', visible: can => can(P.payrollManage) },
          { label: 'Conceptos de descuento', link: '/payroll/deduction-concepts', visible: can => can(P.payrollManage) },
          { label: 'Conceptos de bonificación', link: '/payroll/bonus-concepts', visible: can => can(P.payrollManage) }
        ]
      }
    ]
  },
  {
    label: 'Tesorería',
    items: [
      { label: 'Bancos', icon: 'banks', link: '/banks', match: ['/banks'], visible: can => can(P.banksManage) },
      { label: 'Cheques', icon: 'cheques', link: '/cheques', match: ['/cheques'], visible: can => can(P.chequesManage) }
    ]
  },
  {
    label: 'Análisis',
    items: [
      {
        label: 'Reportes', icon: 'reports', link: '/reportes', match: ['/reportes'],
        visible: can => REPORT_PERMISSIONS.some(code => can(code))
      }
    ]
  },
  {
    label: 'Configuración',
    items: [
      {
        label: 'Administración', icon: 'admin', match: ['/company', '/branches', '/fiscal-settings', '/users', '/auditoria'],
        children: [
          { label: 'Empresa', link: '/company' },
          { label: 'Sucursales', link: '/branches' },
          { label: 'Facturación', link: '/fiscal-settings', visible: can => can(P.salesInvoice) },
          { label: 'Usuarios y perfiles', link: '/users', visible: can => can(P.usersManage) },
          { label: 'Auditoría', link: '/auditoria', visible: can => can(P.reportsAudit) }
        ]
      }
    ]
  }
];
