import {
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  TwitterAuthProvider,
  signOut as _signOut,
  signInWithEmailLink,
  signInWithCustomToken,
} from 'firebase/auth';

import axios from 'src/lib/axios';
import { AUTH } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export type VerifyOtpParams = {
  phone: string;
  otp: string;
  otpSession: string;
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(AUTH, provider);
  return result.user;
};

export const signInWithGithub = async () => {
  const provider = new GithubAuthProvider();
  await signInWithPopup(AUTH, provider);
};

export const signInWithTwitter = async () => {
  const provider = new TwitterAuthProvider();
  await signInWithPopup(AUTH, provider);
};

export const sendMagicLink = async (email: string, continueUrl: string) => {
  await axios.post('/api/v1/auth/magic-link', { email, continueUrl });
  window.localStorage.setItem('emailForSignIn', email);
};

export const completeMagicLinkSignIn = async (email: string, url: string) => {
  const result = await signInWithEmailLink(AUTH, email, url);
  window.localStorage.removeItem('emailForSignIn');
  return result.user;
};

export const sendPhoneOtp = async (phone: string) => {
  const { data } = await axios.post('/api/v1/auth/phone/request-otp', { phone });
  return data.otpSession as string;
};

export const verifyPhoneOtp = async ({ phone, otp, otpSession }: VerifyOtpParams) => {
  const { data } = await axios.post('/api/v1/auth/phone/verify-otp', {
    phone,
    code: otp,
    otpSession,
  });
  const result = await signInWithCustomToken(AUTH, data.token);
  return result.user;
};

export const signOut = async () => {
  await _signOut(AUTH);
  window.localStorage.removeItem('firebaseIdToken');
  window.localStorage.removeItem('activeFboId');
};

export const getSignInMethods = () => {
  const providerIds = AUTH.currentUser?.providerData.map((p) => p.providerId) ?? [];
  return {
    google: providerIds.includes('google.com'),
    emailLink: providerIds.includes('password') || providerIds.includes('emailLink'),
    phone: providerIds.includes('phone'),
  };
};
