import { initializeApp } from "firebase/app";
import { User, getAuth } from "firebase/auth";
import { initializeFirestore, doc, setDoc, collection, getDocs, query, orderBy, writeBatch, Timestamp, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { AccountDevice, ChatSession, Message, UserProfile, UserStatusRole } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyCMdkeIeIQToOSwO6zRj04rbAvZaI2A5KE",
  authDomain: "play-integrity-2adpr7x4a8xhyex.firebaseapp.com",
  databaseURL: "https://play-integrity-2adpr7x4a8xhyex-default-rtdb.firebaseio.com",
  projectId: "play-integrity-2adpr7x4a8xhyex",
  storageBucket: "play-integrity-2adpr7x4a8xhyex.firebasestorage.app",
  messagingSenderId: "520643585460",
  appId: "1:520643585460:web:8fca11aa17ac027cdf3ee1",
  measurementId: "G-M0ZB0W59H2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});
export const storage = getStorage(app);

// --- Firestore Helpers ---

const DEFAULT_USER_ROLE: UserStatusRole = 'basic';
const CHAT_RETENTION_DAYS = 90;
const MAX_ACTIVE_DEVICES = 3;
const DEVICE_AUTO_LOGOUT_DAYS = 7;

const isRoleExpired = (expiresAt?: unknown) => {
  if (typeof expiresAt !== 'string' || !expiresAt) return false;
  const expiryDate = new Date(expiresAt);
  return Number.isFinite(expiryDate.getTime()) && expiryDate.getTime() <= Date.now();
};

const getEffectiveRole = (role: unknown, expiresAt?: unknown): UserStatusRole => {
  const normalizedRole = role === 'pro' || role === 'plus' ? role : DEFAULT_USER_ROLE;
  return normalizedRole !== DEFAULT_USER_ROLE && isRoleExpired(expiresAt) ? DEFAULT_USER_ROLE : normalizedRole;
};

const getChatExpiryDate = (date = new Date()) => {
  const expiryDate = new Date(date);
  expiryDate.setDate(expiryDate.getDate() + CHAT_RETENTION_DAYS);
  return expiryDate;
};

const getChatRetentionCutoff = () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CHAT_RETENTION_DAYS);
  return cutoffDate;
};

const getDeviceExpiryCutoff = () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DEVICE_AUTO_LOGOUT_DAYS);
  return cutoffDate;
};

const mapDeviceDoc = (docId: string, data: any, currentDeviceId?: string): AccountDevice => ({
  id: docId,
  name: String(data.name || 'Perangkat tidak dikenal'),
  userAgent: String(data.userAgent || ''),
  createdAt: String(data.createdAt || new Date().toISOString()),
  lastActive: String(data.lastActive || data.createdAt || new Date().toISOString()),
  active: data.active !== false,
  isCurrent: currentDeviceId ? docId === currentDeviceId : false,
});

export const getUserDevices = async (userId: string, currentDeviceId?: string): Promise<AccountDevice[]> => {
  const devicesRef = collection(db, `users/${userId}/devices`);
  const q = query(devicesRef, orderBy('lastActive', 'desc'));
  const snapshot = await getDocs(q);
  const cutoff = getDeviceExpiryCutoff();
  const batch = writeBatch(db);
  const devices: AccountDevice[] = [];

  snapshot.forEach((deviceDoc) => {
    const device = mapDeviceDoc(deviceDoc.id, deviceDoc.data(), currentDeviceId);
    const lastActive = new Date(device.lastActive);
    const isExpired = !Number.isFinite(lastActive.getTime()) || lastActive < cutoff;

    if (device.active && isExpired) {
      batch.set(deviceDoc.ref, {
        active: false,
        autoLoggedOutAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      devices.push({ ...device, active: false });
      return;
    }

    devices.push(device);
  });

  await batch.commit();
  return devices;
};

export const registerUserDevice = async (
  userId: string,
  deviceId: string,
  name: string,
  userAgent: string,
): Promise<{ allowed: boolean; devices: AccountDevice[]; limit: number }> => {
  const now = new Date().toISOString();
  const devices = await getUserDevices(userId, deviceId);
  const activeDevices = devices.filter((device) => device.active);
  const currentDevice = activeDevices.find((device) => device.id === deviceId);

  if (!currentDevice && activeDevices.length >= MAX_ACTIVE_DEVICES) {
    return { allowed: false, devices: activeDevices, limit: MAX_ACTIVE_DEVICES };
  }

  await setDoc(doc(db, `users/${userId}/devices/${deviceId}`), removeUndefinedFields({
    id: deviceId,
    name,
    userAgent,
    active: true,
    createdAt: currentDevice?.createdAt || now,
    lastActive: now,
    updatedAt: now,
  }), { merge: true });

  return {
    allowed: true,
    devices: await getUserDevices(userId, deviceId),
    limit: MAX_ACTIVE_DEVICES,
  };
};

export const updateUserDeviceHeartbeat = async (userId: string, deviceId: string) => {
  await setDoc(doc(db, `users/${userId}/devices/${deviceId}`), {
    active: true,
    lastActive: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
};

export const logoutUserDevice = async (userId: string, deviceId: string) => {
  await setDoc(doc(db, `users/${userId}/devices/${deviceId}`), {
    active: false,
    loggedOutAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
};

const removeUndefinedFields = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedFields);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, itemValue]) => itemValue !== undefined)
        .map(([key, itemValue]) => [key, removeUndefinedFields(itemValue)]),
    );
  }

  return value;
};

