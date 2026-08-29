export type FboType = {
  id: string;
  name: string;
};

export type UserType = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  displayName: string;
  photoURL: string;
  role: string;
  fbos: FboType[];
};

export type AuthState = {
  user: UserType | null;
  activeFbo: FboType | null;
  loading: boolean;
  error: string | null;
};

export type AuthContextValue = {
  user: UserType | null;
  activeFbo: FboType | null;
  loading: boolean;
  error: string | null;
  authenticated: boolean;
  unauthenticated: boolean;
  selectFbo: (fbo: FboType) => void;
  checkUserSession: () => Promise<void>;
};
