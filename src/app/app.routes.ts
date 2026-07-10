import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { PermissionCodes } from './core/models/permission.models';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    {
        path: 'login',
        loadComponent: () =>
            import('./features/auth/login/login.component').then(m => m.LoginComponent)
    },
    {
        path: 'register',
        loadComponent: () =>
            import('./features/auth/register/register.component').then(m => m.RegisterComponent)
    },
    {
        path: 'forgot-password',
        loadComponent: () =>
            import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
    },
    {
        path: 'dashboard',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
    },
    {
        path: 'customers',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/customers/customers.component').then(m => m.CustomersComponent)
    },
    {
        path: 'branches',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/branches/branches.component').then(m => m.BranchesComponent)
    },
    {
        path: 'products/new',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/products/products.component').then(m => m.ProductsComponent)
    },
    {
        path: 'products/:id',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/products/products.component').then(m => m.ProductsComponent)
    },
    {
        path: 'products',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/products/products.component').then(m => m.ProductsComponent)
    },
    {
        path: 'company',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/companies/company.component').then(m => m.CompanyComponent)
    },
    {
        path: 'sales',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.salesAccess },
        loadComponent: () =>
            import('./features/sales/sales-page.component').then(m => m.SalesPageComponent)
    },
    {
        path: 'sales/full',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.salesAccess },
        loadComponent: () =>
            import('./features/sales/sales-full.component').then(m => m.SalesFullComponent)
    },
    {
        path: 'sales-cc',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.salesAccess },
        loadComponent: () =>
            import('./features/sales/sales-cc/sales-cc.component').then(m => m.SalesCcComponent)
    },
    {
        path: 'clients-cc',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.salesAccess },
        loadComponent: () =>
            import('./features/clients/customer-accounts.component').then(m => m.CustomerAccountsComponent)
    },
    {
        path: 'clients-cc/customer/:customerId',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.salesAccess },
        loadComponent: () =>
            import('./features/clients/customer-account.component').then(m => m.CustomerAccountComponent)
    },
    {
        path: 'cash',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.cashAccess },
        loadComponent: () =>
            import('./features/cash/cash.component').then(m => m.CashComponent)
    },
    {
        path: 'cash/assignment',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.cashDrawerAssign },
        loadComponent: () =>
            import('./features/cash/cash-drawer-assignment/cash-drawer-assignment.component').then(m => m.CashDrawerAssignmentComponent)
    },
    {
        path: 'users',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.usersManage },
        loadComponent: () =>
            import('./features/users/users.component').then(m => m.UsersComponent)
    },
    {
        path: 'employees',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.payrollManage },
        loadComponent: () =>
            import('./features/employees/employees.component').then(m => m.EmployeesComponent)
    },
    {
        path: 'banks',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.banksManage },
        loadComponent: () =>
            import('./features/banks/banks.component').then(m => m.BanksComponent)
    },
    {
        path: 'payroll/deduction-concepts',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.payrollManage },
        loadComponent: () =>
            import('./features/payroll/deduction-concepts/deduction-concepts.component').then(m => m.DeductionConceptsComponent)
    },
    {
        path: 'payroll/advances',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.payrollAdvancesManage },
        loadComponent: () =>
            import('./features/payroll/advances/advances.component').then(m => m.AdvancesComponent)
    },
    {
        path: 'payroll/liquidations',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.payrollManage },
        loadComponent: () =>
            import('./features/payroll/liquidations/liquidations.component').then(m => m.LiquidationsComponent)
    },
    {
        path: 'cheques',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.chequesManage },
        loadComponent: () =>
            import('./features/cheques/cheques.component').then(m => m.ChequesComponent)
    },
    {
        path: 'auditoria',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsAudit },
        loadComponent: () =>
            import('./features/audit/audit.component').then(m => m.AuditComponent)
    },
    {
        path: 'reportes/ventas/control-diario',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesDailyControl },
        loadComponent: () => import('./features/reports/daily-sales-control/daily-sales-control.component').then(m => m.DailySalesControlComponent)
    },
    {
        path: 'reportes/ventas/modelo',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesModel, tipo: 'product' },
        loadComponent: () => import('./features/reports/sales/sales-report.component').then(m => m.SalesReportComponent)
    },
    {
        path: 'reportes/ventas/marca',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesBrand, tipo: 'brand' },
        loadComponent: () => import('./features/reports/sales/sales-report.component').then(m => m.SalesReportComponent)
    },
    {
        path: 'reportes/ventas/canal',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesChannel, tipo: 'channel' },
        loadComponent: () => import('./features/reports/sales/sales-report.component').then(m => m.SalesReportComponent)
    },
    {
        path: 'reportes/ventas/canal-marca',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesChannelBrand, tipo: 'channel_brand' },
        loadComponent: () => import('./features/reports/sales/sales-report.component').then(m => m.SalesReportComponent)
    },
    {
        path: 'reportes/ventas/transporte',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesTransport, tipo: 'installer' },
        loadComponent: () => import('./features/reports/sales/sales-report.component').then(m => m.SalesReportComponent)
    },
    {
        path: 'reportes/ventas/ranking',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesRanking, tipo: 'product_ranking' },
        loadComponent: () => import('./features/reports/sales/sales-report.component').then(m => m.SalesReportComponent)
    },
    {
        path: 'reportes/comparativo',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesComparison },
        loadComponent: () => import('./features/reports/comparison/comparison-report.component').then(m => m.ComparisonReportComponent)
    },
    {
        path: 'reportes/deudores',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsDebtors },
        loadComponent: () => import('./features/reports/debtors/debtors-report.component').then(m => m.DebtorsReportComponent)
    },
    {
        path: 'reportes/caja',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsCash },
        loadComponent: () => import('./features/reports/cash/cash-report.component').then(m => m.CashReportComponent)
    },
    {
        path: 'reportes/stock',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsStock },
        loadComponent: () => import('./features/reports/stock/stock-matrix.component').then(m => m.StockMatrixComponent)
    },
    {
        path: 'reportes/medios-pago',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsPayments },
        loadComponent: () => import('./features/reports/payments/payment-methods-report.component').then(m => m.PaymentMethodsReportComponent)
    },
    {
        path: 'reportes/movimientos-stock',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsStock },
        loadComponent: () => import('./features/reports/stock-movements/stock-movements-report.component').then(m => m.StockMovementsReportComponent)
    },
    {
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/profile/profile.component').then(m => m.ProfileComponent)
    },
    {
        path: 'transport',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/transport/transport.component').then(m => m.TransportComponent)
    },
    {
        path: 'suppliers',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.suppliersManage },
        loadComponent: () =>
            import('./features/suppliers/suppliers.component').then(m => m.SuppliersComponent)
    },
    {
        path: 'product-categories',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.categoriesManage },
        loadComponent: () =>
            import('./features/product-categories/product-categories.component').then(m => m.ProductCategoriesComponent)
    },
    {
        path: 'purchases',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.purchasesAccess },
        loadComponent: () =>
            import('./features/purchases/purchases-list.component').then(m => m.PurchasesListComponent)
    },
    {
        path: 'purchases/new',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.purchasesCreate },
        loadComponent: () =>
            import('./features/purchases/purchase-create.component').then(m => m.PurchaseCreateComponent)
    },
    {
        path: 'purchases/supplier/:supplierId',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.purchasesAccess },
        loadComponent: () =>
            import('./features/purchases/supplier-account.component').then(m => m.SupplierAccountComponent)
    },
    {
        path: 'purchases/:id',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.purchasesAccess },
        loadComponent: () =>
            import('./features/purchases/purchase-detail.component').then(m => m.PurchaseDetailComponent)
    },
    { path: 'clients/cc', redirectTo: 'clients-cc', pathMatch: 'full' },
    {
        path: 'customers/:id',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/customers/customer-detail/customer-detail.component').then(
                m => m.CustomerDetailComponent
            )
    },
    { path: '**', redirectTo: 'login' }
];
