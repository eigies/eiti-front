import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { CustomerResponse } from '../../../core/models/customer.models';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.css']
})
export class CustomerDetailComponent implements OnInit {
  customer: CustomerResponse | null = null;
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private customerService: CustomerService,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.error = 'ID invalido'; this.loading = false; return; }

    this.customerService.getCustomerById(id).subscribe({
      next: (c) => { this.customer = c; this.loading = false; },
      error: (err) => {
        this.error = err?.error?.message || 'Cliente no encontrado';
        this.loading = false;
        this.toast.error(this.error!);
      }
    });
  }
}
