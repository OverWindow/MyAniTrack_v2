import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import type { VoiceActorCharacterWorkGroup } from '../lib/voiceActorCharacterWorks'
import '../styles/components/VoiceActorCharacterWorks.css'

export function VoiceActorCharacterWorks({
  groups,
  variant,
  onNavigate,
}: {
  groups: VoiceActorCharacterWorkGroup[]
  variant: 'detail' | 'modal'
  onNavigate?: () => void
}) {
  const [expandedCharacterId, setExpandedCharacterId] = useState<number | null>(null)

  return (
    <>
      {groups.map((group) => {
        const primaryWork = group.works[0]
        const additionalWorks = group.works.slice(1)
        const isExpanded = expandedCharacterId === group.character.id

        return (
          <article
            className={`voice-character-work-card is-${variant}${isExpanded ? ' is-expanded' : ''}`}
            key={group.character.id}
          >
            <div className="voice-character-work-person">
              <img
                src={getProfileImageSrc(group.character.image)}
                alt={group.character.name}
                loading="lazy"
                onError={handleProfileImageError}
              />
              <span>
                <small>Character</small>
                <strong>{group.character.name}</strong>
                {group.character.nativeName && <em>{group.character.nativeName}</em>}
                {group.character.meta && <em>{group.character.meta}</em>}
              </span>
            </div>

            <Link
              className="voice-character-primary-work"
              to={`/anime/${primaryWork.id}`}
              onClick={onNavigate}
            >
              <img
                src={getProfileImageSrc(primaryWork.image)}
                alt={primaryWork.title}
                loading="lazy"
                onError={handleProfileImageError}
              />
              <span>
                <small>{primaryWork.label || 'Anime'}</small>
                <strong>{primaryWork.title}</strong>
                {primaryWork.meta && <em>{primaryWork.meta}</em>}
              </span>
            </Link>

            <div className="voice-character-work-actions">
              <span>{group.works.length.toLocaleString()}편</span>
              {additionalWorks.length > 0 && (
                <button
                  className="voice-character-work-kebab"
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`voice-character-more-${variant}-${group.character.id}`}
                  aria-label={`${group.character.name}의 다른 출연 작품 ${additionalWorks.length}편 ${isExpanded ? '접기' : '보기'}`}
                  onClick={() => setExpandedCharacterId((current) => (
                    current === group.character.id ? null : group.character.id
                  ))}
                >
                  <span aria-hidden="true">⋮</span>
                </button>
              )}
            </div>

            {isExpanded && additionalWorks.length > 0 && (
              <div
                className="voice-character-more-works"
                id={`voice-character-more-${variant}-${group.character.id}`}
              >
                <div className="voice-character-more-heading">
                  <strong>다른 출연 작품</strong>
                  <span>{additionalWorks.length.toLocaleString()}편</span>
                </div>
                <div className="voice-character-more-list">
                  {additionalWorks.map((work) => (
                    <Link key={work.id} to={`/anime/${work.id}`} onClick={onNavigate}>
                      <img
                        src={getProfileImageSrc(work.image)}
                        alt=""
                        loading="lazy"
                        onError={handleProfileImageError}
                      />
                      <span>
                        <strong>{work.title}</strong>
                        {work.meta && <small>{work.meta}</small>}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>
        )
      })}
    </>
  )
}
