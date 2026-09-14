import { tr } from '../i18n'
import type { ViewingDnaAxis } from '../types/stats'

export const SERIES_COMPLETION_DESCRIPTION =
  tr("완주 계산 대상 작품을 1편 이상 완료한 시리즈 중 필수 작품을 모두 완료한 비율입니다.")

export const SERIES_COMPLETION_EXCLUSION_NOTE =
  tr("음악·총집편·컴필레이션·미공개·취소 작품은 완주 계산에서 제외돼요.")

export function getViewingDnaAxisDescription(axis: ViewingDnaAxis) {
  return axis.key === 'seriesCompletion' ? SERIES_COMPLETION_DESCRIPTION : axis.description
}
