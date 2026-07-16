import type { DoctorPaymentModel, DoctorPaymentModelType } from "@/lib/types";
import { doctorPaymentSettingsStorageKey } from "@/lib/types";

export const systemSettingsStorageKey = "health-aid-system-settings-v1";

export const paymentModeValues = {
  onCall: "low_season",
  clinicShift: "peak_season"
} satisfies Record<string, DoctorPaymentModelType>;

export type ClinicSettings = {
  clinicName: string;
  brandLogo: string;
  address: string;
  phoneNumber: string;
  email: string;
  website: string;
  taxRegistration: string;
  timeZone: string;
  currency: string;
  localCurrency: string;
  dateFormat: string;
  timeFormat: string;
};

export type OperationalSettings = {
  defaultOperatingMode: DoctorPaymentModelType;
  lastChangedBy: string;
  lastChangedAt: string;
};

export type SeasonSettings = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

export type InvoiceSettings = {
  invoicePrefix: string;
  invoiceNumberFormat: string;
  automaticTimestamp: boolean;
  defaultCurrency: string;
  allowInvoiceEditing: boolean;
  allowInvoiceVoiding: boolean;
  printLayout: string;
};

export type InsuranceSettings = {
  defaultStatementFormat: string;
  defaultStatementNumberFormat: string;
  defaultDuePeriodDays: number;
  enablePartialPayments: boolean;
  defaultPaymentReferencePrefix: string;
};

export type UserSecuritySettings = {
  passwordPolicy: string;
  sessionTimeoutMinutes: number;
  twoFactorAuthentication: boolean;
  loginAttemptLimit: number;
  auditLoggingEnabled: boolean;
};

export type NotificationSettings = {
  emailNotifications: boolean;
  insuranceStatementNotifications: boolean;
  doctorPayoutNotifications: boolean;
  paymentReceivedNotifications: boolean;
};

export type BackupSystemSettings = {
  databaseStatus: string;
  lastBackup: string;
  environment: string;
  applicationVersion: string;
};

export type SystemSettings = {
  clinic: ClinicSettings;
  operational: OperationalSettings;
  seasons: SeasonSettings[];
  invoice: InvoiceSettings;
  doctorPayment: DoctorPaymentModel;
  insurance: InsuranceSettings;
  userSecurity: UserSecuritySettings;
  notifications: NotificationSettings;
  system: BackupSystemSettings;
};

