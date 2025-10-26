import admin from 'firebase-admin';

// Singleton pattern for Firebase Admin
let app: admin.app.App;

export function getFirebaseAdmin() {
  if (!app) {
    try {
      // Check if already initialized
      app = admin.app();
    } catch (error) {
      // Initialize if not already initialized
      app = admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  }
  return app;
}

export function getFirestore() {
  const app = getFirebaseAdmin();
  return admin.firestore(app);
}

export function getAuth() {
  const app = getFirebaseAdmin();
  return admin.auth(app);
}
