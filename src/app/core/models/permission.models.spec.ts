import { PermissionCatalog, PermissionCodes } from './permission.models';

describe('PermissionCodes', () => {
    it('should have salesPriceOverride equal to "sales.override_price"', () => {
        expect(PermissionCodes.salesPriceOverride).toBe('sales.override_price');
    });

    it('should expose payroll permission codes', () => {
        expect(PermissionCodes.payrollManage).toBe('payroll.manage');
        expect(PermissionCodes.payrollLiquidationsGenerate).toBe('payroll.liquidations.generate');
        expect(PermissionCodes.payrollLiquidationsPay).toBe('payroll.liquidations.pay');
        expect(PermissionCodes.payrollAdvancesManage).toBe('payroll.advances.manage');
    });
});

describe('Permisos del descuento minorista', () => {
    function catalogIndex(code: string): number {
        return PermissionCatalog.findIndex(entry => entry.code === code);
    }

    it('fijar el descuento máximo es un permiso de ventas', () => {
        expect(PermissionCodes.salesDiscountConfigure).toBe('sales.discount.configure');
        const entry = PermissionCatalog[catalogIndex(PermissionCodes.salesDiscountConfigure)];
        expect(entry?.label).toBe('Ventas: fijar el descuento máximo');
    });

    it('el descuento máximo queda junto a "sobreescribir precio", no al final', () => {
        expect(catalogIndex(PermissionCodes.salesDiscountConfigure))
            .toBe(catalogIndex(PermissionCodes.salesPriceOverride) + 1);
    });

    it('el reporte de descuentos va en el bloque de Reportería, junto a canjes', () => {
        expect(PermissionCodes.reportsSalesDiscounts).toBe('reports.sales.discounts');
        const index = catalogIndex(PermissionCodes.reportsSalesDiscounts);
        expect(PermissionCatalog[index]?.label).toBe('Reportería: descuentos');
        expect(index).toBe(catalogIndex(PermissionCodes.reportsSalesTradeIns) + 1);
    });
});
