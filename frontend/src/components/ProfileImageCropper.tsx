import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { ImagePlus, RotateCcw, X } from 'lucide-react'

type ProfileImageCropperProps = {
  onApply: (file: File) => void
  onClose: () => void
}

type Size = { width: number; height: number }
type Offset = { x: number; y: number }

const OUTPUT_SIZE = 512
const MIN_ZOOM = 1
const MAX_ZOOM = 3
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg'])
const ACCEPTED_IMAGE_EXTENSION = /\.(png|jpe?g)$/i

function getCropGeometry(image: Size, viewportSize: number, zoom: number) {
  const baseScale = Math.max(viewportSize / image.width, viewportSize / image.height)
  const scale = baseScale * zoom

  return {
    scale,
    maxOffsetX: Math.max(0, (image.width * scale - viewportSize) / 2),
    maxOffsetY: Math.max(0, (image.height * scale - viewportSize) / 2),
  }
}

function clampOffset(offset: Offset, image: Size, viewportSize: number, zoom: number): Offset {
  if (!image.width || !image.height || !viewportSize) {
    return offset
  }

  const { maxOffsetX, maxOffsetY } = getCropGeometry(image, viewportSize, zoom)
  return {
    x: Math.min(maxOffsetX, Math.max(-maxOffsetX, offset.x)),
    y: Math.min(maxOffsetY, Math.max(-maxOffsetY, offset.y)),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('편집한 이미지를 생성하지 못했어요.'))
      }
    }, 'image/jpeg', quality)
  })
}

