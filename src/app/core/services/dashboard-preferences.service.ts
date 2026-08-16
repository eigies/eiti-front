import { Injectable } from '@angular/core';
import { DashboardChartMetric, DashboardChartSegment } from '../models/dashboard.models';

const BRANCH_KEY = 'eiti_dashboard_branch_id';
const SEGMENT_KEY = 'eiti_dashboard_chart_segment';
const METRIC_KEY = 'eiti_dashboard_chart_metric';

const SEGMENTS: readonly DashboardChartSegment[] = ['both', 'retail', 'cc'];
const METRICS: readonly DashboardChartMetric[] = ['count', 'amount', 'products'];

@Injectable({ providedIn: 'root' })
export class DashboardPreferencesService {
  readBranchId(availableBranchIds: string[], canViewAll: boolean): string | null {
    const stored = this.read(BRANCH_KEY);
    const isValid = stored !== null && availableBranchIds.includes(stored);

    if (isValid) {
      return stored;
    }

    return canViewAll ? null : (availableBranchIds[0] ?? null);
  }

  writeBranchId(value: string | null): void {
    if (value === null) {
      this.remove(BRANCH_KEY);
      return;
    }
    this.write(BRANCH_KEY, value);
  }

  readChartSegment(): DashboardChartSegment {
    const stored = this.read(SEGMENT_KEY);
    return SEGMENTS.includes(stored as DashboardChartSegment)
      ? (stored as DashboardChartSegment)
      : 'both';
  }

  writeChartSegment(value: DashboardChartSegment): void {
    this.write(SEGMENT_KEY, value);
  }

  readChartMetric(): DashboardChartMetric {
    const stored = this.read(METRIC_KEY);
    return METRICS.includes(stored as DashboardChartMetric)
      ? (stored as DashboardChartMetric)
      : 'count';
  }

  writeChartMetric(value: DashboardChartMetric): void {
    this.write(METRIC_KEY, value);
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Una preferencia visual nunca debe romper la pantalla.
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Una preferencia visual nunca debe romper la pantalla.
    }
  }
}
