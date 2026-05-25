export type Role = 'user' | 'model';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data?: string; // Base64 encoded data (without the data:URI prefix)
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  attachments?: Attachment[];
  imageBase64?: string;
  mode?: string;
  downloadDocx?: boolean;
  docxTitle?: string;
  animateTyping?: boolean;
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
