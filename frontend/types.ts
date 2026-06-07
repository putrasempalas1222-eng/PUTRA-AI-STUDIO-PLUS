export type Role = 'user' | 'model';
export type UserStatusRole = 'basic' | 'pro' | 'plus';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  status_role: UserStatusRole;
  roleExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface AccountDevice {
  id: string;
  name: string;
  userAgent: string;
  createdAt: string;
  lastActive: string;
  active: boolean;
  isCurrent?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data?: string; // Base64 encoded data (without the data:URI prefix)
  size?: number;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  attachments?: Attachment[];
  imageBase64?: string;
  mode?: string;
  thinking?: string;
  downloadDocx?: boolean;
  docxTitle?: string;
  animateTyping?: boolean;
  isStreaming?: boolean;
}

export interface SuggestedPrompt {
  id: string;
  text: string;
  label: string;
  iconName: 'compass' | 'lightbulb' | 'code' | 'trending';
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
}



