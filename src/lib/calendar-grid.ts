/** Calendar helpers (no native date picker). */

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isBeforeLocalDay(a: Date, b: Date): boolean {
  const da = startOfLocalDay(a).getTime();
  const db = startOfLocalDay(b).getTime();
  return da < db;
}

export function isAfterLocalDay(a: Date, b: Date): boolean {
  return isBeforeLocalDay(b, a);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export type CalendarCell = {
  date: Date;
  inMonth: boolean;
  disabled: boolean;
};

/** Sunday-first month grid (6 rows × 7 cols). */
export function buildMonthGrid(
  viewYear: number,
  viewMonth: number,
  min?: Date,
  max?: Date
): CalendarCell[] {
  const first = new Date(viewYear, viewMonth, 1);
  const startPad = first.getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startPad; i++) {
    const d = new Date(viewYear, viewMonth, 1 - (startPad - i));
    cells.push({ date: d, inMonth: false, disabled: true });
  }

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(viewYear, viewMonth, day);
    let disabled = false;
    if (min && isBeforeLocalDay(date, min)) disabled = true;
    if (max && isAfterLocalDay(date, max)) disabled = true;
    cells.push({ date, inMonth: true, disabled });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]?.date ?? new Date(viewYear, viewMonth, totalDays);
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    cells.push({ date: d, inMonth: false, disabled: true });
  }

  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    cells.push({ date: d, inMonth: false, disabled: true });
  }

  return cells;
}

export function monthYearLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** YYYY-MM-DD-style local date, formatted for display. */
export function formatLocalDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
