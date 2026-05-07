export type DeviceType = 'web' | 'android' | 'ios'

export type AuthRole = 'ADMIN' | 'USER' | string

export type AuthUser = {
  id: number | string
  email: string
  username: string
  profileImageUrl?: string | null
  bio?: string | null
  role?: AuthRole
  isAdmin?: boolean
  emailVerified?: boolean
  emailVerifiedAt?: string | null
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
  accessTokenExpiresIn: number
  tokenType: string
}

export type AuthResponse = AuthTokens & {
  user: AuthUser
}

export type SignupResponse = {
  success: boolean
  message: string
  requiresEmailVerification: boolean
  user: AuthUser
}

export type VerifyEmailResendResponse = {
  success: boolean
  message: string
  email: string
  requiresEmailVerification: boolean
}

export type VerifyEmailConfirmResponse = {
  success: boolean
  message: string
  user: AuthUser
}

export type PasswordResetRequestResponse = {
  success: boolean
  message: string
  email: string
  sent: boolean
}

export type PasswordResetConfirmResponse = {
  success: boolean
  message: string
  email: string
  reset: boolean
}

export type LoginPayload = {
  email: string
  password: string
  deviceType: DeviceType
  deviceName: string
}

export type SignupPayload = {
  email: string
  username: string
  password: string
  deviceType: DeviceType
  deviceName: string
}

export type UpdateProfilePayload = {
  username?: string
  profileImage?: File | null
  removeProfileImage?: boolean
}

export type UpdateAgreementsPayload = {
  termsAgreed?: boolean
  termsVersion?: string
  privacyAgreed?: boolean
  privacyVersion?: string
}

export type UserAgreements = {
  termsAgreed: boolean
  privacyAgreed: boolean
  agreedAt: string | null
  termsVersion: string | null
  privacyVersion: string | null
}

export type StoredSession = AuthTokens & {
  user: AuthUser | null
  accessTokenExpiresAt: number
}
