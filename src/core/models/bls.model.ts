export interface BlsTimeseriesResponse {
  status: string;
  responseTime: number;
  message: string[];
  Results: {
    series: Array<{
      seriesID: string;
      data: Array<{
        year: string;
        period: string;       // e.g. "M01"
        periodName: string;   // e.g. "January"
        value: string;        // numeric string
      }>;
    }>;
  };
}