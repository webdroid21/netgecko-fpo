import {
  signInWithPopup,
  RecaptchaVerifier,
  GoogleAuthProvider,
  GithubAuthProvider,
  TwitterAuthProvider,
  signInWithEmailLink,
  signOut as _signOut,
  sendSignInLinkToEmail,
  signInWithPhoneNumber,
  sendEmailVerification as _sendEmailVerification,
  sendPasswordResetEmail as _sendPasswordResetEmail,
  createUserWithEmailAndPassword as _createUserWithEmailAndPassword,
} from 'firebase/auth';

import { AUTH } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export type VerifyOtpParams = {
  confirmationResult: any;
  otp: string;
};

export type SignUpParams = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
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

export const signUp = async ({ email, password, firstName, lastName }: SignUpParams) => {
  const newUser = await _createUserWithEmailAndPassword(AUTH, email, password);
  await _sendEmailVerification(newUser.user);
  // Note: a matching record in Airtable is still required to log in.
  return newUser;
};

export const sendPasswordResetEmail = async ({ email }: { email: string }) => {
  await _sendPasswordResetEmail(AUTH, email);
};

export const sendMagicLink = async (email: string, continueUrl: string) => {
  const actionCodeSettings = { url: continueUrl, handleCodeInApp: true };
  await sendSignInLinkToEmail(AUTH, email, actionCodeSettings);
  window.localStorage.setItem('emailForSignIn', email);
};

export const completeMagicLinkSignIn = async (email: string, url: string) => {
  const result = await signInWithEmailLink(AUTH, email, url);
  window.localStorage.removeItem('emailForSignIn');
  return result.user;
};

export const sendPhoneOtp = async (phone: string, containerId: string) => {
  const recaptcha = new RecaptchaVerifier(AUTH, containerId, { size: 'invisible' });
  const confirmationResult = await signInWithPhoneNumber(AUTH, phone, recaptcha);
  return confirmationResult;
};

export const verifyPhoneOtp = async ({ confirmationResult, otp }: VerifyOtpParams) => {
  const result = await confirmationResult.confirm(otp);
  return result.user;
};

export const signOut = async () => {
  await _signOut(AUTH);
};
