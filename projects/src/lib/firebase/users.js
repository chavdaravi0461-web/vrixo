import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

const USERS_COLLECTION = "users";

function toPublicJSON(userData, id) {
  return {
    id,
    name: userData.name,
    email: userData.email,
    image: userData.image || "",
    provider: userData.provider,
    role: userData.role || "user",
    createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.createdAt,
    lastLogin: userData.lastLogin?.toDate?.()?.toISOString() || userData.lastLogin,
  };
}

function userToSession(userData, id) {
  return {
    id,
    email: userData.email,
    name: userData.name,
    image: userData.image || "",
    role: userData.role || "user",
  };
}

export async function findUserByEmail(email) {
  try {
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("[Firebase] findUserByEmail error:", error);
    return null;
  }
}

export async function findUserById(id) {
  try {
    const doc = await db.collection(USERS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("[Firebase] findUserById error:", error);
    return null;
  }
}

export async function createUser({ name, email, image, password, provider, role }) {
  try {
    const docRef = db.collection(USERS_COLLECTION).doc();
    const userData = {
      name,
      email: email.toLowerCase(),
      image: image || "",
      provider: provider || "credentials",
      role: role || "user",
      createdAt: Timestamp.now(),
      lastLogin: Timestamp.now(),
    };
    if (password) {
      const salt = await bcrypt.genSalt(12);
      userData.password = await bcrypt.hash(password, salt);
    }
    await docRef.set(userData);
    return { ...userData, id: docRef.id };
  } catch (error) {
    console.error("[Firebase] createUser error:", error);
    throw error;
  }
}

export async function updateUser(email, updates) {
  try {
    const existing = await findUserByEmail(email);
    if (!existing) return null;
    const updateData = { ...updates };
    if (updateData.password) {
      const salt = await bcrypt.genSalt(12);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }
    await db.collection(USERS_COLLECTION).doc(existing.id).update(updateData);
    const updated = await db.collection(USERS_COLLECTION).doc(existing.id).get();
    return { id: updated.id, ...updated.data() };
  } catch (error) {
    console.error("[Firebase] updateUser error:", error);
    return null;
  }
}

export async function comparePassword(user, candidatePassword) {
  if (!user.password) return false;
  try {
    return bcrypt.compare(candidatePassword, user.password);
  } catch {
    return false;
  }
}

export { toPublicJSON, userToSession };
