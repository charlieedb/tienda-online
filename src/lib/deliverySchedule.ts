import type { DeliveryScheduleConfig } from "@/lib/featuredProducts";

export type DeliverySelection = {
  date: string;
  dateLabel: string;
  timeRange: string;
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDeliveryDates(
  schedule: DeliveryScheduleConfig,
  now = new Date(),
  count = 7,
) {
  const allowed = new Set(schedule.weekdays.filter((day) => day >= 1 && day <= 6));
  const dates: Array<{ value: string; label: string; shortLabel: string }> = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);

  for (let checked = 0; checked < 45 && dates.length < count; checked += 1) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && allowed.has(weekday)) {
      dates.push({
        value: localDateKey(cursor),
        label: new Intl.DateTimeFormat("es-AR", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(cursor),
        shortLabel: new Intl.DateTimeFormat("es-AR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        }).format(cursor),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function buildDeliveryTimeRanges(schedule: DeliveryScheduleConfig) {
  return schedule.timeRanges.map(
    ({ startTime, endTime }) => `${startTime} hs a ${endTime} hs`,
  );
}
