import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SetEmployeePayrollConfigRequest, SetEmployeePayrollConfigResponse } from '../models/payroll.models';

@Injectable({ providedIn: 'root' })
export class EmployeePayrollConfigService {
  private readonly base = `${environment.apiUrl}/employees`;

  constructor(private readonly http: HttpClient) {}

  set(employeeId: string, req: SetEmployeePayrollConfigRequest): Observable<SetEmployeePayrollConfigResponse> {
    return this.http.put<SetEmployeePayrollConfigResponse>(`${this.base}/${employeeId}/payroll-config`, req);
  }
}
