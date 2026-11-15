import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { PermissionCodes } from './core/models/permission.models';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    {
        // Administración: menú propio a la izquierda; cada pantalla conserva su ruta y sus permisos.
        path: '',
        loadComponent: () => import('./features/admin/admin-shell.component').then(m => m.AdminShellComponent),
        children: [
            {
                path: 'fiscal-settings',
                canActivate: [authGuard, permissionGuard],
                data: { permission: PermissionCodes.salesInvoice },
                loadComponent: () =>
                    import('./features/fiscal-settings/pages/fiscal-settings-page.component').then(m => m.FiscalSettingsPageComponent)
            },
            {
                path: 'branches',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('./features/branches/pages/branches-page.component').then(m => m.BranchesPageComponent)
            },
            {
                path: 'company',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('./features/companies/pages/company-page.component').then(m => m.CompanyPageComponent)
            },
            {
                path: 'users',
                canActivate: [authGuard, permissionGuard],
                data: { permission: PermissionCodes.usersManage },
                loadComponent: () =>
                    import('./features/users/pages/users-page.component').then(m => m.UsersPageComponent)
            },
            {
                path: 'employees',
                canActivate: [authGuard, permissionGuard],
                data: { permission: PermissionCodes.payrollManage },
                loadComponent: () =>
                    import('./features/employees/pages/employees-page.component').then(m => m.EmployeesPageComponent)
            },
            {
                path: 'payroll/deduction-concepts',
                canActivate: [authGuard, permissionGuard],
                data: { permission: PermissionCodes.payrollManage },
                loadComponent: () =>
                    import('./features/payroll/deduction-concepts/pages/deduction-concepts-page.component').then(m => m.DeductionConceptsPageComponent)
            },
            {
                path: 'payroll/advances',
                canActivate: [authGuard, permissionGuard],
                data: { permission: PermissionCodes.payrollAdvancesManage },
                loadComponent: () =>
                    import('./features/payroll/advances/pages/advances-page.component').then(m => m.AdvancesPageComponent)
            },
            {
                path: 'payroll/liquidations',
                canActivate: [authGuard, permissionGuard],
                data: { permission: PermissionCodes.payrollManage },
                loadComponent: () =>
                    import('./features/payroll/liquidations/pages/liquidations-page.component').then(m => m.LiquidationsPageComponent)
            },
            {
                path: 'payroll/bonus-concepts',
                canActivate: [authGuard, permissionGuard],
                data: { permission: PermissionCodes.payrollManage },
                loadComponent: () =>
                    import('./features/payroll/bonus-concepts/pages/bonus-concepts-page.component').then(m => m.BonusConceptsPageComponent)
            },
            {
                path: 'payroll/bonuses',
                canActivate: [authGuard, permissionGuard],
                data: { permission: PermissionCodes.payrollManage },
                loadComponent: () =>
                    import('./features/payroll/bonuses/pages/bonuses-page.component').then(m => m.BonusesPageComponent)
            },
            {
                path: 'auditoria',
                canActivate: [authGuard, permissionGuard],
                data: { permission: PermissionCodes.reportsAudit },
                loadComponent: () =>
                    import('./features/audit/pages/audit-page.component').then(m => m.AuditPageComponent)
            },
            {
                path: 'profile',
                canActivate: [authGuard],
                loadComponent: () =>
                    import('./features/profile/pages/profile-page.component').then(m => m.ProfilePageComponent)
            }
        ]
    },
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
            import('./features/customers/pages/customers-page.component').then(m => m.CustomersPageComponent)
    },
    {
        path: 'products/new',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/products/pages/products-page.component').then(m => m.ProductsPageComponent)
    },
    {
        path: 'products/:id',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/products/pages/products-page.component').then(m => m.ProductsPageComponent)
    },
    {
        path: 'products',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/products/pages/products-page.component').then(m => m.ProductsPageComponent)
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
            import('./features/clients/pages/customer-accounts-page.component').then(m => m.CustomerAccountsPageComponent)
    },
    {
        path: 'clients-cc/customer/:customerId',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.salesAccess },
        loadComponent: () =>
            import('./features/clients/pages/customer-account-page.component').then(m => m.CustomerAccountPageComponent)
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
        path: 'banks',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.banksManage },
        loadComponent: () =>
            import('./features/banks/pages/banks-page.component').then(m => m.BanksPageComponent)
    },
    {
        path: 'quotes',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.quotesAccess },
        loadComponent: () =>
            import('./features/quotes/pages/quotes-page.component').then(m => m.QuotesPageComponent)
    },
    {
        path: 'cheques',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.chequesManage },
        loadComponent: () =>
            import('./features/cheques/pages/cheques-page.component').then(m => m.ChequesPageComponent)
    },
    {
        path: 'reportes',
        canActivate: [authGuard],
        loadComponent: () => import('./features/reports/index/reports-index.component').then(m => m.ReportsIndexComponent)
    },
    {
        path: 'reportes/ventas/control-diario',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesDailyControl },
        loadComponent: () => import('./features/reports/daily-sales-control/pages/daily-sales-control-page.component').then(m => m.DailySalesControlPageComponent)
    },
    {
        path: 'reportes/ventas/mayorista-cliente',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsWholesaleByCustomer },
        loadComponent: () => import('./features/reports/wholesale-by-customer/pages/wholesale-by-customer-page.component').then(m => m.WholesaleByCustomerPageComponent)
    },
    {
        path: 'reportes/ventas/canjes',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesTradeIns },
        loadComponent: () => import('./features/reports/trade-ins-by-branch/pages/trade-ins-by-branch-page.component').then(m => m.TradeInsByBranchPageComponent)
    },
    {
        path: 'reportes/ventas/descuentos',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesDiscounts },
        loadComponent: () => import('./features/reports/discounts/pages/discounts-report-page.component').then(m => m.DiscountsReportPageComponent)
    },
    {
        path: 'reportes/ventas/modelo',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesModel, tipo: 'product' },
        loadComponent: () => import('./features/reports/sales/pages/sales-report-page.component').then(m => m.SalesReportPageComponent)
    },
    {
        path: 'reportes/ventas/marca',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesBrand, tipo: 'brand' },
        loadComponent: () => import('./features/reports/sales/pages/sales-report-page.component').then(m => m.SalesReportPageComponent)
    },
    {
        path: 'reportes/ventas/canal',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesChannel, tipo: 'channel' },
        loadComponent: () => import('./features/reports/sales/pages/sales-report-page.component').then(m => m.SalesReportPageComponent)
    },
    {
        path: 'reportes/ventas/canal-marca',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesChannelBrand, tipo: 'channel_brand' },
        loadComponent: () => import('./features/reports/sales/pages/sales-report-page.component').then(m => m.SalesReportPageComponent)
    },
    {
        path: 'reportes/ventas/transporte',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesTransport, tipo: 'installer' },
        loadComponent: () => import('./features/reports/sales/pages/sales-report-page.component').then(m => m.SalesReportPageComponent)
    },
    {
        path: 'reportes/ventas/ranking',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesRanking, tipo: 'product_ranking' },
        loadComponent: () => import('./features/reports/sales/pages/sales-report-page.component').then(m => m.SalesReportPageComponent)
    },
    {
        path: 'reportes/comparativo',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsSalesComparison },
        loadComponent: () => import('./features/reports/comparison/pages/comparison-report-page.component').then(m => m.ComparisonReportPageComponent)
    },
    {
        path: 'reportes/deudores',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsDebtors },
        loadComponent: () => import('./features/reports/debtors/pages/debtors-report-page.component').then(m => m.DebtorsReportPageComponent)
    },
    {
        path: 'reportes/caja',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsCash },
        loadComponent: () => import('./features/reports/cash/pages/cash-report-page.component').then(m => m.CashReportPageComponent)
    },
    {
        path: 'reportes/stock',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsStock },
        loadComponent: () => import('./features/reports/stock/pages/stock-matrix-page.component').then(m => m.StockMatrixPageComponent)
    },
    {
        path: 'reportes/medios-pago',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsPayments },
        loadComponent: () => import('./features/reports/payments/pages/payment-methods-report-page.component').then(m => m.PaymentMethodsReportPageComponent)
    },
    {
        path: 'reportes/movimientos-stock',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.reportsStock },
        loadComponent: () => import('./features/reports/stock-movements/pages/stock-movements-page.component').then(m => m.StockMovementsPageComponent)
    },
    {
        path: 'transport',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/transport/pages/transport-page.component').then(m => m.TransportPageComponent)
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
            import('./features/purchases/pages/supplier-account-page.component').then(m => m.SupplierAccountPageComponent)
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
