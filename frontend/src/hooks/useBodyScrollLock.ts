import { useEffect } from 'react'

type BodyStyleSnapshot = {
  left: string
  overflow: string
  paddingRight: string
  position: string
  right: string
  top: string
  width: string
}

let lockCount = 0
let lockedScrollY = 0
let bodyStyleSnapshot: BodyStyleSnapshot | null = null

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) {
      return
    }

    if (lockCount === 0) {
      lockedScrollY = window.scrollY
      bodyStyleSnapshot = {
        left: document.body.style.left,
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
        position: document.body.style.position,
        right: document.body.style.right,
        top: document.body.style.top,
        width: document.body.style.width,
      }

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      const currentPaddingRight = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0

      document.body.style.position = 'fixed'
      document.body.style.top = `-${lockedScrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'

      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`
      }
    }

    lockCount += 1

    return () => {
      lockCount = Math.max(0, lockCount - 1)

      if (lockCount !== 0 || !bodyStyleSnapshot) {
        return
      }

      const restoreScrollY = lockedScrollY
      document.body.style.position = bodyStyleSnapshot.position
      document.body.style.top = bodyStyleSnapshot.top
      document.body.style.left = bodyStyleSnapshot.left
      document.body.style.right = bodyStyleSnapshot.right
      document.body.style.width = bodyStyleSnapshot.width
      document.body.style.overflow = bodyStyleSnapshot.overflow
      document.body.style.paddingRight = bodyStyleSnapshot.paddingRight
      bodyStyleSnapshot = null
      window.scrollTo(0, restoreScrollY)
    }
  }, [isLocked])
}
