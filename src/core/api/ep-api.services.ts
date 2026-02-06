import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface MajorGroupViability {
  socMajor: string;
  title: string;
  employment2024k: number;
  employment2034k: number;
  changeNumeric: number;
  changePercent: number;
  medianWage2024: number | null;
}

@Injectable({ providedIn: 'root' })
export class EpApiService {
  constructor(private http: HttpClient) {}

  getMajorGroups() {
    return this.http.get<MajorGroupViability[]>('/api/ep/major-groups');
  }
}