import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ExploreFilters } from '../../core/models/explore-filters.model';
import { OCCUPATION_GROUPS } from '../../core/data/occupation-groups';

import { BlsApiService } from '../../core/api/bls-api.service';
import { BlsTimeseriesResponse } from '../../core/models/bls.model';

import { EpApiService, MajorGroupViability } from '../../core/api/ep-api.services';

type ExploreForm = FormGroup<{
  socMajor: FormControl<string>;
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

      <!-- Filters -->
      <section class="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <form [formGroup]="form" (ngSubmit)="apply()" class="space-y-5">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-slate-200">Occupation group</label>
              <select
                class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                formControlName="socMajor"
                aria-describedby="socMajorError"
                [attr.aria-invalid]="showError('socMajor')"
              >
                <option value="" disabled>Select a group…</option>
                <option *ngFor="let g of occupationGroups" [value]="g.socMajor">
                  {{ g.title }}
                </option>
              </select>

              <p
                id="socMajorError"
                class="mt-2 text-sm text-red-400"
                *ngIf="showError('socMajor')"
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

      <!-- Current selection -->
      <section class="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 class="text-lg font-semibold">Current selection</h2>

        <div class="mt-3 grid gap-2 text-sm text-slate-200">
          <div><span class="text-slate-400">SOC major:</span> {{ applied()?.socMajor ?? '—' }}</div>
          <div><span class="text-slate-400">Time range:</span> {{ applied()?.timeRangeYears ?? '—' }} years</div>
          <div><span class="text-slate-400">Metric:</span> {{ applied()?.metric ?? '—' }}</div>
          <div><span class="text-slate-400">Benchmark:</span> {{ applied()?.includeNationalBenchmark ? 'On' : 'Off' }}</div>
        </div>

        <p class="mt-4 text-slate-300">
          Next: connect this selection to occupation-group viability metrics.
        </p>
      </section>

      <!-- Viability snapshot (EP Table 1.1) -->
      <section class="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 class="text-lg font-semibold">Viability snapshot</h2>

        <div *ngIf="epLoading()" class="mt-3 text-sm text-slate-300">
          Loading viability data…
        </div>

        <div *ngIf="epError()" class="mt-3 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
          {{ epError() }}
        </div>

        <div *ngIf="!epLoading() && !epError() && !selectedGroup()" class="mt-3 text-sm text-slate-300">
          Select an occupation group and click Apply to view viability metrics.
        </div>

        <div *ngIf="selectedGroup()" class="mt-4 grid gap-3 md:grid-cols-3 text-sm">
          <div class="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div class="text-slate-400">Median wage (2024)</div>
            <div class="mt-1 text-lg font-semibold text-slate-100">
              {{
                selectedGroup()!.medianWage2024 === null
                  ? '—'
                  : ('$' + (selectedGroup()!.medianWage2024 | number:'1.0-0'))
              }}
            </div>
          </div>

          <div class="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div class="text-slate-400">Projected growth (2024→2034)</div>
            <div class="mt-1 text-lg font-semibold text-slate-100">
              {{ selectedGroup()!.changePercent | number:'1.0-1' }}%
            </div>
          </div>

          <div class="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div class="text-slate-400">Change in jobs (thousands)</div>
            <div class="mt-1 text-lg font-semibold text-slate-100">
              {{ selectedGroup()!.changeNumeric | number:'1.0-1' }}k
            </div>
          </div>
        </div>

        <div *ngIf="selectedGroup()" class="mt-4 grid gap-3 md:grid-cols-2 text-sm">
          <div class="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div class="text-slate-400">Employment (2024)</div>
            <div class="mt-1 text-base font-semibold text-slate-100">
              {{ selectedGroup()!.employment2024k | number:'1.0-1' }}k
            </div>
          </div>

          <div class="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div class="text-slate-400">Employment (2034)</div>
            <div class="mt-1 text-base font-semibold text-slate-100">
              {{ selectedGroup()!.employment2034k | number:'1.0-1' }}k
            </div>
          </div>
        </div>
      </section>

      <!-- BLS connection test -->
      <section class="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">BLS Connection Test</h2>
          <button
            type="button"
            class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400 disabled:opacity-50"
            (click)="testCall()"
            [disabled]="loading"
          >
            {{ loading ? 'Loading…' : 'Test API' }}
          </button>
        </div>

        <p class="text-sm text-slate-300">
          Temporary dev utility. Next we’ll connect this to your filters and render results.
        </p>

        <div *ngIf="error" class="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
          {{ error }}
        </div>

        <div *ngIf="result" class="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
          <div><span class="text-slate-400">Status:</span> {{ result.status }}</div>
          <div><span class="text-slate-400">Series returned:</span> {{ result.Results.series.length }}</div>

          <div class="mt-2">
            <span class="text-slate-400">First series ID:</span>
            {{ result.Results.series[0]?.seriesID }}
          </div>

          <div class="mt-2">
            <span class="text-slate-400">First data point:</span>
            {{ result.Results.series[0]?.data?.[0]?.year ?? '—' }}
            {{ result.Results.series[0]?.data?.[0]?.periodName ?? '—' }}
            →
            {{ result.Results.series[0]?.data?.[0]?.value ?? '—' }}
          </div>
        </div>
      </section>
    </section>
  `,
})
export class ExploreComponent implements OnInit {
  constructor(private bls: BlsApiService, private ep: EpApiService) {}

  // Dropdown options (SOC major groups)
  occupationGroups = OCCUPATION_GROUPS;

  // Form state
  form: ExploreForm = new FormGroup({
    socMajor: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    timeRangeYears: new FormControl<5 | 10 | 15>(10, { nonNullable: true }),
    metric: new FormControl<'wage' | 'employment'>('wage', { nonNullable: true }),
    includeNationalBenchmark: new FormControl(true, { nonNullable: true }),
  });

  private submitted = signal(false);
  applied = signal<ExploreFilters | null>(null);

  // EP (viability) data
  epLoading = signal(false);
  epError = signal<string | null>(null);
  epData = signal<MajorGroupViability[] | null>(null);

  selectedGroup = signal<MajorGroupViability | null>(null);

  // BLS connection test state
  loading = false;
  error: string | null = null;
  result: BlsTimeseriesResponse | null = null;

  ngOnInit() {
    this.epLoading.set(true);
    this.epError.set(null);

    this.ep.getMajorGroups().subscribe({
      next: (data: MajorGroupViability[]) => {
        this.epData.set(data);
        this.epLoading.set(false);
      },
      error: (err: any) => {
        this.epError.set(err?.message ?? 'Failed to load EP data');
        this.epLoading.set(false);
      },
    });
  }

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

    const filters = this.form.getRawValue();
    this.applied.set(filters);

    const match = this.epData()?.find((g) => g.socMajor === filters.socMajor) ?? null;
    this.selectedGroup.set(match);
  }

  reset() {
    this.submitted.set(false);
    this.form.reset({
      socMajor: '',
      timeRangeYears: 10,
      metric: 'wage',
      includeNationalBenchmark: true,
    });

    this.applied.set(null);
    this.selectedGroup.set(null);
  }

  testCall() {
    this.loading = true;
    this.error = null;
    this.result = null;

    this.bls.timeseries({
      seriesIds: ['LAUCN040010000000005'],
      startYear: '2020',
      endYear: '2024',
    }).subscribe({
      next: (data) => {
        this.result = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error ?? err?.message ?? 'Request failed';
        this.loading = false;
      },
    });
  }
}