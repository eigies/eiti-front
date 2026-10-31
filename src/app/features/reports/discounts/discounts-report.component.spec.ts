import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DiscountsReportComponent } from './discounts-report.component';
import { ReportService } from '../../../core/services/report.service';
import { BranchService } from '../../../core/services/branch.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PermissionCodes } from '../../../core/models/permission.models';
import { DiscountsReportResponse } from '../../../core/models/report.models';
import { UserResponse } from '../../../core/models/user.models';

describe('DiscountsReportComponent', () => {
    let fixture: ComponentFixture<DiscountsReportComponent>;
    let component: DiscountsReportComponent;
    let reports: jasmine.SpyObj<ReportService>;
    let users: jasmine.SpyObj<UserService>;
    let auth: jasmine.SpyObj<AuthService>;
    let toast: jasmine.SpyObj<ToastService>;

    const response: DiscountsReportResponse = {
        rows: [
            {
                saleId: 's-2', saleCode: 'MAT-4002', date: '2026-10-29T18:30:00Z', branchName: 'Mataderos',
                customerName: 'Consumidor final', isCuentaCorriente: false, appliedByUserId: 'u-ana', appliedByUserName: 'Ana Gómez',
                discountPercent: 10, subtotalBeforeDiscount: 100000, discountAmount: 10000, total: 90000, reason: 'Cliente frecuente'
            },
            {
                saleId: 's-1', saleCode: 'SC-0101', date: '2026-10-28T14:00:00Z', branchName: 'San Cristóbal',
                customerName: 'Transporte Olivos', isCuentaCorriente: true, appliedByUserId: 'u-beto', appliedByUserName: 'Beto Ruiz',
                discountPercent: 5, subtotalBeforeDiscount: 200000, discountAmount: 10000, total: 190000, reason: null
            },
            {
                saleId: 's-0', saleCode: 'MAT-4000', date: '2026-10-27T11:00:00Z', branchName: 'Mataderos',
                customerName: 'Consumidor final', isCuentaCorriente: false, appliedByUserId: 'u-ana', appliedByUserName: 'Ana Gómez',
                discountPercent: 8, subtotalBeforeDiscount: 50000, discountAmount: 4000, total: 46000, reason: null
            }
        ],
        totals: { salesCount: 3, discountAmount: 24000 }
    };

    function today(): string {
        return new Date().toLocaleDateString('en-CA');
    }

    function firstOfMonth(): string {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
    }

    function setup(canManageUsers = false): void {
        reports = jasmine.createSpyObj<ReportService>('ReportService', ['getDiscountsReport']);
        reports.getDiscountsReport.and.returnValue(of(response));
        const branches = jasmine.createSpyObj<BranchService>('BranchService', ['listBranches']);
        branches.listBranches.and.returnValue(of([]));
        users = jasmine.createSpyObj<UserService>('UserService', ['listUsers']);
        users.listUsers.and.returnValue(of([
            { id: 'u-caro', username: 'caro', fullName: 'Carolina Paz' } as UserResponse
        ]));
        auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
        auth.hasPermission.and.callFake((code: string) => canManageUsers && code === PermissionCodes.usersManage);
        toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'show']);

        TestBed.configureTestingModule({
            imports: [DiscountsReportComponent],
            providers: [
                { provide: ReportService, useValue: reports },
                { provide: BranchService, useValue: branches },
                { provide: UserService, useValue: users },
                { provide: AuthService, useValue: auth },
                { provide: ToastService, useValue: toast },
                { provide: PdfBrandingService, useValue: {} }
            ]
        });
        fixture = TestBed.createComponent(DiscountsReportComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    function text(): string {
        return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    }

    it('arranca en el mes en curso hasta hoy, sin sucursal ni usuario', () => {
        setup();

        expect(reports.getDiscountsReport).toHaveBeenCalledWith({
            dateFrom: firstOfMonth(), dateTo: today(), branchId: null, userId: null
        });
    });

    it('manda la sucursal y el usuario elegidos', () => {
        setup();
        component.filterForm.patchValue({ dateFrom: '2026-10-01', dateTo: '2026-10-15', branchId: 'b-mat', userId: 'u-ana' });

        component.search();

        expect(reports.getDiscountsReport).toHaveBeenCalledWith({
            dateFrom: '2026-10-01', dateTo: '2026-10-15', branchId: 'b-mat', userId: 'u-ana'
        });
    });

    it('con la fecha desde después de la hasta no busca y avisa', () => {
        setup();
        reports.getDiscountsReport.calls.reset();
        component.filterForm.patchValue({ dateFrom: '2026-10-20', dateTo: '2026-10-01' });

        component.search();

        expect(reports.getDiscountsReport).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalled();
    });

    it('muestra cada venta con quién aplicó el descuento y el motivo, y los totales', () => {
        setup();

        expect(text()).toContain('MAT-4002');
        expect(text()).toContain('Ana Gómez');
        expect(text()).toContain('Cliente frecuente');
        expect(text()).toContain('Cuenta corriente');
        const totals = ((fixture.nativeElement as HTMLElement).querySelector('tfoot')?.textContent ?? '').replace(/\s+/g, ' ');
        expect(totals).toContain('3 ventas');
        expect(totals).toContain('24.000,00');
    });

    it('sin permiso de usuarios arma el filtro con los que aparecen en el resultado', () => {
        setup(false);

        expect(users.listUsers).not.toHaveBeenCalled();
        expect(component.userOptions).toEqual([
            { value: 'u-ana', label: 'Ana Gómez' },
            { value: 'u-beto', label: 'Beto Ruiz' }
        ]);
    });

    it('con permiso de usuarios suma la lista completa', () => {
        setup(true);

        expect(users.listUsers).toHaveBeenCalled();
        expect(component.userOptions.map(option => option.label)).toEqual(['Ana Gómez', 'Beto Ruiz', 'Carolina Paz']);
    });
});
