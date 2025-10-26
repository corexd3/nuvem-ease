"use client"
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};


// Initialize Firebase only on client side
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

export const handleCreateInvoice = async (data: any) => {
  if(!auth.currentUser) {
    throw new Error("User not authenticated");
  }

  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch("https://us-central1-kip-assistent.cloudfunctions.net/createInvoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({invoiceData : data}),
  });
  const res = await response.json();
  if(!response.ok) throw new Error(res.error || "Error creating invoice");
  return res;
}

export const handleGetInvoiceStatus = async (data: any) => {
  const getInvoiceStatus = httpsCallable(functions, 'getInvoiceStatus');
  return await getInvoiceStatus(data);
}

export const handleCancelInvoice = async (data: any) => {
  const cancelInvoice = httpsCallable(functions, 'cancelInvoice');
  return await cancelInvoice(data);
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
