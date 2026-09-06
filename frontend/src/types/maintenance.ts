export type LocalizedMaintenanceText = {
  ko: string
  en: string
}

export type MaintenanceSettings = {
  enabled: boolean
  title: LocalizedMaintenanceText
  message: LocalizedMaintenanceText
  updatedAt: string
}

export type MaintenanceSettingsUpdate = Omit<MaintenanceSettings, 'updatedAt'>

export type MaintenanceSettingsResponse = {
  success: boolean
  item: MaintenanceSettings
  message?: string
}