export const ensureUserDocument = async (user: User): Promise<UserProfile> => {
  try {
    const userRef = doc(db, `users/${user.uid}`);
    const now = new Date().toISOString();
    const snapshot = await getDoc(userRef);
    const existingData = snapshot.exists() ? snapshot.data() : {};
    const roleExpiresAt = typeof existingData.roleExpiresAt === 'string' ? existingData.roleExpiresAt : null;
    const storedRole: UserStatusRole = existingData.status_role === 'pro' || existingData.status_role === 'plus' ? existingData.status_role : DEFAULT_USER_ROLE;
    const statusRole = getEffectiveRole(storedRole, roleExpiresAt);
    const createdAt = typeof existingData.createdAt === 'string'
      ? existingData.createdAt
      : user.metadata.creationTime
        ? new Date(user.metadata.creationTime).toISOString()
        : now;

    const profile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      photoURL: user.photoURL,
      status_role: statusRole,
      roleExpiresAt: statusRole === DEFAULT_USER_ROLE ? null : roleExpiresAt,
      createdAt,
      updatedAt: now,
    };

    const writableProfile = {
      ...profile,
      status_role: storedRole,
      roleExpiresAt: storedRole === DEFAULT_USER_ROLE ? null : roleExpiresAt,
    };

    await setDoc(userRef, removeUndefinedFields(writableProfile), { merge: true });
    return profile;
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userRef = doc(db, `users/${userId}`);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    uid: data.uid || userId,
    email: data.email || null,
    displayName: data.displayName || null,
    phoneNumber: data.phoneNumber || null,
    photoURL: data.photoURL || null,
    status_role: getEffectiveRole(data.status_role, data.roleExpiresAt),
    roleExpiresAt: typeof data.roleExpiresAt === 'string' ? data.roleExpiresAt : null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
};


export const updateUserDisplayName = async (userId: string, displayName: string) => {
  const now = new Date().toISOString();
  await setDoc(doc(db, `users/${userId}`), removeUndefinedFields({
    displayName,
    updatedAt: now,
  }), { merge: true });
};

export const saveChatSession = async (userId: string, sessionId: string, title: string, messages: Message[]) => {
  try {
    const sessionRef = doc(db, `users/${userId}/chats/${sessionId}`);
    const now = new Date().toISOString();
    const sessionCreatedAt = Number.isFinite(Number(sessionId)) ? new Date(Number(sessionId)).toISOString() : now;
    
    // Convert Date objects to ISO strings. Generated image data URLs are moved to Storage
    // so chat documents stay small and images still load from history.
    const serializedMessages = await Promise.all(messages.map(async (msg) => {
      const serializedMsg: any = {
        ...msg,
        timestamp: msg.timestamp.toISOString()
      };

      delete serializedMsg.animateTyping;

      if (msg.imageBase64?.startsWith('data:image/')) {
        const extension = msg.imageBase64.match(/^data:image\/([^;]+);base64,/)?.[1] || 'png';
        const imageRef = ref(storage, `users/${userId}/chat-images/${sessionId}/${msg.id}.${extension}`);
        await uploadString(imageRef, msg.imageBase64, 'data_url');
        serializedMsg.imageBase64 = await getDownloadURL(imageRef);
      }

      if (msg.attachments) {
        serializedMsg.attachments = msg.attachments.map(att => ({
          id: att.id,
          name: att.name,
          mimeType: att.mimeType
          // Intentionally omitting 'data' (base64) to save Firestore space
        }));
      }

      return removeUndefinedFields(serializedMsg);
    }));

    await setDoc(sessionRef, removeUndefinedFields({
      id: sessionId,
      userId,
      title,
      createdAt: sessionCreatedAt,
      updatedAt: now,
      expiresAt: Timestamp.fromDate(getChatExpiryDate()),
      messageCount: serializedMessages.length,
      lastMessage: serializedMessages[serializedMessages.length - 1]?.text?.slice(0, 240) || '',
      messages: serializedMessages
    }), { merge: true });
  } catch (error) {
    console.error("Error saving chat session:", error);
    throw error;
  }
};

export const getUserChatHistory = async (userId: string): Promise<ChatSession[]> => {
  try {
    const chatsRef = collection(db, `users/${userId}/chats`);
    const q = query(chatsRef, orderBy("updatedAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    const history: ChatSession[] = [];
    const expiredBatch = writeBatch(db);
    let expiredCount = 0;
    const retentionCutoff = getChatRetentionCutoff();

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;

      if (!updatedAt || updatedAt < retentionCutoff) {
        expiredBatch.delete(doc.ref);
        expiredCount += 1;
        return;
      }
      
      // Deserialize ISO strings back to Date objects
      const deserializedMessages = (data.messages || []).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      history.push({
        id: data.id,
        title: data.title,
        updatedAt: data.updatedAt,
        messages: deserializedMessages
      });
    });

    if (expiredCount > 0) {
      await expiredBatch.commit();
    }
    
    return history;
  } catch (error) {
    console.error("Error fetching chat history:", error);
    throw error;
  }
};
