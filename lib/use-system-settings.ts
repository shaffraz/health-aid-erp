"use client";

import { useEffect, useState } from "react";
import {
  loadSystemSettings,
  normalizeSystemSettings,
  systemSettingsStorageKey,
  systemSettingsUpdatedEventName,
  type SystemSettings
} from "@/lib/settings";

export function useSystemSettings() {
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() =>
    normalizeSystemSettings()
  );

  useEffect(() => {
    function loadLatestSettings() {
      try {
        setSystemSettings(loadSystemSettings());
      } catch {
        setSystemSettings(normalizeSystemSettings());
      }
    }

    function handleSettingsUpdated(event: Event) {
      const customEvent = event as CustomEvent<SystemSettings | undefined>;

      if (customEvent.detail) {
        setSystemSettings(normalizeSystemSettings(customEvent.detail));
        return;
      }

      loadLatestSettings();
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === systemSettingsStorageKey) {
        loadLatestSettings();
      }
    }

    loadLatestSettings();
    window.addEventListener(systemSettingsUpdatedEventName, handleSettingsUpdated);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(systemSettingsUpdatedEventName, handleSettingsUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return systemSettings;
}
