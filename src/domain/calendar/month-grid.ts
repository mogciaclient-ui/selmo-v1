export type CalendarCell = {
  key: string;
  day: number;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const tokyoDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toTokyoDateKey(value: Date | string): string {
  return tokyoDateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function createMonthGrid(year: number, monthIndex: number, todayKey: string): CalendarCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    return {
      key: dateKey,
      day: date.getUTCDate(),
      dateKey,
      isCurrentMonth: date.getUTCMonth() === monthIndex,
      isToday: dateKey === todayKey,
    };
  });
}
