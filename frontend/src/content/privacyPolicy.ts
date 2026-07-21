export const PRIVACY_POLICY_VERSION = 'v1.0'
export const PRIVACY_POLICY_EFFECTIVE_DATE = '2026-07-20'
export const PRIVACY_POLICY_UPDATED_DATE = '2026-07-20'
export const SERVICE_NAME = '마이애니트랙'
export const SERVICE_OPERATOR = '김현진'
export const PRIVACY_CONTACT_EMAIL = 'myanitrack.official@gmail.com'

export type PrivacyPolicySection = {
  id: string
  title: string
  paragraphs: string[]
  items?: string[]
}

export type PolicyProcessor = {
  provider: string
  purpose: string
  data: string
  region: string
  retention: string
}

export const PRIVACY_POLICY_SUMMARY = [
  '마이애니트랙은 회원 식별과 로그인, 애니메이션 컬렉션·평점·진도 저장, 개인 분석과 친구 기능 제공을 위해 필요한 정보를 처리합니다.',
  '이메일 계정의 비밀번호 원문은 저장하지 않고 단방향 해시만 저장합니다. Google 로그인 사용자의 Google 비밀번호는 마이애니트랙에 전달되거나 저장되지 않습니다.',
  '계정 삭제 시 활성 서비스 데이터는 삭제 요청 처리 과정에서 제거됩니다. 프로필 이미지는 최대 72시간, 운영 백업은 최대 30일, 보안·장애 대응 로그는 최대 90일 동안 제한적으로 남을 수 있습니다.',
]

export const POLICY_PROCESSORS: PolicyProcessor[] = [
  {
    provider: 'Google 로그인',
    purpose: 'Google 계정 인증',
    data: '이메일, Google 계정 식별 정보',
    region: 'Google의 글로벌 인프라',
    retention: 'Google 정책 및 계정 이용 기간에 따름',
  },
  {
    provider: 'Google Analytics (웹)',
    purpose: '웹사이트 이용 현황 및 서비스 개선',
    data: 'IP 등 접속 환경, 기기·브라우저·이용 이벤트 정보',
    region: 'Google의 글로벌 인프라',
    retention: 'Google Analytics 설정 및 Google 정책에 따름',
  },
  {
    provider: 'Supabase',
    purpose: '인증, 세션 및 프로필 이미지 저장',
    data: '계정 식별자, 인증 토큰, 프로필 이미지',
    region: 'Northeast Asia (Seoul)',
    retention: '계정 삭제 시 제거, 프로필 이미지는 최대 72시간',
  },
  {
    provider: 'Vercel',
    purpose: '웹사이트 제공 및 전송',
    data: '웹 요청과 기본 접속 정보',
    region: '글로벌 인프라',
    retention: '보안·운영 정책상 최대 90일',
  },
  {
    provider: 'Railway',
    purpose: 'API 서버 운영',
    data: '계정 및 서비스 이용 데이터, 서버 요청 정보',
    region: 'Southeast Asia',
    retention: '서비스 이용 기간, 운영 로그는 최대 90일',
  },
  {
    provider: 'Railway MySQL',
    purpose: '서비스 데이터베이스 운영',
    data: '계정, 프로필, 컬렉션, 친구 및 동의 기록',
    region: 'Southeast Asia',
    retention: '계정 삭제 시 활성 DB에서 제거, 백업은 최대 30일',
  },
]

