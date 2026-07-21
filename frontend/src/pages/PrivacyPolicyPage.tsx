import { Link } from 'react-router-dom'
import {
  POLICY_PROCESSORS,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_UPDATED_DATE,
  PRIVACY_POLICY_VERSION,
  SERVICE_OPERATOR,
} from '../content/privacyPolicy'
import { useDocumentMetadata } from '../hooks/useDocumentMetadata'
import '../styles/pages/PolicyPages.css'

export function PrivacyPolicyPage() {
  useDocumentMetadata({
    title: '개인정보처리방침 | 마이애니트랙',
    description: '마이애니트랙 웹 및 모바일 앱의 개인정보 수집, 이용, 공개, 보관 및 삭제 정책입니다.',
    canonicalPath: '/privacy',
  })

  return (
    <article className="policy-page">
      <header className="policy-hero">
        <span className="policy-eyebrow">Privacy policy</span>
        <h1>마이애니트랙 개인정보처리방침</h1>
        <p>웹사이트와 모바일 앱에서 개인정보를 어떻게 수집하고 이용하며 보호하는지 안내합니다.</p>
        <dl className="policy-meta-grid">
          <div><dt>문서 버전</dt><dd>{PRIVACY_POLICY_VERSION}</dd></div>
          <div><dt>시행일</dt><dd>{PRIVACY_POLICY_EFFECTIVE_DATE}</dd></div>
          <div><dt>최종 변경일</dt><dd>{PRIVACY_POLICY_UPDATED_DATE}</dd></div>
          <div><dt>운영자</dt><dd>{SERVICE_OPERATOR}</dd></div>
        </dl>
        <div className="policy-hero-actions">
          <Link className="primary-button" to="/account-deletion">계정 및 데이터 삭제</Link>
          <a className="secondary-button" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>개인정보 문의</a>
        </div>
      </header>

      <nav className="policy-toc" aria-label="개인정보처리방침 목차">
        <strong>목차</strong>
        <ol>
          {PRIVACY_POLICY_SECTIONS.map((section) => (
            <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
          ))}
        </ol>
      </nav>

      <div className="policy-content">
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <section className="policy-section" id={section.id} key={section.id}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.items && (
              <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
            )}
            {section.id === 'processors' && (
              <div className="policy-table-wrap" tabIndex={0} aria-label="개인정보 처리 위탁 업체 표">
                <table>
                  <thead>
                    <tr><th>공급자</th><th>처리 목적</th><th>처리 항목</th><th>국가·지역</th><th>보관 기간</th></tr>
                  </thead>
                  <tbody>
                    {POLICY_PROCESSORS.map((processor) => (
                      <tr key={processor.provider}>
                        <th scope="row">{processor.provider}</th>
                        <td>{processor.purpose}</td>
                        <td>{processor.data}</td>
                        <td>{processor.region}</td>
                        <td>{processor.retention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {section.id === 'rights' && (
              <p><Link to="/account-deletion">계정 및 데이터 삭제 페이지로 이동</Link></p>
            )}
          </section>
        ))}
      </div>

      <footer className="policy-footer">
        <strong>개인정보 문의</strong>
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>
        <Link to="/">마이애니트랙 홈으로 돌아가기</Link>
      </footer>
    </article>
  )
}
