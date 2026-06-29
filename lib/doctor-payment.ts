import type { DoctorPaymentModel } from "@/lib/types";

export const defaultDoctorPaymentModel: DoctorPaymentModel = {
  activeModel: "low_season",
  lowSeason: {
    dayConsultationPayout: 2500,
    nightConsultationPayout: 3500,
    nightStartTime: "23:00",
    nightEndTime: "08:00"
  },
  peakSeason: {
    shiftStartTime: "16:00",
    shiftEndTime: "22:00",
    hourlyRate: 1000,
    bonusThresholdPatients: 5,
    bonusPerPatient: 1000
  }
};

export function normalizeDoctorPaymentModel(model?: Partial<DoctorPaymentModel>): DoctorPaymentModel {
  return {
    activeModel: model?.activeModel ?? defaultDoctorPaymentModel.activeModel,
    lowSeason: {
      ...defaultDoctorPaymentModel.lowSeason,
      ...model?.lowSeason
    },
    peakSeason: {
      ...defaultDoctorPaymentModel.peakSeason,
      ...model?.peakSeason
    }
  };
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

export function currentTimeHHMM() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Colombo"
  }).format(new Date());
}
