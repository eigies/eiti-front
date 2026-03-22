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
        path: 'sales-cc/:id/payments',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.salesAccess },
        loadComponent: () =>
            import('./features/sales/sales-cc-payments/sales-cc-payments.component').then(m => m.SalesCcPaymentsComponent)
    },
    {
        path: 'cash',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.cashAccess },
        loadComponent: () =>
            import('./features/cash/cash.component').then(m => m.CashComponent)
    },
    {
        path: 'users',
        canActivate: [authGuard, permissionGuard],
        data: { permission: PermissionCodes.usersManage },
        loadComponent: () =>
            import('./features/users/users.component').then(m => m.UsersComponent)
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
        path: 'customers/:id',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/customers/customer-detail/customer-detail.component').then(
                m => m.CustomerDetailComponent
            )
    },
    { path: '**', redirectTo: 'login' }
];
