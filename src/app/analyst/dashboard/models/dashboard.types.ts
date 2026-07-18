import { ZardIcon } from '@/shared/components/icon';

export interface OutreachAction {
  label: string;
  count: number;
  bgColor: string;
  textColor: string;
  icon: ZardIcon;
}

export interface EpisodeOfCare {
  label: string;
  icon: ZardIcon;
  male: number;
  female: number;
  others: number;
  total: number;
}

export interface ActivityStat {
  label: string;
  count: number;
  countColor: string;
}

export interface LocationFilters {
  year: string;
  month: string;
  state: string;
  district: string;
  block: string;
}

export interface ActivityFilters {
  activity: string;
  session: string;
}
