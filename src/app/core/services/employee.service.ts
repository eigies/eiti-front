import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateEmployeeRequest, DriverResponse, EmployeeResponse, UpdateEmployeeRequest, UpsertDriverProfileRequest } from '../models/employee.models';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
    private readonly employeesBase = `${environment.apiUrl}/employees`;
    private readonly driversBase = `${environment.apiUrl}/drivers`;

    constructor(private http: HttpClient) { }

    listEmployees(): Observable<EmployeeResponse[]> {
        return this.http.get<EmployeeResponse[]>(this.employeesBase);
    }

    listDriverEmployees(): Observable<EmployeeResponse[]> {
        return this.http.get<EmployeeResponse[]>(`${this.employeesBase}/drivers`);
    }

    createEmployee(request: CreateEmployeeRequest): Observable<EmployeeResponse> {
        return this.http.post<EmployeeResponse>(this.employeesBase, request);
    }

    getEmployee(id: string): Observable<EmployeeResponse> {
        return this.http.get<EmployeeResponse>(`${this.employeesBase}/${id}`);
    }

    updateEmployee(id: string, request: UpdateEmployeeRequest): Observable<EmployeeResponse> {
        return this.http.put<EmployeeResponse>(`${this.employeesBase}/${id}`, request);
    }

    listDrivers(): Observable<DriverResponse[]> {
        return this.http.get<DriverResponse[]>(this.driversBase);
    }

    upsertDriverProfile(request: UpsertDriverProfileRequest): Observable<DriverResponse> {
        return this.http.post<DriverResponse>(this.driversBase, request);
    }
}