export const defaultDoctorPaymentSettings: DoctorPaymentModel = {
  activeModel: paymentModeValues.onCall,
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

export const paymentModeLabels = {
  [paymentModeValues.onCall]: "On-Call Mode",
  [paymentModeValues.clinicShift]: "Clinic Shift Mode"
} satisfies Record<DoctorPaymentModelType, string>;

export const defaultSystemSettings: SystemSettings = {
  clinic: {
    clinicName: "Health Aid Arugambay",
    brandLogo: "/brand/health-aid-arugambay-logo.png",
    address: "64, Main Street Arugam Bay",
    phoneNumber: "+94711435435",
    email: "health.arugambay@gmail.com",
    website: "healthaidarugambay.com",
    taxRegistration: "",
    timeZone: "Asia/Colombo",
    currency: "USD",
    localCurrency: "LKR",
    dateFormat: "01 Jun 2026",
    timeFormat: "14:00"
  },
  operational: {
    defaultOperatingMode: paymentModeValues.onCall,
    lastChangedBy: "System",
    lastChangedAt: ""
  },
  seasons: [
    {
      id: "peak-east-coast",
      name: "Peak East Coast",
      startDate: "04-01",
      endDate: "09-30",
      active: true
    },
    {
      id: "low-season",
      name: "Low Season",
      startDate: "10-01",
      endDate: "03-31",
      active: true
    }
  ],
  invoice: {
    invoicePrefix: "HA-ABAY",
    invoiceNumberFormat: "{PREFIX}-{YYYY}-{0001}",
    automaticTimestamp: true,
    defaultCurrency: "USD",
    allowInvoiceEditing: false,
    allowInvoiceVoiding: false,
    printLayout: "Standard clinical invoice"
  },
  doctorPayment: defaultDoctorPaymentSettings,
  insurance: {
    defaultStatementFormat: "Monthly insurance statement",
    defaultStatementNumberFormat: "INS-{YYYY}-{MM}-{COMPANY}",
    defaultDuePeriodDays: 30,
    enablePartialPayments: true,
    defaultPaymentReferencePrefix: "INS-PAY"
  },
  userSecurity: {
    passwordPolicy: "Minimum 8 characters with letters and numbers",
    sessionTimeoutMinutes: 60,
    twoFactorAuthentication: false,
    loginAttemptLimit: 5,
    auditLoggingEnabled: true
  },
  notifications: {
    emailNotifications: false,
    insuranceStatementNotifications: false,
    doctorPayoutNotifications: false,
    paymentReceivedNotifications: false
  },
  system: {
    databaseStatus: "Demo/local data",
    lastBackup: "Not configured",
    environment: "Local demo",
    applicationVersion: "0.1.0"
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeSeason(season: Partial<SeasonSettings>, index: number): SeasonSettings {
  const fallback = defaultSystemSettings.seasons[index] ?? {
    id: `season-${index + 1}`,
    name: `Season ${index + 1}`,
    startDate: "01-01",
    endDate: "12-31",
    active: true
  };

  return {
    id: season.id || fallback.id,
    name: season.name || fallback.name,
    startDate: season.startDate || fallback.startDate,
    endDate: season.endDate || fallback.endDate,
    active: season.active ?? fallback.active
  };
}

export function normalizeSystemSettings(settings?: Partial<SystemSettings>): SystemSettings {
  const doctorPayment = normalizeDoctorPaymentSettings(settings?.doctorPayment);
  const activeModel =
    settings?.operational?.defaultOperatingMode ??
    doctorPayment.activeModel ??
    defaultSystemSettings.operational.defaultOperatingMode;
  const seasons =
    settings?.seasons && settings.seasons.length > 0
      ? settings.seasons.map(normalizeSeason)
      : defaultSystemSettings.seasons;

  return {
    clinic: {
      ...defaultSystemSettings.clinic,
      ...settings?.clinic
    },
    operational: {
      ...defaultSystemSettings.operational,
      ...settings?.operational,
      defaultOperatingMode: activeModel
    },
    seasons,
    invoice: {
      ...defaultSystemSettings.invoice,
      ...settings?.invoice
    },
    doctorPayment: {
      ...doctorPayment,
      activeModel
    },
    insurance: {
      ...defaultSystemSettings.insurance,
      ...settings?.insurance
    },
    userSecurity: {
      ...defaultSystemSettings.userSecurity,
      ...settings?.userSecurity
    },
    notifications: {
      ...defaultSystemSettings.notifications,
      ...settings?.notifications
    },
    system: {
      ...defaultSystemSettings.system,
      ...settings?.system
    }
  };
}

export function normalizeDoctorPaymentSettings(
  model?: Partial<DoctorPaymentModel>
): DoctorPaymentModel {
  return {
    activeModel: model?.activeModel ?? defaultDoctorPaymentSettings.activeModel,
    lowSeason: {
      ...defaultDoctorPaymentSettings.lowSeason,
      ...model?.lowSeason
    },
    peakSeason: {
      ...defaultDoctorPaymentSettings.peakSeason,
      ...model?.peakSeason
    }
  };
}

export function parseStoredSystemSettings(value: string | null): SystemSettings {
  if (!value) {
    return normalizeSystemSettings();
  }

  try {
    const parsed = JSON.parse(value);
    return normalizeSystemSettings(isRecord(parsed) ? parsed : undefined);
  } catch {
    return normalizeSystemSettings();
  }
}

export function loadSystemSettings(): SystemSettings {
  if (typeof window === "undefined") {
    return normalizeSystemSettings();
  }

  const storedSettings = window.localStorage.getItem(systemSettingsStorageKey);
  const normalized = parseStoredSystemSettings(storedSettings);

  if (!storedSettings) {
    const legacyPaymentSettings = window.localStorage.getItem(doctorPaymentSettingsStorageKey);

    if (legacyPaymentSettings) {
      try {
        const doctorPayment = normalizeDoctorPaymentSettings(JSON.parse(legacyPaymentSettings));
        return normalizeSystemSettings({
          ...normalized,
          operational: {
            ...normalized.operational,
            defaultOperatingMode: doctorPayment.activeModel
          },
          doctorPayment
        });
      } catch {
        return normalized;
      }
    }
  }

  return normalized;
}

export function saveSystemSettings(settings: SystemSettings) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeSystemSettings(settings);
  window.localStorage.setItem(systemSettingsStorageKey, JSON.stringify(normalized));
  window.localStorage.setItem(
    doctorPaymentSettingsStorageKey,
    JSON.stringify(normalized.doctorPayment)
  );
}

export function invoiceCurrency(settings: SystemSettings = defaultSystemSettings) {
  return settings.clinic.currency;
}

export function localCurrency(settings: SystemSettings = defaultSystemSettings) {
  return settings.clinic.localCurrency;
}

export function currencyLabel(label: string, currency: string) {
  return `${label} ${currency}`;
}

export function currencyLabelParenthetical(label: string, currency: string) {
  return `${label} (${currency})`;
}

export function updateSettingsSection<Key extends keyof SystemSettings>(
  settings: SystemSettings,
  key: Key,
  value: SystemSettings[Key]
) {
  return normalizeSystemSettings({
    ...settings,
    [key]: value
  });
}
