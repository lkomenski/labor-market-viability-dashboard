import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="space-y-2">
      <h1 class="text-2xl font-semibold">Dashboard</h1>
      <p class="text-slate-300">Coming soon: KPIs + trends.</p>
    </section>
  `,
})
export class DashboardComponent {}