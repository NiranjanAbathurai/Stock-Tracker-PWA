/**
 * Voice Service - Handles audio recording, API communication, and text-to-speech
 */

import { supabase } from '../config/supabase';

export type VoiceCommandResponse = {
  actions: VoiceAction[];
  needsMoreInfo: boolean;
  spokenResponse: string;
  userTranscript?: string;
  followUpQuestion: string | null;
};

export type VoiceAction = {
  type: 'add' | 'delete' | 'update_availability' | 'query';
  product: string;
  quantity?: string;
  stockType?: string;
  targetHome: string | null;
  targetHomeId: number | null;
  availability?: 'Yes' | 'No';
};

export type HomeContext = {
  id: number;
  name: string;
  products: Array<{
    id: number;
    product: string;
    quantity: string;
    stockType: string;
    availability: string;
    expiryDate?: string;
  }>;
};

export type ConversationMessage = {
  role: 'user' | 'assistant';
  text: string;
};

// ============================================================
// AUDIO RECORDING
// ============================================================

/**
 * Get the best supported audio MIME type for MediaRecorder
 */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  // Fallback - let the browser decide
  return '';
}

/**
 * Record audio from the user's microphone
 * Returns a promise that resolves with the audio blob when recording stops
 */
export function createAudioRecorder(): {
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob; mimeType: string }>;
  cancel: () => void;
  isRecording: () => boolean;
} {
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let stream: MediaStream | null = null;
  let resolveStop: ((value: { blob: Blob; mimeType: string }) => void) | null = null;
  let recording = false;

  const mimeType = getSupportedMimeType();

  return {
    async start() {
      audioChunks = [];
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }

      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
        recording = false;

        // Stop all tracks to release the microphone
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          stream = null;
        }

        if (resolveStop) {
          resolveStop({ blob, mimeType: mimeType || 'audio/webm' });
          resolveStop = null;
        }
      };

      mediaRecorder.start();
      recording = true;
    },

    stop() {
      return new Promise<{ blob: Blob; mimeType: string }>((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          resolve({ blob: new Blob(), mimeType: mimeType || 'audio/webm' });
          return;
        }
        resolveStop = resolve;
        mediaRecorder.stop();
      });
    },

    cancel() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      audioChunks = [];
      recording = false;
      resolveStop = null;
    },

    isRecording() {
      return recording;
    },
  };
}

// ============================================================
// API COMMUNICATION
// ============================================================

/**
 * Convert a Blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get the current user's JWT access token for authenticated API calls.
 */
async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please log in again.');
  }
  return session.access_token;
}

/**
 * Send voice command to the backend API (authenticated)
 */
export async function sendVoiceCommand(
  audioBlob: Blob,
  mimeType: string,
  homes: HomeContext[],
  conversationHistory: ConversationMessage[],
  catalogCategories: Array<{ name: string }>
): Promise<VoiceCommandResponse> {
  const base64Audio = await blobToBase64(audioBlob);
  const token = await getAccessToken();

  // Call the PWA's own Netlify function with JWT auth
  const response = await fetch(`/.netlify/functions/voice-command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      audio: base64Audio,
      mimeType,
      homes: homes.map((h) => ({
        id: h.id,
        name: h.name,
        products: h.products.map((p) => ({
          product: p.product,
          quantity: p.quantity,
          stockType: p.stockType,
          availability: p.availability,
        })),
      })),
      conversationHistory,
      catalogCategories,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Error: ${response.status}`);
  }

  return response.json();
}

/**
 * Send a TEXT command to the backend API (authenticated).
 * Uses a separate, lighter endpoint (text-command) that uses fewer tokens than voice.
 * Supports bulk commands like "Add milk, eggs 6, rice 2kg - all available"
 */
