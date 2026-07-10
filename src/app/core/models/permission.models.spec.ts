import { PermissionCodes } from './permission.models';

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
