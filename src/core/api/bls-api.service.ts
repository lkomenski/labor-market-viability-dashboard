import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BlsTimeseriesResponse } from '../models/bls.model';

export interface BlsTimeseriesRequest {
  seriesIds: string[];
  startYear: string;
  endYear: string;
}

@Injectable({ providedIn: 'root' })
export class BlsApiService {
  constructor(private http: HttpClient) {}

  timeseries(req: BlsTimeseriesRequest) {
    return this.http.post<BlsTimeseriesResponse>('/api/bls/timeseries', req);
  }
}