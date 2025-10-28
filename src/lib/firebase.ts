"use client"
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy-key-for-build",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};


// Initialize Firebase only on client side and when not in build mode
const app = typeof window !== 'undefined' && !getApps().length
  ? initializeApp(firebaseConfig)
  : !getApps().length
    ? initializeApp(firebaseConfig)
    : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

export const handleIssueNFe = async (data: any) => {
  const issueNFe = httpsCallable(functions, 'issueNFe_sandbox');
  const result = await issueNFe(data);
  return result.data; // Return the actual data, not the wrapped response
}

export const handleQueryInvoice = async (data: any) => {
  const queryInvoice = httpsCallable(functions, 'queryInvoice_sandbox', {
    timeout: 60000 // 60 second timeout
  });
  try {
    const result = await queryInvoice(data);
    return result.data;
  } catch (error: any) {
    console.error('handleQueryInvoice error:', error);
    // Re-throw with more context
    throw new Error(error.message || 'Failed to query invoice');
  }
}

export const handleCancelInvoice = async (data: any) => {
  const cancelInvoice = httpsCallable(functions, 'cancelInvoice_sandbox', {
    timeout: 60000 // 60 second timeout
  });
  try {
    const result = await cancelInvoice(data);
    return result.data;
  } catch (error: any) {
    console.error('handleCancelInvoice error:', error);
    // Re-throw with more context
    throw new Error(error.message || 'Failed to cancel invoice');
  }
}

export const handleGenerateInvoicePDF = async (data: any) => {
  const generateInvoicePDF = httpsCallable(functions, 'generateInvoicePDF');
  return await generateInvoicePDF(data);
}

export const handleSendInvoiceEmail = async (data: any) => {
  const sendInvoiceEmail = httpsCallable(functions, 'sendInvoiceEmail');
  return await sendInvoiceEmail(data);
}

export const handleGetDashboardStats = async (data: any) => {
  const getDashboardStats = httpsCallable(functions, 'getDashboardStats');
  return await getDashboardStats(data);
}

export const handleGetRecentInvoices = async (data: any) => {
  const getRecentInvoices = httpsCallable(functions, 'getRecentInvoices');
  return await getRecentInvoices(data);
}

export const handleGetInvoiceDetails = async (data: any) => {
  const getInvoiceDetails = httpsCallable(functions, 'getInvoiceDetails');
  return await getInvoiceDetails(data);
}

export const handleGetUserProfile = async (data: any) => {
  const getUserProfile = httpsCallable(functions, 'getUserProfile');
  return await getUserProfile(data);
}

export const handleUpdateUserProfile = async (data: any) => {
  const updateUserProfile = httpsCallable(functions, 'updateUserProfile');
  return await updateUserProfile(data);
}

export const handleUploadUserDocument = async (data: any) => {
  const uploadUserDocument = httpsCallable(functions, 'uploadUserDocument');
  return await uploadUserDocument(data);
}
export const handleGetUserDocuments = async (data: any) => {
  const getUserDocuments = httpsCallable(functions, 'getUserDocuments');
  return await getUserDocuments(data);
}
export const handleDeleteUserDocument = async (data: any) => {
  const deleteUserDocument = httpsCallable(functions, 'deleteUserDocument');
  return await deleteUserDocument(data);
}
export const handleGetAvailableServices = async (data: any) => {
  const getAvailableServices = httpsCallable(functions, 'getAvailableServices');
  return await getAvailableServices(data);
}
export const handleSubscribeService = async (data: any) => {
  const subscribeService = httpsCallable(functions, 'subscribeService');
  return await subscribeService(data);
}
export const handleUnsubscribeService = async (data: any) => {
  const unsubscribeService = httpsCallable(functions, 'unsubscribeService');
  return await unsubscribeService(data);
}
