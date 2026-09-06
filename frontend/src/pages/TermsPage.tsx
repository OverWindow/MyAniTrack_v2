import { tr } from '../i18n'
import { Link } from 'react-router-dom'
import { AGREEMENT_SECTIONS, TERMS_VERSION } from '../content/agreements'
import { useDocumentMetadata } from '../hooks/useDocumentMetadata'
import '../styles/pages/PolicyPages.css'

export function TermsPage() {
  useDocumentMetadata({
    title: tr("이용약관 | 마이애니트랙"),
    description: tr("마이애니트랙 서비스 이용약관입니다."),
    canonicalPath: '/terms',
  })

  const terms = AGREEMENT_SECTIONS.terms

  return (
    <article className="policy-page">
      <header className="policy-hero">
        <span className="policy-eyebrow">Terms of service</span>
        <h1>{tr("마이애니트랙 이용약관")}</h1>
        <p>{tr("마이애니트랙 서비스를 이용할 때 적용되는 기본 조건을 안내합니다.")}</p>
        <dl className="policy-meta-grid">
          <div><dt>{tr("문서 버전")}</dt><dd>{TERMS_VERSION}</dd></div>
        </dl>
      </header>

      <div className="policy-content">
        <section className="policy-section">
          <h2>{terms.title}</h2>
          {terms.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      </div>

      <footer className="policy-footer">
        <Link to="/privacy">{tr("개인정보처리방침 보기")}</Link>
        <Link to="/">{tr("마이애니트랙 홈으로 돌아가기")}</Link>
      </footer>
    </article>
  )
}
