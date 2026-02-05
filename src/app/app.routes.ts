import { Routes } from '@angular/router';
import { DashboardComponent } from '../features/dashboard/dashboard.component';
import { ExploreComponent } from '../features/explore/explore.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'explore', component: ExploreComponent },
  { path: '**', redirectTo: 'dashboard' },
];