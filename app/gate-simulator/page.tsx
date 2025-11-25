'use client';

import React, { useState } from 'react';

export default function GateSimulatorPage() {
  const [gateAccessCode, setGateAccessCode] = useState('');
  const [accessResult, setAccessResult] = useState<{ access: string; reason?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccessCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGateAccessCode(e.target.value);
  };

  const handleOpenGate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAccessResult(null);
    setError(null);

    try {
      const response = await fetch('/api/gate/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gate_access_code: gateAccessCode }),
      });

      const data = await response.json();
      setAccessResult(data);

      if (!response.ok) {
        throw new Error(data.error || 'Gate access request failed.');
      }
    } catch (err: any) {
      console.error('Error opening gate:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <main className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Gate Access Simulator</h1>

        <form onSubmit={handleOpenGate} className="space-y-4">
          <div>
            <label htmlFor="gate_code" className="block text-sm font-medium text-gray-700">Gate Access Code</label>
            <input
              type="text"
              name="gate_code"
              id="gate_code"
              value={gateAccessCode}
              onChange={handleAccessCodeChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-lg"
              placeholder="Enter gate code"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full inline-flex justify-center py-3 px-4 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Open Gate'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {accessResult && (
          <div className={`mt-6 p-4 rounded-md ${accessResult.access === 'granted' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
            <p className="font-semibold text-lg">Access: {accessResult.access.toUpperCase()}</p>
            {accessResult.reason && <p className="text-sm">Reason: {accessResult.reason}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
