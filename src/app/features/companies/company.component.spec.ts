import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CompanyComponent } from './company.component';
import { CompanyService } from '../../core/services/company.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { CompanyResponse } from '../../core/models/company.models';

describe('CompanyComponent · descuento máximo minorista', () => {
    let fixture: ComponentFixture<CompanyComponent>;
    let component: CompanyComponent;
    let companies: jasmine.SpyObj<CompanyService>;
    let auth: jasmine.SpyObj<AuthService>;
    let toast: jasmine.SpyObj<ToastService>;

    const company: CompanyResponse = {
        id: 'co-1',
        name: 'Baterías Soler',
        primaryDomain: 'soler.com',
        maxRetailDiscountPercent: 10,
        createdAt: '2026-01-01T00:00:00Z'
    };

    function setup(canConfigure: boolean): void {
        companies = jasmine.createSpyObj<CompanyService>('CompanyService', ['getCurrentCompany', 'updateCurrentCompany', 'setRetailDiscountLimit']);
        companies.getCurrentCompany.and.returnValue(of(company));
        companies.setRetailDiscountLimit.and.returnValue(of(void 0));
        auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
        auth.hasPermission.and.callFake((code: string) => canConfigure && code === PermissionCodes.salesDiscountConfigure);
        toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'show']);

        TestBed.configureTestingModule({
            imports: [CompanyComponent],
            providers: [
                { provide: CompanyService, useValue: companies },
                { provide: AuthService, useValue: auth },
                { provide: ToastService, useValue: toast }
            ]
        });
        fixture = TestBed.createComponent(CompanyComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    function discountInput(): HTMLInputElement | null {
        return fixture.nativeElement.querySelector('[data-testid="retail-discount-limit"]');
    }

    it('sin el permiso el campo no aparece', () => {
        setup(false);

        expect(discountInput()).toBeNull();
    });

    it('con el permiso muestra el tope actual de la empresa', () => {
        setup(true);

        expect(discountInput()).not.toBeNull();
        expect(component.discountLimitControl.value).toBe(10);
    });

    it('Guardar del descuento llama a su endpoint, no al de la empresa', () => {
        setup(true);
        component.discountLimitControl.setValue(15);

        component.saveDiscountLimit();

        expect(companies.setRetailDiscountLimit).toHaveBeenCalledWith(15);
        expect(companies.updateCurrentCompany).not.toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalled();
    });

    it('fuera de 0–100 no guarda y avisa', () => {
        setup(true);
        component.discountLimitControl.setValue(120);

        component.saveDiscountLimit();

        expect(companies.setRetailDiscountLimit).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalled();
    });

    it('si el back rechaza muestra su detalle', () => {
        setup(true);
        companies.setRetailDiscountLimit.and.returnValue(throwError(() => ({ error: { detail: 'No tenés permiso para fijar el descuento máximo.' } })));
        component.discountLimitControl.setValue(5);

        component.saveDiscountLimit();

        expect(toast.error).toHaveBeenCalledWith('No tenés permiso para fijar el descuento máximo.');
    });
});
