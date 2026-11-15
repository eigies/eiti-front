import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { ImportProductRowRequest } from '../../../core/models/product.models';
import { ImportBranchPricingRowRequest } from '../../../core/models/stock.models';

/*
 * Template e importación de productos por Excel. Código movido tal cual desde
 * ProductsComponent: mismas hojas, columnas, validaciones y mensajes.
 */
export type ProductImportColumn =
  | 'code'
  | 'sku'
  | 'brand'
  | 'name'
  | 'categoryName'
  | 'description'
  | 'publicPrice'
  | 'costPrice'
  | 'unitPrice'
  | 'allowsManualValueInSale'
  | 'noDeliverySurcharge'
  | 'branchName'
  | 'initialStock';

export type ProductImportRow = Record<ProductImportColumn, string | number | boolean | null>;

const PRODUCT_IMPORT_HEADERS: ProductImportColumn[] = [
  'code',
  'sku',
  'brand',
  'name',
  'categoryName',
  'description',
  'publicPrice',
  'costPrice',
  'unitPrice',
  'allowsManualValueInSale',
  'noDeliverySurcharge',
  'branchName',
  'initialStock'
];

// Hoja de precios/costo por sucursal del template. Solo code/branchName/costOverride/salePriceOverride
// se importan; name y los globales son informativos para guiar la edición.
export type PricingImportColumn =
  | 'code'
  | 'name'
  | 'branchName'
  | 'costOverride'
  | 'salePriceOverride'
  | 'costoGlobal'
  | 'precioGlobal';

export type PricingImportRow = Record<PricingImportColumn, string | number | null>;

const PRICING_SHEET_NAME = 'PreciosSucursal';

const PRICING_IMPORT_HEADERS: PricingImportColumn[] = [
  'code',
  'name',
  'branchName',
  'costOverride',
  'salePriceOverride',
  'costoGlobal',
  'precioGlobal'
];