export const PRIVACY_POLICY_SECTIONS: PrivacyPolicySection[] = [
  {
    id: 'controller',
    title: '1. 개인정보처리자',
    paragraphs: [
      `${SERVICE_NAME} 웹사이트와 모바일 앱의 개인정보처리자는 ${SERVICE_OPERATOR}입니다. 개인정보 관련 문의와 권리 행사는 ${PRIVACY_CONTACT_EMAIL}로 접수할 수 있습니다.`,
    ],
  },
  {
    id: 'collection',
    title: '2. 수집하는 정보',
    paragraphs: [
      '서비스는 회원가입과 이용 과정에서 사용자가 제공하거나 서비스 이용으로 생성되는 다음 정보를 처리합니다.',
    ],
    items: [
      '계정 정보: 이메일, Supabase 사용자 식별자, 앱 내부 사용자 식별자',
      '인증 정보: 이메일 계정 비밀번호의 단방향 해시, 로그인 세션과 refresh token. Google 비밀번호는 전달받지 않음',
      '프로필 정보: 사용자명, 소개, 사용자가 업로드한 프로필 이미지',
      '서비스 이용 정보: 애니메이션 컬렉션, 감상 상태, 진도, 점수, 날짜, 메모, 최애 작품과 배지 진행 상태',
      '관계 및 공개 정보: 친구 관계와 요청, 공개 프로필·컬렉션·점수·분석 결과',
      '동의 기록: 이용약관과 개인정보처리방침 동의 여부, 문서 버전과 동의 시각',
      '웹 운영 정보: Google Analytics를 통해 처리되는 IP 등 접속 환경, 기기·브라우저 정보와 이용 이벤트, 서버 보안·오류 로그',
    ],
  },
  {
    id: 'purpose',
    title: '3. 수집 및 이용 목적',
    paragraphs: ['수집한 정보는 다음 목적 범위에서 이용합니다.'],
    items: [
      '회원 식별, 이메일 또는 Google 로그인과 세션 유지',
      '컬렉션, 평점, 진도, 메모와 프로필 저장',
      '개인 통계, 추천, Viewing DNA, 장르·시리즈·스튜디오·성우 랭킹 제공',
      '친구 검색과 요청, 공개 프로필·컬렉션·분석 제공',
      '서비스 이용 현황 분석, 기능 개선, 문의 및 장애 대응',
      '부정 이용 방지와 계정·서비스 보안 유지',
    ],
  },
  {
    id: 'visibility',
    title: '4. 다른 사용자에게 공개되는 정보',
    paragraphs: [
      '현재 서비스에는 항목별 공개·비공개 설정 기능이 없습니다. 사용자명, 소개, 프로필 이미지, 친구 상태, 공개 컬렉션과 점수, 배지와 최애 작품, 기록을 기반으로 생성된 공개 분석 결과가 다른 사용자에게 표시될 수 있습니다.',
      '이메일, 인증 토큰, 내부 사용자 식별자와 비밀번호 해시는 다른 사용자에게 공개하지 않습니다.',
    ],
  },
  {
    id: 'retention',
    title: '5. 보관 및 파기',
    paragraphs: [
      '개인정보는 원칙적으로 서비스 이용 기간 동안 보관하며, 계정 삭제 요청이 정상 처리되면 활성 데이터베이스의 계정과 연결된 컬렉션, 분석 원천 데이터, 친구 관계, 프로필 및 동의 기록을 제거합니다.',
      '저장소의 프로필 이미지는 삭제 요청 후 최대 72시간, 운영 백업의 삭제 데이터는 최대 30일, 보안·부정 이용 방지·장애 대응 로그는 최대 90일 동안 접근이 제한된 상태로 남을 수 있으며 기간이 지나면 파기합니다. 법령상 의무가 있는 경우에는 해당 근거와 기간에 따라 필요한 범위만 별도 보관합니다.',
    ],
  },
  {
    id: 'processors',
    title: '6. 처리 위탁 및 국외 처리',
    paragraphs: [
      '서비스 운영을 위해 아래 공급자를 이용합니다. Supabase는 Northeast Asia (Seoul), Railway와 Railway MySQL은 Southeast Asia 리전에서 처리되며, 그 밖의 글로벌 공급자는 대한민국 외 지역에서 정보를 처리할 수 있습니다.',
      'AniList 등 애니메이션 정보 공급자는 사용자 개인정보를 전달하는 처리 위탁자가 아니라 외부 콘텐츠 출처입니다.',
    ],
  },
  {
    id: 'sharing',
    title: '7. 제3자 제공',
    paragraphs: [
      '서비스는 이용자의 개인정보를 판매하지 않습니다. 위 처리 위탁, 이용자의 별도 동의, 법령에 따른 요청 또는 생명·안전 보호를 위해 필요한 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.',
    ],
  },
  {
    id: 'rights',
    title: '8. 이용자의 권리',
    paragraphs: [
      '이용자는 프로필과 설정 화면에서 자신의 정보를 조회·수정하고, 웹 또는 모바일 앱에서 계정 삭제를 요청할 수 있습니다. 로그인할 수 없는 경우 문의 이메일을 통해 본인 확인 절차를 거쳐 삭제를 요청할 수 있습니다.',
      '계정 삭제와 개인정보 관련 요청은 합리적인 기간 안에 처리하며, 계정 삭제 후에는 기존 컬렉션과 분석을 복구할 수 없습니다.',
    ],
  },
  {
    id: 'security',
    title: '9. 보안 조치',
    paragraphs: [
      '서비스는 HTTPS 전송, 인증 토큰으로 보호된 API, 서버 측 접근 권한 제한, 클라이언트에서의 비밀키 제외, 비밀번호 단방향 해시, 보안·오류 로그 점검 등 합리적인 보호 조치를 적용합니다.',
    ],
  },
  {
    id: 'children',
    title: '10. 아동의 개인정보',
    paragraphs: [
      '서비스는 만 14세 미만 아동을 대상으로 하지 않으며 만 14세 미만 이용자의 가입을 의도적으로 받지 않습니다. 만 14세 미만 이용자의 정보가 보호자 동의 없이 수집된 사실을 확인하면 본인 또는 보호자 확인 후 해당 계정과 정보를 삭제합니다.',
    ],
  },
  {
    id: 'changes',
    title: '11. 정책 변경',
    paragraphs: [
      '정책이 변경되면 적용일 전에 웹사이트 또는 앱에서 안내합니다. 이용자 권리에 중대한 영향을 주는 변경은 충분한 사전 안내와 필요한 경우 재동의 절차를 진행합니다. 이전 버전 확인이 필요하면 개인정보 문의 이메일로 요청할 수 있습니다.',
    ],
  },
]
