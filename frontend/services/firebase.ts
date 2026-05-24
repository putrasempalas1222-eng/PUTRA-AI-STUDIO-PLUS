import { initializeApp } from "firebase/app";
import { User, getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { ChatSession, Message } from "../types";

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
export const db = getFirestore(app);
export const storage = getStorage(app);

// --- Firestore Helpers ---

export const ensureUserDocument = async (user: User) => {
  try {
    const userRef = doc(db, `users/${user.uid}`);
    const now = new Date().toISOString();

    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : now,
      updatedAt: now
    }, { merge: true });
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
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

      return serializedMsg;
    }));

    await setDoc(sessionRef, {
      id: sessionId,
      userId,
      title,
      createdAt: sessionCreatedAt,
      updatedAt: now,
      messageCount: serializedMessages.length,
      lastMessage: serializedMessages[serializedMessages.length - 1]?.text?.slice(0, 240) || '',
      messages: serializedMessages
    }, { merge: true });
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
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
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
    
    return history;
  } catch (error) {
    console.error("Error fetching chat history:", error);
    throw error;
  }
};
