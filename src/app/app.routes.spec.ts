import { routes } from './app.routes';
import { PermissionCodes } from './core/models/permission.models';

describe('Rutas de reportería', () => {
    it('el reporte de descuentos es lazy, va con los de ventas y pide su permiso', () => {
        const route = routes.find(candidate => candidate.path === 'reportes/ventas/descuentos');

        expect(route?.loadComponent).toBeDefined();
        expect(route?.data?.['permission']).toBe(PermissionCodes.reportsSalesDiscounts);
    });
});