export function ProfileImageCropper({ onApply, onClose }: ProfileImageCropperProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const imageSizeRef = useRef<Size>({ width: 0, height: 0 })
  const zoomRef = useRef(MIN_ZOOM)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    offset: Offset
  } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [viewportSize, setViewportSize] = useState(0)
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !modalRef.current) {
        return
      }

      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([tabindex="-1"])',
      ))

      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const updateViewportSize = () => {
      const nextViewportSize = viewport.clientWidth
      setViewportSize(nextViewportSize)
      setOffset((current) => clampOffset(
        current,
        imageSizeRef.current,
        nextViewportSize,
        zoomRef.current,
      ))
    }

    updateViewportSize()
    const observer = new ResizeObserver(updateViewportSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [dataUrl])

  const geometry = useMemo(
    () => imageSize.width && viewportSize
      ? getCropGeometry(imageSize, viewportSize, zoom)
      : null,
    [imageSize, viewportSize, zoom],
  )

  const resetCrop = () => {
    zoomRef.current = MIN_ZOOM
    imageSizeRef.current = { width: 0, height: 0 }
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
    setImageSize({ width: 0, height: 0 })
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    event.currentTarget.value = ''

    if (!nextFile) {
      return
    }

    if (!ACCEPTED_IMAGE_TYPES.has(nextFile.type) && !ACCEPTED_IMAGE_EXTENSION.test(nextFile.name)) {
      setError('PNG, JPG, JPEG 파일만 선택할 수 있어요.')
      return
    }

    setError(null)
    resetCrop()
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('선택한 이미지를 읽지 못했어요.')
        return
      }

      setFile(nextFile)
      setDataUrl(reader.result)
    }
    reader.onerror = () => setError('선택한 이미지를 읽지 못했어요.')
    reader.readAsDataURL(nextFile)
  }

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget
    const nextImageSize = { width: image.naturalWidth, height: image.naturalHeight }

    if (!nextImageSize.width || !nextImageSize.height) {
      setError('선택한 이미지의 크기를 확인하지 못했어요.')
      return
    }

    imageSizeRef.current = nextImageSize
    setImageSize(nextImageSize)
    setOffset((current) => clampOffset(current, nextImageSize, viewportSize, zoomRef.current))
    setError(null)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!geometry) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    setOffset(clampOffset({
      x: drag.offset.x + event.clientX - drag.startX,
      y: drag.offset.y + event.clientY - drag.startY,
    }, imageSize, viewportSize, zoom))
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsDragging(false)
  }

  const handleZoomChange = (nextZoom: number) => {
    zoomRef.current = nextZoom
    setZoom(nextZoom)
    setOffset((current) => clampOffset(current, imageSizeRef.current, viewportSize, nextZoom))
  }

  const handleApply = async () => {
    const image = imageRef.current
    if (!file || !image || !geometry || !viewportSize) {
      setError('PNG 또는 JPEG 이미지를 선택해주세요.')
      return
    }

    setIsApplying(true)
    setError(null)

    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('이미지 편집 기능을 사용할 수 없는 브라우저예요.')
      }

      const sourceSize = viewportSize / geometry.scale
      const sourceX = imageSize.width / 2 - (viewportSize / 2 + offset.x) / geometry.scale
      const sourceY = imageSize.height / 2 - (viewportSize / 2 + offset.y) / geometry.scale

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      let blob = await canvasToBlob(canvas, 0.92)
      if (blob.size > MAX_UPLOAD_SIZE) blob = await canvasToBlob(canvas, 0.82)
      if (blob.size > MAX_UPLOAD_SIZE) throw new Error('편집한 이미지가 5MB를 초과해요.')

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'profile-image'
      onApply(new File([blob], `${baseName}-cropped.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      }))
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : '이미지를 편집하지 못했어요.')
    } finally {
      setIsApplying(false)
    }
  }

  return createPortal(
    <div
      className="profile-cropper-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isApplying) onClose()
      }}
    >
      <div
        ref={modalRef}
        className="profile-cropper-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-cropper-title"
      >
        <div className="profile-image-cropper-heading">
          <div>
            <strong id="profile-cropper-title">프로필 이미지 수정</strong>
            <span>PNG, JPG 또는 JPEG 이미지를 선택하고 프레임을 맞춰주세요.</span>
          </div>
          <button
            ref={closeButtonRef}
            className="profile-cropper-icon-button"
            type="button"
            aria-label="프로필 이미지 수정 닫기"
            disabled={isApplying}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <button
          className="profile-cropper-file-button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={18} aria-hidden="true" />
          <span>{dataUrl ? '다른 이미지 선택' : '이미지 선택'}</span>
        </button>
        <input
          ref={fileInputRef}
          className="profile-cropper-file-input"
          type="file"
          accept="image/png,image/jpeg,.png,.jpg,.jpeg"
          tabIndex={-1}
          onChange={handleFileChange}
        />

        {dataUrl && (
          <>
            <div
              ref={viewportRef}
              className={`profile-cropper-viewport${isDragging ? ' is-dragging' : ''}`}
              aria-label="프로필 이미지 위치 조절 영역"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              <img
                ref={imageRef}
                src={dataUrl}
                alt="선택한 프로필 이미지"
                draggable={false}
                onLoad={handleImageLoad}
                onError={() => setError('선택한 PNG 또는 JPEG 이미지를 불러오지 못했어요.')}
                style={geometry ? {
                  width: imageSize.width,
                  height: imageSize.height,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${geometry.scale})`,
                } : undefined}
              />
              <span className="profile-cropper-grid" aria-hidden="true" />
              <span className="profile-cropper-guide" aria-hidden="true" />
            </div>

            <label className="profile-cropper-zoom">
              <span>확대</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.01"
                value={zoom}
                disabled={!geometry || isApplying}
                onChange={(event) => handleZoomChange(Number(event.target.value))}
              />
              <output>{Math.round(zoom * 100)}%</output>
            </label>
          </>
        )}

        {error && <div className="feedback-card is-error">{error}</div>}

        <div className="profile-cropper-actions">
          {dataUrl && (
            <button className="secondary-button" type="button" disabled={isApplying} onClick={resetCrop}>
              <RotateCcw size={17} aria-hidden="true" />
              초기화
            </button>
          )}
          <button className="secondary-button" type="button" disabled={isApplying} onClick={onClose}>
            취소
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!geometry || Boolean(error) || isApplying}
            onClick={() => { void handleApply() }}
          >
            {isApplying ? '적용 중...' : '프레임 적용'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
