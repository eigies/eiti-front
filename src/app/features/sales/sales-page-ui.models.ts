export type SalesPageMode = 'sell' | 'manage';

export type QuickSaleStage = 'config' | 'products' | 'payment';

export type SaleUiAction =
    | 'details'
    | 'customer'
    | 'driver'
    | 'vehicle'
    | 'transport'
    | 'channel'
    | 'excel'
    | 'pdf'
    | 'remito'
    | 'invoice'
    | 'creditNote'
    | 'whatsapp'
    | 'cancel'
    | 'edit'
    | 'pay';

/** Descuento general que el vendedor carga en el alta o la edicion de una venta minorista. */
export interface SaleDiscountDraft {
    /** El control esta desplegado (el descuento aplica igual aunque se pliegue). */
    open: boolean;
    percent: number;
    reason: string;
}

export function emptySaleDiscountDraft(): SaleDiscountDraft {
    return { open: false, percent: 0, reason: '' };
}
