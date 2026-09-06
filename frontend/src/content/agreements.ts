import { tr } from '../i18n'
import { PRIVACY_POLICY_SUMMARY } from './privacyPolicy'

export const TERMS_VERSION = 'v1.1'
export const AGREEMENT_VERSION = TERMS_VERSION

export type AgreementKey = 'terms' | 'privacy' | 'data'

export type AgreementSection = {
  title: string
  body: string[]
}

export const AGREEMENT_SECTIONS: Record<AgreementKey, AgreementSection> = {
  terms: {
    title: tr("이용약관"),
    body: [
      tr("제1조 (목적) 본 약관은 MyAniTrack(이하 \"서비스\")가 제공하는 애니메이션 기록, 추천, 친구 기능 등 관련 서비스의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다."),
      tr("제2조 (서비스의 내용) 서비스는 애니메이션 시청 기록 및 관리, 즐겨찾기 및 평점 등록, 사용자 맞춤 추천 및 분석 기능, 사용자 간 친구 추가 및 활동 조회 기능을 제공합니다."),
      tr("제3조 (계정 및 이용자 책임) 이용자는 계정 정보를 안전하게 관리할 책임이 있으며, 계정 도용 또는 부정 사용으로 발생하는 문제에 대해 서비스는 책임을 지지 않습니다."),
      tr("제4조 (프로필 콘텐츠) 성적·폭력적 이미지, 술·담배·약물 조장, 혐오·괴롭힘, 불법 콘텐츠, 스팸·사칭 이미지를 프로필에 등록하는 행위는 금지됩니다."),
      tr("제5조 (신고 및 차단) 이용자는 부적절한 프로필을 신고하고 다른 사용자를 차단할 수 있으며, 서비스는 신고를 검토해 이미지 제거 또는 계정 정지 조치를 할 수 있습니다."),
      tr("제6조 (서비스 변경 및 중단) 서비스는 운영상 또는 기술상의 필요에 따라 일부 기능을 변경하거나 중단할 수 있습니다."),
      tr("제7조 (계정 제한 및 삭제) 서비스는 이용약관을 위반한 경우 사전 통지 없이 프로필 이미지 제거, 계정 제한 또는 삭제 조치를 할 수 있습니다."),
      tr("제8조 (책임 제한) 서비스는 추천 및 분석 결과의 정확성이나 완전성을 보장하지 않으며, 이로 인해 발생하는 문제에 대해 책임을 지지 않습니다."),
      tr("제9조 (약관의 변경) 본 약관은 필요에 따라 변경될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다."),
    ],
  },
  privacy: {
    title: tr("개인정보처리방침"),
    body: PRIVACY_POLICY_SUMMARY,
  },
  data: {
    title: tr("데이터 출처 및 고지"),
    body: [
      tr("본 서비스의 애니메이션 정보는 AniList 등 외부 공개 API를 기반으로 제공되며, 해당 데이터의 저작권은 각 콘텐츠 제공자 및 권리자에게 있습니다."),
      tr("서비스는 정보를 가공하여 제공할 수 있으나 원 저작권을 주장하지 않습니다."),
      tr("추천 및 분석 기능은 이용자의 시청 기록과 평가 데이터를 기반으로 생성되며, 정확성을 보장하지 않으므로 참고 자료로 활용해야 합니다."),
      tr("친구 기능을 통해 일부 시청 기록, 평점, 활동 정보가 다른 사용자에게 공개될 수 있으므로 이용자는 공개 범위를 충분히 인지하고 서비스를 이용해야 합니다."),
    ],
  },
}

export const AGREEMENT_ORDER: AgreementKey[] = ['terms', 'privacy', 'data']
