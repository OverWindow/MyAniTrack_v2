export type DeviceType = 'web' | 'android' | 'ios'

export type AuthUser = {
  id: number | string
  email: string
  username: string
  profileImageUrl?: string | null
  bio?: string | null
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
  profileImageUrl?: string
  bio?: string
  deviceType: DeviceType
  deviceName: string
}

export type UpdateProfilePayload = {
  username?: string
  profileImage?: File | null
  removeProfileImage?: boolean
}

export type StoredSession = AuthTokens & {
  user: AuthUser | null
}
