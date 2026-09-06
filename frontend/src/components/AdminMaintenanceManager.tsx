import { useEffect, useState } from 'react'
import { useAppLanguage } from '../contexts/LanguageContext'
import { useMaintenance } from '../contexts/MaintenanceContext'
import { fetchMaintenanceSettings, updateMaintenanceSettings } from '../lib/maintenance'
import type { MaintenanceSettings, MaintenanceSettingsUpdate } from '../types/maintenance'
import { ErrorToast } from './ErrorToast'

function toDraft(settings: MaintenanceSettings): MaintenanceSettingsUpdate {
  return {
    enabled: settings.enabled,
    title: { ...settings.title },
    message: { ...settings.message },
  }
}

export function AdminMaintenanceManager() {
  const { formatDateTime } = useAppLanguage()
  const { syncSettings } = useMaintenance()
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null)
  const [draft, setDraft] = useState<MaintenanceSettingsUpdate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadSettings = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const nextSettings = await fetchMaintenanceSettings()
      setSettings(nextSettings)
      setDraft(toDraft(nextSettings))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '점검 모드 설정을 불러오지 못했어요.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isCancelled = false

    void fetchMaintenanceSettings()
      .then((nextSettings) => {
        if (isCancelled) return
        setSettings(nextSettings)
        setDraft(toDraft(nextSettings))
      })
      .catch((loadError: unknown) => {
        if (isCancelled) return
        setError(loadError instanceof Error ? loadError.message : '점검 모드 설정을 불러오지 못했어요.')
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [])

  const setLocalizedValue = (
    section: 'title' | 'message',
    locale: 'ko' | 'en',
    value: string,
  ) => {
    setDraft((current) => current ? {
      ...current,
      [section]: {
        ...current[section],
        [locale]: value,
      },
    } : current)
    setSuccessMessage(null)
  }

  const saveSettings = async (enabled: boolean, success: string) => {
    if (!draft) {
      return
    }

    if (enabled && !settings?.enabled) {
      const confirmed = window.confirm(
        '점검 모드를 켜면 새로 접속하거나 새로고침한 일반 사용자에게 점검 페이지가 표시됩니다. 계속할까요?',
      )

      if (!confirmed) {
        return
      }
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const nextSettings = await updateMaintenanceSettings({ ...draft, enabled })
      setSettings(nextSettings)
      setDraft(toDraft(nextSettings))
      syncSettings(nextSettings)
      setSuccessMessage(success)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '점검 모드 설정을 저장하지 못했어요.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="feedback-card">점검 모드 설정을 불러오는 중...</div>
  }

  if (!settings || !draft) {
    return (
      <div className="admin-maintenance-manager">
        <ErrorToast message={error} />
        <button className="secondary-button" type="button" onClick={() => { void loadSettings() }}>
          다시 불러오기
        </button>
      </div>
    )
  }

  const hasInvalidField = [
    draft.title.ko,
    draft.title.en,
    draft.message.ko,
    draft.message.en,
  ].some((value) => value.trim().length === 0)

  return (
    <div className="admin-maintenance-manager">
      <ErrorToast message={error} />

      <div className={settings.enabled ? 'admin-maintenance-status is-active' : 'admin-maintenance-status'}>
        <div>
          <span className="admin-maintenance-dot" aria-hidden="true" />
          <strong>{settings.enabled ? '점검 모드 ON' : '정상 운영 중'}</strong>
        </div>
        <p>
          {settings.enabled
            ? '새로 접속하거나 새로고침한 일반 사용자에게 점검 안내가 표시됩니다.'
            : '모든 사용자가 웹 서비스를 정상적으로 이용할 수 있습니다.'}
        </p>
        <small>마지막 변경: {formatDateTime(settings.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}</small>
      </div>

      <div className="admin-maintenance-form">
        <section className="admin-maintenance-locale" aria-labelledby="maintenance-ko-heading">
          <div>
            <span className="detail-label">Korean</span>
            <h3 id="maintenance-ko-heading">한국어 안내</h3>
          </div>
          <label className="field-label">
            <span>제목</span>
            <input
              value={draft.title.ko}
              maxLength={120}
              onChange={(event) => setLocalizedValue('title', 'ko', event.target.value)}
            />
            <small>{draft.title.ko.length} / 120</small>
          </label>
          <label className="field-label">
            <span>안내 문구</span>
            <textarea
              value={draft.message.ko}
              maxLength={1000}
              rows={5}
              onChange={(event) => setLocalizedValue('message', 'ko', event.target.value)}
            />
            <small>{draft.message.ko.length} / 1000</small>
          </label>
        </section>

        <section className="admin-maintenance-locale" aria-labelledby="maintenance-en-heading">
          <div>
            <span className="detail-label">English</span>
            <h3 id="maintenance-en-heading">영어 안내</h3>
          </div>
          <label className="field-label">
            <span>제목</span>
            <input
              value={draft.title.en}
              maxLength={120}
              onChange={(event) => setLocalizedValue('title', 'en', event.target.value)}
            />
            <small>{draft.title.en.length} / 120</small>
          </label>
          <label className="field-label">
            <span>안내 문구</span>
            <textarea
              value={draft.message.en}
              maxLength={1000}
              rows={5}
              onChange={(event) => setLocalizedValue('message', 'en', event.target.value)}
            />
            <small>{draft.message.en.length} / 1000</small>
          </label>
        </section>
      </div>

      {successMessage && <div className="admin-maintenance-success" role="status">{successMessage}</div>}

      <div className="admin-maintenance-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={isSaving || hasInvalidField}
          onClick={() => { void saveSettings(settings.enabled, '점검 안내 문구를 저장했어요.') }}
        >
          {isSaving ? '저장 중...' : '문구 저장'}
        </button>
        <button
          className={settings.enabled ? 'secondary-button admin-maintenance-disable' : 'primary-button'}
          type="button"
          disabled={isSaving || hasInvalidField}
          onClick={() => {
            void saveSettings(
              !settings.enabled,
              settings.enabled ? '점검 모드를 종료했어요.' : '점검 모드를 시작했어요.',
            )
          }}
        >
          {settings.enabled ? '점검 모드 끄기' : '점검 모드 켜기'}
        </button>
      </div>
    </div>
  )
}
