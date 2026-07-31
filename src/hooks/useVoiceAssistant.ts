import { useState, useCallback, useRef } from 'react';
import {
  createAudioRecorder,
  sendVoiceCommand,
  speakText,
  stopSpeaking,
  isMediaRecorderSupported,
  isSpeechSynthesisSupported,
  type VoiceCommandResponse,
  type VoiceAction,
  type HomeContext,
  type ConversationMessage,
} from '../services/voiceService';
import type { HomeItem, CatalogCategory, Product } from '../types';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

type UseVoiceAssistantProps = {
  homes: HomeItem[];
  catalog: CatalogCategory[];
  onAddProduct: (homeId: number, data?: Partial<Omit<Product, 'id' | 'isExpired'>>) => Promise<unknown>;
  onDeleteProduct: (homeId: number, productId: number) => Promise<void>;
  onUpdateProduct: (homeId: number, productId: number, fields: Partial<Product>) => Promise<void>;
};

export function useVoiceAssistant({
  homes,
  catalog,
  onAddProduct,
  onDeleteProduct,
  onUpdateProduct,
}: UseVoiceAssistantProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const recorderRef = useRef<ReturnType<typeof createAudioRecorder> | null>(null);
  const conversationRef = useRef<ConversationMessage[]>([]);

  const isSupported = isMediaRecorderSupported();
  const hasTTS = isSpeechSynthesisSupported();

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser.');
      return;
    }

    try {
      setError(null);
      setLastResponse(null);

      const recorder = createAudioRecorder();
      recorderRef.current = recorder;

      await recorder.start();
      setState('recording');
    } catch (err) {
      console.error('Failed to start recording:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access.');
      } else {
        setError('Failed to access microphone.');
      }
      setState('idle');
    }
  }, [isSupported]);

  /**
   * Stop recording and process the audio
   */
  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) return;

    try {
      setState('processing');

      const { blob, mimeType } = await recorderRef.current.stop();
      recorderRef.current = null;

      // Don't send empty recordings
      if (blob.size < 1000) {
        setState('idle');
        setError('Recording was too short. Please try again.');
        return;
      }

      // Build context for the API
      const homeContext: HomeContext[] = homes.map((h) => ({
        id: h.id,
        name: h.name,
        products: h.products.map((p) => ({
          id: p.id,
          product: p.product,
          quantity: p.quantity,
          stockType: p.stockType,
          availability: p.availability,
        })),
      }));

      const catalogCategories = catalog.map((c) => ({ name: c.name }));

      // Send to API
      const response: VoiceCommandResponse = await sendVoiceCommand(
        blob,
        mimeType,
        homeContext,
        conversationRef.current,
        catalogCategories
      );

      // Store the AI response in conversation history
      if (response.spokenResponse) {
        conversationRef.current.push({
          role: 'assistant',
          text: response.spokenResponse,
        });

        // Keep only last 6 messages for context
        if (conversationRef.current.length > 6) {
          conversationRef.current = conversationRef.current.slice(-6);
        }
      }

      setLastResponse(response.spokenResponse);

      // Execute actions if any
      if (!response.needsMoreInfo && response.actions && response.actions.length > 0) {
        await executeActions(response.actions);
      }

      // Speak the response
      if (hasTTS && response.spokenResponse) {
        setState('speaking');
        try {
          await speakText(response.spokenResponse);
        } catch (speechErr) {
          console.warn('TTS failed:', speechErr);
        }
      }

      setState('idle');
    } catch (err) {
      console.error('Error processing voice command:', err);
      setError('Failed to process your command. Please try again.');
      setState('idle');

      // Try to speak the error
      if (hasTTS) {
        try {
          await speakText('Sorry, something went wrong. Please try again.');
        } catch {
          // Ignore TTS errors
        }
      }
    }
  }, [homes, catalog, hasTTS]);

  /**
   * Execute the actions returned by the AI
   */
  const executeActions = async (actions: VoiceAction[]) => {
    for (const action of actions) {
      try {
        // Find the target home
        let targetHomeId: number | null = action.targetHomeId;

        if (!targetHomeId && action.targetHome) {
          const matchedHome = homes.find(
            (h) => h.name.toLowerCase() === action.targetHome!.toLowerCase()
          );
          if (matchedHome) {
            targetHomeId = matchedHome.id;
          }
        }

        // If still no home and only one exists, use it
        if (!targetHomeId && homes.length === 1) {
          targetHomeId = homes[0].id;
        }

        if (!targetHomeId) {
          console.warn('Could not determine target home for action:', action);
          continue;
        }

        switch (action.type) {
          case 'add': {
            await onAddProduct(targetHomeId, {
              product: action.product || '',
              quantity: action.quantity || '1',
              stockType: action.stockType || 'Others',
              expiryDate: '',
              availability: 'Yes',
            });
            break;
          }

          case 'delete': {
            const home = homes.find((h) => h.id === targetHomeId);
            if (home) {
              const productToDelete = home.products.find(
                (p) =>
                  p.product.toLowerCase() === (action.product || '').toLowerCase() ||
                  p.product.toLowerCase().includes((action.product || '').toLowerCase()) ||
                  (action.product || '').toLowerCase().includes(p.product.toLowerCase())
              );
              if (productToDelete) {
                await onDeleteProduct(targetHomeId, productToDelete.id);
              }
            }
            break;
          }

          case 'update_availability': {
            const home = homes.find((h) => h.id === targetHomeId);
            if (home) {
              const productToUpdate = home.products.find(
                (p) =>
                  p.product.toLowerCase() === (action.product || '').toLowerCase() ||
                  p.product.toLowerCase().includes((action.product || '').toLowerCase()) ||
                  (action.product || '').toLowerCase().includes(p.product.toLowerCase())
              );
              if (productToUpdate) {
                await onUpdateProduct(targetHomeId, productToUpdate.id, {
                  availability: action.availability || 'No',
                });
              }
            }
            break;
          }
        }
      } catch (actionErr) {
        console.error('Error executing action:', action, actionErr);
      }
    }
  };

  /**
   * Toggle recording - start if idle, stop if recording
   */
  const toggleRecording = useCallback(() => {
    if (state === 'recording') {
      stopRecording();
    } else if (state === 'idle') {
      startRecording();
    } else if (state === 'speaking') {
      // Stop speaking and go back to idle
      stopSpeaking();
      setState('idle');
    }
    // If processing, do nothing
  }, [state, startRecording, stopRecording]);

  /**
   * Cancel everything and reset
   */
  const cancel = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    stopSpeaking();
    setState('idle');
    setError(null);
  }, []);

  /**
   * Clear conversation history (for new session)
   */
  const clearConversation = useCallback(() => {
    conversationRef.current = [];
    setLastResponse(null);
  }, []);

  return {
    state,
    error,
    lastResponse,
    isSupported,
    toggleRecording,
    cancel,
    clearConversation,
  };
}
