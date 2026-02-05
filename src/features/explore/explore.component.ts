import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExploreFilters } from '../../core/models/explore-filters.model';

type ExploreForm = FormGroup<{
  occupationGroup: FormControl<string>;
  timeRangeYears: FormControl<5 | 10 | 15>;
  metric: FormControl<'wage' | 'employment'>;
  includeNationalBenchmark: FormControl<boolean>;
}>;

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="space-y-6">
      <header>
        <h1 class="text-2xl font-semibold">Explore</h1>
        <p class="mt-1 text-slate-300">
          Filter major occupation groups and evaluate viability signals.
        </p>
      </header>

      <section class="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <form [formGroup]="form" (ngSubmit)="apply()" class="space-y-5">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-slate-200">Occupation group</label>
              <select
                class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                formControlName="occupationGroup"
                aria-describedby="occupationGroupError"
                [attr.aria-invalid]="showError('occupationGroup')"
              >
                <option value="" disabled>Select a group…</option>
                <option *ngFor="let g of occupationGroups" [value]="g">{{ g }}</option>
              </select>

              <p
                id="occupationGroupError"
                class="mt-2 text-sm text-red-400"
                *ngIf="showError('occupationGroup')"
              >
                Please select an occupation group.
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-200">Time range</label>
              <select
                class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                formControlName="timeRangeYears"
              >
                <option [ngValue]="5">Last 5 years</option>
                <option [ngValue]="10">Last 10 years</option>
                <option [ngValue]="15">Last 15 years</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-200">Primary metric</label>
              <div class="mt-2 flex gap-3">
                <label class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                  <input type="radio" formControlName="metric" value="wage" />
                  Wage
                </label>
                <label class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                  <input type="radio" formControlName="metric" value="employment" />
                  Employment
                </label>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-slate-700 bg-slate-950"
                formControlName="includeNationalBenchmark"
                id="bench"
              />
              <label for="bench" class="text-sm text-slate-200">
                Include national benchmark
              </label>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="submit"
              class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400 disabled:opacity-50"
              [disabled]="form.invalid"
            >
              Apply
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900"
              (click)="reset()"
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section class="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 class="text-lg font-semibold">Current selection</h2>

        <div class="mt-3 grid gap-2 text-sm text-slate-200">
          <div><span class="text-slate-400">Occupation group:</span> {{ applied()?.occupationGroup ?? '—' }}</div>
          <div><span class="text-slate-400">Time range:</span> {{ applied()?.timeRangeYears ?? '—' }} years</div>
          <div><span class="text-slate-400">Metric:</span> {{ applied()?.metric ?? '—' }}</div>
          <div><span class="text-slate-400">Benchmark:</span> {{ applied()?.includeNationalBenchmark ? 'On' : 'Off' }}</div>
        </div>

        <p class="mt-4 text-slate-300">
          Next: wire this form to the BLS API (v2) and render results.
        </p>
      </section>
    </section>
  `,
})
export class ExploreComponent {
  // later: replace this with real BLS-fed group names
  occupationGroups = [
    'Management',
    'Business and Financial Operations',
    'Computer and Mathematical',
    'Architecture and Engineering',
    'Healthcare Practitioners and Technical',
  ];

  form: ExploreForm = new FormGroup({
    occupationGroup: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    timeRangeYears: new FormControl<5 | 10 | 15>(10, { nonNullable: true }),
    metric: new FormControl<'wage' | 'employment'>('wage', { nonNullable: true }),
    includeNationalBenchmark: new FormControl(true, { nonNullable: true }),
  });

  private submitted = signal(false);
  applied = signal<ExploreFilters | null>(null);

  showError(controlName: keyof ExploreForm['controls']) {
    const c = this.form.controls[controlName];
    return (c.touched || this.submitted()) && c.invalid;
  }

  apply() {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.applied.set(this.form.getRawValue());
  }

  reset() {
    this.submitted.set(false);
    this.form.reset({
      occupationGroup: '',
      timeRangeYears: 10,
      metric: 'wage',
      includeNationalBenchmark: true,
    });
    this.applied.set(null);
  }
}