@Injectable({ providedIn: 'root' })
export class ProductImportService {
  downloadTemplate(
    dataRows: ProductImportRow[],
    branchNames: string[],
    categoryNames: string[],
    pricingRows: PricingImportRow[]
  ): void {
    const wb = new ExcelJS.Workbook();

    // Hidden helper sheet with branch names for the dropdown formula
    const branchSheet = wb.addWorksheet('_Sucursales', { state: 'veryHidden' });
    branchNames.forEach((name, i) => { branchSheet.getCell(i + 1, 1).value = name; });
    const categorySheet = wb.addWorksheet('_Categorias', { state: 'veryHidden' });
    categoryNames.forEach((name, i) => { categorySheet.getCell(i + 1, 1).value = name; });

    const ws = wb.addWorksheet('Productos');

    // Header row
    ws.addRow(PRODUCT_IMPORT_HEADERS);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

    // Column widths
    const widths: Record<string, number> = {
      code: 14, sku: 14, brand: 18, name: 28, categoryName: 22, description: 30,
      publicPrice: 14, costPrice: 12, unitPrice: 12,
      allowsManualValueInSale: 22, noDeliverySurcharge: 20,
      branchName: 22, initialStock: 14
    };
    PRODUCT_IMPORT_HEADERS.forEach((h, i) => {
      ws.getColumn(i + 1).width = widths[h] ?? 16;
    });

    // Data rows
    dataRows.forEach(row => {
      ws.addRow(PRODUCT_IMPORT_HEADERS.map(h => row[h]));
    });

    // Data validation: branchName column (col index = position of 'branchName' + 1)
    const branchColIdx = PRODUCT_IMPORT_HEADERS.indexOf('branchName') + 1;
    if (branchNames.length > 0) {
      for (let r = 2; r <= dataRows.length + 1; r++) {
        ws.getCell(r, branchColIdx).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_Sucursales!$A$1:$A$${branchNames.length}`],
          showErrorMessage: true,
          errorTitle: 'Sucursal inválida',
          error: 'Seleccioná una sucursal de la lista.'
        };
      }
    }

    const categoryColIdx = PRODUCT_IMPORT_HEADERS.indexOf('categoryName') + 1;
    if (categoryNames.length > 0) {
      for (let r = 2; r <= dataRows.length + 1; r++) {
        ws.getCell(r, categoryColIdx).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_Categorias!$A$1:$A$${categoryNames.length}`],
          showErrorMessage: true,
          errorTitle: 'Categoría inválida',
          error: 'Seleccioná una categoría de la lista.'
        };
      }
    }

    // Hoja "PreciosSucursal": override de costo/precio de venta por sucursal.
    const ps = wb.addWorksheet(PRICING_SHEET_NAME);
    ps.addRow(PRICING_IMPORT_HEADERS);
    ps.getRow(1).font = { bold: true };
    ps.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

    const pricingWidths: Record<string, number> = {
      code: 14, name: 28, branchName: 22,
      costOverride: 16, salePriceOverride: 18, costoGlobal: 14, precioGlobal: 14
    };
    PRICING_IMPORT_HEADERS.forEach((h, i) => {
      ps.getColumn(i + 1).width = pricingWidths[h] ?? 16;
    });

    pricingRows.forEach(row => {
      ps.addRow(PRICING_IMPORT_HEADERS.map(h => row[h]));
    });

    // Columnas globales informativas (no se importan): atenuadas para no confundir.
    const globalCostIdx = PRICING_IMPORT_HEADERS.indexOf('costoGlobal') + 1;
    const globalPriceIdx = PRICING_IMPORT_HEADERS.indexOf('precioGlobal') + 1;
    for (let r = 2; r <= pricingRows.length + 1; r++) {
      ps.getCell(r, globalCostIdx).font = { color: { argb: 'FF999999' } };
      ps.getCell(r, globalPriceIdx).font = { color: { argb: 'FF999999' } };
    }

    // Dropdown de sucursal también en la hoja de precios.
    const psBranchColIdx = PRICING_IMPORT_HEADERS.indexOf('branchName') + 1;
    if (branchNames.length > 0) {
      for (let r = 2; r <= pricingRows.length + 1; r++) {
        ps.getCell(r, psBranchColIdx).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`_Sucursales!$A$1:$A$${branchNames.length}`],
          showErrorMessage: true,
          errorTitle: 'Sucursal inválida',
          error: 'Seleccioná una sucursal de la lista.'
        };
      }
    }

    wb.xlsx.writeBuffer().then((buffer: ArrayBuffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-productos.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  parseWorkbook(source: string | ArrayBuffer | null): {
    products: ImportProductRowRequest[];
    pricing: ImportBranchPricingRowRequest[];
  } {
    if (!source) {
      throw new Error('El archivo seleccionado esta vacio.');
    }

    const workbook = XLSX.read(source, { type: 'array' });
    const products = this.parseProductsSheet(workbook);
    const pricing = this.parsePricingSheet(workbook);

    if (products.length === 0 && pricing.length === 0) {
      throw new Error('El archivo no contiene filas para importar (ni productos ni precios por sucursal).');
    }

    return { products, pricing };
  }

  private parseProductsSheet(workbook: XLSX.WorkBook): ImportProductRowRequest[] {
    const worksheet = workbook.Sheets['Productos'];
    if (!worksheet) {
      return [];
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: false
    });
    if (rawRows.length === 0) {
      return [];
    }

    const headerRows = XLSX.utils.sheet_to_json<(string | null)[]>(worksheet, {
      header: 1,
      blankrows: false,
      defval: null
    });
    const normalizedHeaders = (headerRows[0] ?? []).map(header => String(header ?? '').trim());
    const missingHeaders = PRODUCT_IMPORT_HEADERS.filter(
      header => header !== 'categoryName' && !normalizedHeaders.includes(header)
    );
    if (missingHeaders.length > 0) {
      throw new Error(`Faltan columnas obligatorias en la hoja Productos: ${missingHeaders.join(', ')}.`);
    }

    return rawRows.map((row, index) => this.mapImportRow(row, index + 2));
  }

  private parsePricingSheet(workbook: XLSX.WorkBook): ImportBranchPricingRowRequest[] {
    const worksheet = workbook.Sheets[PRICING_SHEET_NAME];
    if (!worksheet) {
      return [];
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: false
    });
    if (rawRows.length === 0) {
      return [];
    }

    const headerRows = XLSX.utils.sheet_to_json<(string | null)[]>(worksheet, {
      header: 1,
      blankrows: false,
      defval: null
    });
    const normalizedHeaders = (headerRows[0] ?? []).map(header => String(header ?? '').trim());
    const missing = (['code', 'branchName'] as PricingImportColumn[]).filter(h => !normalizedHeaders.includes(h));
    if (missing.length > 0) {
      throw new Error(`Faltan columnas obligatorias en la hoja ${PRICING_SHEET_NAME}: ${missing.join(', ')}.`);
    }

    const result: ImportBranchPricingRowRequest[] = [];
    rawRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const costOverride = this.readPricingNumber(row, 'costOverride', rowNumber);
      const salePriceOverride = this.readPricingNumber(row, 'salePriceOverride', rowNumber);

      // Sin overrides => nada para actualizar; se omite (semántica "dejar como está").
      if (costOverride == null && salePriceOverride == null) {
        return;
      }

      const code = String(row['code'] ?? '').trim();
      const branchName = String(row['branchName'] ?? '').trim();
      if (!code) {
        throw new Error(`Hoja ${PRICING_SHEET_NAME}, fila ${rowNumber}: code es obligatorio.`);
      }
      if (!branchName) {
        throw new Error(`Hoja ${PRICING_SHEET_NAME}, fila ${rowNumber}: branchName es obligatorio.`);
      }

      result.push({ code, branchName, costOverride, salePriceOverride });
    });

    return result;
  }

  private readPricingNumber(row: Record<string, unknown>, key: PricingImportColumn, rowNumber: number): number | null {
    const rawValue = row[key];
    if (rawValue == null || String(rawValue).trim() === '') {
      return null;
    }

    const normalizedValue = Number(String(rawValue).replace(',', '.'));
    if (!Number.isFinite(normalizedValue)) {
      throw new Error(`Hoja ${PRICING_SHEET_NAME}, fila ${rowNumber}: ${key} debe ser numérico.`);
    }
    if (normalizedValue < 0) {
      throw new Error(`Hoja ${PRICING_SHEET_NAME}, fila ${rowNumber}: ${key} no puede ser negativo.`);
    }

    return normalizedValue;
  }

  private mapImportRow(row: Record<string, unknown>, rowNumber: number): ImportProductRowRequest {
    const code = this.readRequiredImportText(row, 'code', rowNumber);
    const sku = this.readRequiredImportText(row, 'sku', rowNumber);
    const brand = this.readRequiredImportText(row, 'brand', rowNumber);
    const name = this.readRequiredImportText(row, 'name', rowNumber);
    const costPrice = this.readRequiredImportNumber(row, 'costPrice', rowNumber);
    const allowsManualValueInSale = this.readRequiredImportBoolean(row, 'allowsManualValueInSale', rowNumber);
    const publicPrice = this.readOptionalImportNumber(row, 'publicPrice', rowNumber);

    if (!allowsManualValueInSale && publicPrice == null) {
      throw new Error(`Fila ${rowNumber}: publicPrice es obligatorio cuando allowsManualValueInSale es false.`);
    }

    return {
      code,
      sku,
      brand,
      name,
      categoryName: this.readOptionalImportText(row, 'categoryName'),
      description: this.readOptionalImportText(row, 'description'),
      publicPrice,
      costPrice,
      unitPrice: this.readOptionalImportNumber(row, 'unitPrice', rowNumber),
      allowsManualValueInSale,
      noDeliverySurcharge: this.readOptionalImportNumber(row, 'noDeliverySurcharge', rowNumber),
      branchName: this.readOptionalImportText(row, 'branchName'),
      initialStock: this.readOptionalImportNumber(row, 'initialStock', rowNumber)
    };
  }

  private readRequiredImportText(row: Record<string, unknown>, key: ProductImportColumn, rowNumber: number): string {
    const value = this.readOptionalImportText(row, key);
    if (!value) {
      throw new Error(`Fila ${rowNumber}: ${key} es obligatorio.`);
    }

    return value;
  }

  private readOptionalImportText(row: Record<string, unknown>, key: ProductImportColumn): string | null {
    const value = row[key];
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readRequiredImportNumber(row: Record<string, unknown>, key: ProductImportColumn, rowNumber: number): number {
    const value = this.readOptionalImportNumber(row, key, rowNumber);
    if (value == null) {
      throw new Error(`Fila ${rowNumber}: ${key} es obligatorio.`);
    }

    return value;
  }

  private readOptionalImportNumber(row: Record<string, unknown>, key: ProductImportColumn, rowNumber: number): number | null {
    const rawValue = row[key];
    if (rawValue == null || String(rawValue).trim() === '') {
      return null;
    }

    const normalizedValue = Number(String(rawValue).replace(',', '.'));
    if (!Number.isFinite(normalizedValue)) {
      throw new Error(`Fila ${rowNumber}: ${key} debe ser numerico.`);
    }

    return normalizedValue;
  }

  private readRequiredImportBoolean(row: Record<string, unknown>, key: ProductImportColumn, rowNumber: number): boolean {
    const rawValue = row[key];
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    const normalizedValue = String(rawValue ?? '').trim().toLowerCase();
    if (!normalizedValue) {
      throw new Error(`Fila ${rowNumber}: ${key} es obligatorio.`);
    }

    if (['true', '1', 'si', 'sí', 'yes', 'y'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalizedValue)) {
      return false;
    }

    throw new Error(`Fila ${rowNumber}: ${key} debe ser true o false.`);
  }

}
