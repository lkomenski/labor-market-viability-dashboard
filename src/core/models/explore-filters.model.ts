export type TimeRangeYears = 5 | 10 | 15;

export interface ExploreFilters {
  occupationGroup: string;  // e.g., "Management"
  timeRangeYears: TimeRangeYears;
  metric: 'wage' | 'employment';
  includeNationalBenchmark: boolean;
}