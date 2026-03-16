import { PermissionCodes } from './permission.models';

describe('PermissionCodes', () => {
    it('should have salesPriceOverride equal to "sales.override_price"', () => {
        expect(PermissionCodes.salesPriceOverride).toBe('sales.override_price');
    });
});
