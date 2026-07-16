export type OperatingSeason = {
  label: string;
  fromDate: string;
  toDate: string;
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function currentOperatingSeason(todayIso: string): OperatingSeason {
  const [year, month] = todayIso.split("-").map(Number);

  if (month >= 4 && month <= 10) {
    return {
      label: "Travel Season",
      fromDate: isoDate(year, 4, 1),
      toDate: isoDate(year, 10, 31)
    };
  }

  if (month >= 11) {
    return {
      label: "Off-Season",
      fromDate: isoDate(year, 11, 1),
      toDate: isoDate(year + 1, 3, 31)
    };
  }

  return {
    label: "Off-Season",
    fromDate: isoDate(year - 1, 11, 1),
    toDate: isoDate(year, 3, 31)
  };
}

export function isWithinSeason(dateIso: string, season: OperatingSeason) {
  return dateIso >= season.fromDate && dateIso <= season.toDate;
}
