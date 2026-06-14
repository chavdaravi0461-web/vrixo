import admin from "firebase-admin";

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch {
      console.warn("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY, falling back to ADC");
    }
  }
  return undefined;
}

function initializeAdmin() {
  if (admin.apps.length > 0) return admin.apps[0];

  const serviceAccount = getServiceAccount();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vrixo-58b8f";

  if (serviceAccount) {
    return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  return admin.initializeApp({ projectId });
}

const app = initializeAdmin();
const auth = admin.auth(app);
const db = admin.firestore(app);

export { admin, app, auth, db };
