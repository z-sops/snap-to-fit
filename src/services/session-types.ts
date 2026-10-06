export interface Session {
  token: string;
  refreshToken: string;
  userId: string;
  username: string;
  expiresAt: number;
}
