import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ExperienceItem } from '../../../../shared/models/portfolio.models';
import { EXPERIENCE } from '../../../../shared/data/portfolio.data';
import { RevealOnScroll } from '../../../../shared/directives/reveal-on-scroll.directive';

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/**
 * Extracts a machine-readable start date (YYYY or YYYY-MM) from the display
 * period ("Feb 2026 – Present", "2026", "2023 - 2024"). Returns undefined
 * when the leading token isn't parseable, so callers can skip the
 * `datetime` attribute rather than render a wrong value.
 */
export function periodStartDatetime(period: string): string | undefined {
  const match = period.match(/^([A-Za-z]{3,})?\s*(\d{4})/);
  if (!match) return undefined;
  const [, monthName, year] = match;
  const month = monthName ? MONTHS[monthName.slice(0, 3).toLowerCase()] : undefined;
  return month ? `${year}-${month}` : year;
}

@Component({
  selector: 'app-experience',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './experience.html',
  styleUrls: ['./experience.css'],
  imports: [RevealOnScroll],
})
export class Experience {
  items: ExperienceItem[] = EXPERIENCE;

  periodDatetime(period: string): string | undefined {
    return periodStartDatetime(period);
  }
}
