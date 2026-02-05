export type TimeRangeYears = 5 | 10 | 15;

export interface ExploreFilters {
  socMajor: string;  // e.g., "15-0000"
  timeRangeYears: TimeRangeYears;
  metric: 'wage' | 'employment';
  includeNationalBenchmark: boolean;
}