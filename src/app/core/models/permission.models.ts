export const PermissionCodes = {
    salesAccess: 'sales.access',
    salesCreate: 'sales.create',
    salesUpdate: 'sales.update',
    salesDelete: 'sales.delete',
    salesPay: 'sales.pay',
    cashAccess: 'cash.access',
    cashOpen: 'cash.open',
    cashClose: 'cash.close',
    cashWithdraw: 'cash.withdraw',
    cashDrawerManage: 'cash.drawer.manage',
    cashHistoryExport: 'cash.history.export',
    usersManage: 'users.manage',
    salesPriceOverride: 'sales.override_price',
    banksManage: 'banks.manage',
    chequesManage: 'cheques.manage',
    cashDrawerAssign: 'cash.drawer.assign',
    productsViewCost: 'products.view_cost'
} as const;

export type PermissionCode = typeof PermissionCodes[keyof typeof PermissionCodes];

export const PermissionCatalog: ReadonlyArray<{ code: PermissionCode; label: string; description: string }> = [
    { code: PermissionCodes.salesAccess, label: 'Ventas: acceso', description: 'Permite ingresar al modulo de ventas.' },
    { code: PermissionCodes.salesCreate, label: 'Ventas: crear', description: 'Permite registrar ventas nuevas.' },
    { code: PermissionCodes.salesUpdate, label: 'Ventas: editar', description: 'Permite actualizar ventas existentes.' },
    { code: PermissionCodes.salesDelete, label: 'Ventas: eliminar', description: 'Permite eliminar ventas.' },
    { code: PermissionCodes.salesPay, label: 'Ventas: cobrar', description: 'Permite registrar cobros y pagos.' },
    { code: PermissionCodes.cashAccess, label: 'Caja: acceso', description: 'Permite ingresar al modulo de caja.' },
    { code: PermissionCodes.cashOpen, label: 'Caja: abrir', description: 'Permite abrir una caja.' },
    { code: PermissionCodes.cashClose, label: 'Caja: cerrar', description: 'Permite cerrar una caja.' },
    { code: PermissionCodes.cashWithdraw, label: 'Caja: retiros', description: 'Permite registrar extracciones.' },
    { code: PermissionCodes.cashDrawerManage, label: 'Caja: administrar', description: 'Permite administrar cajas y configuraciones.' },
    { code: PermissionCodes.cashHistoryExport, label: 'Caja: exportar', description: 'Permite exportar historial de caja.' },
    { code: PermissionCodes.usersManage, label: 'Usuarios: administrar', description: 'Permite gestionar usuarios y perfiles de acceso.' },
    { code: PermissionCodes.salesPriceOverride, label: 'Ventas: sobreescribir precio', description: 'Permite modificar precios durante la venta.' },
    { code: PermissionCodes.banksManage, label: 'Bancos: administrar', description: 'Permite administrar bancos.' },
    { code: PermissionCodes.chequesManage, label: 'Cheques: administrar', description: 'Permite administrar cheques.' },
    { code: PermissionCodes.cashDrawerAssign, label: 'Caja: asignar', description: 'Permite reasignar cajas entre usuarios.' },
    { code: PermissionCodes.productsViewCost, label: 'Productos: ver costo', description: 'Permite ver la columna de costo en la lista y edición de productos.' }
];
