import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CompanyService } from './company.service';

describe('CompanyService', () => {
    let service: CompanyService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
        service = TestBed.inject(CompanyService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('fija el descuento máximo con su propio endpoint, no con el PUT de la empresa', () => {
        service.setRetailDiscountLimit(12.5).subscribe();

        const request = http.expectOne(`${environment.apiUrl}/companies/current/retail-discount-limit`);
        expect(request.request.method).toBe('PUT');
        expect(request.request.body).toEqual({ maxPercent: 12.5 });
        request.flush(null, { status: 204, statusText: 'No Content' });
    });
});