export async function sendTextCommand(
  text: string,
  homes: HomeContext[],
  conversationHistory: ConversationMessage[],
  catalogCategories: Array<{ name: string }>
): Promise<VoiceCommandResponse> {
  const token = await getAccessToken();

  const response = await fetch(`/.netlify/functions/text-command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      text,
      homes: homes.map((h) => ({
        id: h.id,
        name: h.name,
        products: h.products.map((p) => ({
          product: p.product,
          quantity: p.quantity,
          stockType: p.stockType,
          availability: p.availability,
          expiryDate: p.expiryDate || '',
        })),
      })),
      conversationHistory,
      catalogCategories,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Error: ${response.status}`);
  }

  return response.json();
}

// ============================================================
// TEXT-TO-SPEECH
// ============================================================

/**
 * Detect language from text (supports English, Tamil, Hindi)
 */
function detectLanguage(text: string): 'en' | 'ta' | 'hi' {
  // Tamil Unicode range: \u0B80-\u0BFF
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  // Hindi/Devanagari Unicode range: \u0900-\u097F
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return 'en';
}

/**
 * Speak text aloud using the browser's Speech Synthesis API
 * Automatically detects language (English/Tamil/Hindi) and picks the right voice
 * Returns a promise that resolves when speaking is complete
 */
export function speakText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Cancel any ongoing speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Configure voice settings
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Detect language and pick appropriate voice
    const lang = detectLanguage(text);
    const voices = window.speechSynthesis.getVoices();

    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (lang === 'en') {
      selectedVoice = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))
      );
    } else if (lang === 'ta') {
      // For Tamil, prefer Google Tamil voice (sounds most natural)
      selectedVoice =
        voices.find((v) => v.lang.startsWith('ta') && v.name.includes('Google')) ||
        voices.find((v) => v.lang === 'ta-IN') ||
        voices.find((v) => v.lang.startsWith('ta'));
    } else {
      // For Hindi or other languages
      selectedVoice =
        voices.find((v) => v.lang.startsWith(lang) && v.name.includes('Google')) ||
        voices.find((v) => v.lang.startsWith(lang));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      // Fallback: set lang so the browser tries its best
      utterance.lang = lang;
    }

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (event) => {
      // 'interrupted' and 'canceled' are not real errors
      if (event.error === 'interrupted' || event.error === 'canceled') {
        resolve();
      } else {
        reject(new Error(`Speech synthesis error: ${event.error}`));
      }
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if the browser supports speech synthesis
 */
export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * Check if the browser supports MediaRecorder (audio recording)
 */
export function isMediaRecorderSupported(): boolean {
  return 'MediaRecorder' in window && 'mediaDevices' in navigator;
}

// ============================================================
// BROWSER SPEECH RECOGNITION (fallback when Gemini is exhausted)
// ============================================================

/**
 * Check if the browser supports the Web Speech API (SpeechRecognition)
 */
export function isSpeechRecognitionSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

/**
 * Use the browser's built-in speech recognition to convert speech to text.
 * FREE (runs via Google's servers on Chrome/Android) — doesn't use Gemini tokens.
 * Supports English (Indian accent) and Tamil.
 *
 * @param lang - Language code: 'en-IN' for English (India), 'ta-IN' for Tamil
 * @returns Promise that resolves with the transcribed text
 */
export function browserSpeechToText(lang: string = 'en-IN'): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!SpeechRecognitionClass) {
      reject(new Error('Speech recognition not supported in this browser.'));
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let resolved = false;

    recognition.onresult = (event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => {
      if (resolved) return;
      resolved = true;
      const transcript = event.results[0]?.[0]?.transcript || '';
      resolve(transcript);
    };

    recognition.onerror = (event: { error: string }) => {
      if (resolved) return;
      resolved = true;
      if (event.error === 'no-speech') {
        reject(new Error('No speech detected. Please try again.'));
      } else if (event.error === 'not-allowed') {
        reject(new Error('Microphone permission denied.'));
      } else {
        reject(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Speech recognition ended without result.'));
      }
    };

    recognition.start();
  });
}
