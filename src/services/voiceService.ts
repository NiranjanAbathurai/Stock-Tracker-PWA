/**
 * Voice Service - Handles audio recording, API communication, and text-to-speech
 */

export type VoiceCommandResponse = {
  actions: VoiceAction[];
  needsMoreInfo: boolean;
  spokenResponse: string;
  userTranscript?: string;
  followUpQuestion: string | null;
};

export type VoiceAction = {
  type: 'add' | 'delete' | 'update_availability';
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
 * Send voice command to the backend API
 */
export async function sendVoiceCommand(
  audioBlob: Blob,
  mimeType: string,
  homes: HomeContext[],
  conversationHistory: ConversationMessage[],
  catalogCategories: Array<{ name: string }>
): Promise<VoiceCommandResponse> {
  const base64Audio = await blobToBase64(audioBlob);

   // Call the PWA's own Netlify function directly
  const response = await fetch(`/.netlify/functions/voice-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

// ============================================================
// TEXT-TO-SPEECH
// ============================================================

/**
 * Speak text aloud using the browser's Speech Synthesis API
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

    // Try to use a natural-sounding English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
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
