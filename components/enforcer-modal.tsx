'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, MessageSquareText, XCircle } from 'lucide-react';

interface EnforcerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string | null;
  tenantName: string | null;
}

export const EnforcerModal: React.FC<EnforcerModalProps> = ({ isOpen, onClose, tenantId, tenantName }) => {
  const [loading, setLoading] = useState(true);
  const [draftMessage, setDraftMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Effect to fetch the draft message when the modal opens
  useEffect(() => {
    if (!isOpen || !tenantId) {
      return;
    }

    const fetchDraftMessage = async () => {
      setLoading(true);
      setError(null);
      setDraftMessage(''); // Clear previous message

      try {
        const response = await fetch('/api/ai/enforcer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tenantId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.details || data.error || 'Failed to get draft message from AI.');
        }

        setDraftMessage(data.draftMessage);
      } catch (err: any) {
        console.error('Error fetching AI draft:', err);
        setError(err.message || 'An unexpected error occurred while drafting message.');
      } finally {
        setLoading(false);
      }
    };

    fetchDraftMessage();
  }, [isOpen, tenantId]); // Re-run when modal opens or tenantId changes

  if (!isOpen) {
    return null;
  }

  const handleSendSms = () => {
    alert(`Simulating SMS Sent to ${tenantName}:\n\n"${draftMessage}"`);
    onClose(); // Close modal after action
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <MessageSquareText className="mr-2 h-6 w-6 text-indigo-500" />
            Collections Assistant - {tenantName || 'Unknown Tenant'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 min-h-[150px]">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="mt-2 text-lg">Thinking...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full text-red-600">
              <XCircle className="h-8 w-8" />
              <p className="mt-2 text-lg">Error: {error}</p>
              <p className="text-sm text-gray-500">Please try again or contact support.</p>
            </div>
          )}

          {!loading && !error && (
            <div>
              <label htmlFor="draftMessage" className="block text-sm font-medium text-gray-700">AI Drafted Message:</label>
              <textarea
                id="draftMessage"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-gray-800 min-h-[100px]"
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end space-x-3 border-t pt-3">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSendSms}
            disabled={loading || !!error || !draftMessage}
            className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send SMS
          </button>
        </div>
      </div>
    </div>
  );
};
