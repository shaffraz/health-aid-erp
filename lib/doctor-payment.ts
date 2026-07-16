import type { DoctorPaymentModel } from "@/lib/types";
import {
  defaultSystemSettings,
  defaultDoctorPaymentSettings,
  normalizeDoctorPaymentSettings
} from "@/lib/settings";

export const defaultDoctorPaymentModel: DoctorPaymentModel = defaultDoctorPaymentSettings;

export function normalizeDoctorPaymentModel(model?: Partial<DoctorPaymentModel>): DoctorPaymentModel {
  return normalizeDoctorPaymentSettings(model);
}

export function timeToMinutes(value = "12:00") {
  const [hours = "12", minutes = "0"] = value.split(":");

  return Number(hours) * 60 + Number(minutes);
}

export function isTimeInWindow(time: string, start: string, end: string) {
  const current = timeToMinutes(time);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes <= endMinutes) {
    return current >= startMinutes && current < endMinutes;
  }

  return current >= startMinutes || current < endMinutes;
}

export function hoursBetween(start: string, end: string) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const minutes =
    endMinutes >= startMinutes
      ? endMinutes - startMinutes
      : 24 * 60 - startMinutes + endMinutes;

  return minutes / 60;
}

export function currentTimeHHMM(timeZone = defaultSystemSettings.clinic.timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone
  }).format(new Date());
}
