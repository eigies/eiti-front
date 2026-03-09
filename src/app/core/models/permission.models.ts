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
    usersManage: 'users.manage'
} as const;

export type PermissionCode = typeof PermissionCodes[keyof typeof PermissionCodes];
