import { defaultSystemSettings, type SeasonSettings } from "@/lib/settings";

export type OperatingSeason = {
  id: string;
  label: string;
  fromDate: string;
  toDate: string;
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthDayToParts(value: string) {
  const [month = "1", day = "1"] = value.split("-");

  return {
    month: Number(month),
    day: Number(day)
  };
}

function seasonWindowForDate(todayIso: string, season: SeasonSettings): OperatingSeason {
  const [year] = todayIso.split("-").map(Number);
  const todayMonthDay = todayIso.slice(5);
  const wrapsYear = season.startDate > season.endDate;
  const start = monthDayToParts(season.startDate);
  const end = monthDayToParts(season.endDate);

  if (!wrapsYear) {
    return {
      id: season.id,
      label: season.name,
      fromDate: isoDate(year, start.month, start.day),
      toDate: isoDate(year, end.month, end.day)
    };
  }

  if (todayMonthDay >= season.startDate) {
    return {
      id: season.id,
      label: season.name,
      fromDate: isoDate(year, start.month, start.day),
      toDate: isoDate(year + 1, end.month, end.day)
    };
  }

  return {
    id: season.id,
    label: season.name,
    fromDate: isoDate(year - 1, start.month, start.day),
    toDate: isoDate(year, end.month, end.day)
  };
}

export function currentOperatingSeason(
  todayIso: string,
  seasons: SeasonSettings[] = defaultSystemSettings.seasons
): OperatingSeason {
  const activeSeasons = seasons.filter((season) => season.active);
  const seasonWindows = activeSeasons.map((season) => seasonWindowForDate(todayIso, season));
  const currentSeason = seasonWindows.find((season) => isWithinSeason(todayIso, season));

  if (currentSeason) {
    return currentSeason;
  }

  const fallbackSeason = activeSeasons[0] ?? defaultSystemSettings.seasons[0];

  return seasonWindowForDate(todayIso, fallbackSeason);
}

export function isWithinSeason(dateIso: string, season: OperatingSeason) {
  return dateIso >= season.fromDate && dateIso <= season.toDate;
}
