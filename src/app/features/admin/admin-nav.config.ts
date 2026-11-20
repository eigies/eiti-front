import { PermissionCodes as P } from '../../core/models/permission.models';

export interface AdminNavLink { label: string; link: string; visible?: (can: (code: string) => boolean) => boolean; }
export interface AdminNavGroup { label: string; links: AdminNavLink[]; }

/** Menú propio de Administración: Equipo, Empresa, Control y Mi cuenta. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Equipo',
    links: [
      { label: 'Usuarios y perfiles', link: '/users', visible: can => can(P.usersManage) },
      { label: 'Empleados', link: '/employees', visible: can => can(P.payrollManage) },
      { label: 'Liquidaciones', link: '/payroll/liquidations', visible: can => can(P.payrollManage) },
      { label: 'Adelantos', link: '/payroll/advances', visible: can => can(P.payrollAdvancesManage) },
      { label: 'Bonificaciones', link: '/payroll/bonuses', visible: can => can(P.payrollManage) },
      { label: 'Conceptos de descuento', link: '/payroll/deduction-concepts', visible: can => can(P.payrollManage) },
      { label: 'Conceptos de bonificación', link: '/payroll/bonus-concepts', visible: can => can(P.payrollManage) }
    ]
  },
  {
    label: 'Empresa',
    links: [
      { label: 'Datos de la empresa', link: '/company' },
      { label: 'Sucursales', link: '/branches' },
      { label: 'Facturación', link: '/fiscal-settings', visible: can => can(P.salesInvoice) }
    ]
  },
  {
    label: 'Control',
    links: [{ label: 'Auditoría', link: '/auditoria', visible: can => can(P.reportsAudit) }]
  },
  {
    label: 'Mi cuenta',
    links: [{ label: 'Mi perfil', link: '/profile' }]
  }
];
