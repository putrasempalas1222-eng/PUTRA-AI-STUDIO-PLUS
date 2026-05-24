import { SuggestedPrompt } from './types';

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    id: 'p1',
    label: 'Explain complex topics',
    text: 'Explain quantum computing in simple terms to a high school student.',
    iconName: 'lightbulb'
  },
  {
    id: 'p2',
    label: 'Financial advice',
    text: 'What is the main difference between a Roth IRA and a Traditional IRA?',
    iconName: 'trending'
  },
  {
    id: 'p3',
    label: 'Write code',
    text: 'Write a React component that fetches data from an API and displays it in a list.',
    iconName: 'code'
  },
  {
    id: 'p4',
    label: 'Plan a trip',
    text: 'Plan a 3-day itinerary for a cultural trip to Kyoto, Japan.',
    iconName: 'compass'
  }
];

export const SYSTEM_INSTRUCTION = `
You are Putra Ai, a highly capable, helpful, and friendly AI assistant.
Your goal is to provide clear, accurate, and insightful answers to any question the user asks.
You are knowledgeable in a wide range of topics including technology, finance, science, arts, and general knowledge.

Guidelines:
1. Be conversational but professional.
2. Use markdown formatting (bolding, bullet points, code blocks) to make your responses easy to read.
3. If you don't know the answer, admit it politely.
4. Keep your answers concise unless the user asks for a detailed explanation.
`;
