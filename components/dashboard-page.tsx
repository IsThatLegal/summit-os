'use client';

import { Key, Car, XCircle, Moon, Sun } from 'lucide-react';
import { getSupabase } from '@/lib/supabaseClient';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EnforcerModal } from '@/components/enforcer-modal';
import { useTheme } from '@/components/theme-provider';
import { useRouter } from 'next/navigation';

// Define types for better readability and type safety
interface Unit {
  id: string;
  unit_number: string;
  size: string;
  monthly_price: number;
  status: 'available' | 'occupied' | 'maintenance';
  door_type: 'roll-up' | 'swing';
}

interface Tenant {
  id: string;
  first_name: string;
  email: string;
  phone: string;
  current_balance: number;
  gate_access_code: string;
  is_locked_out: boolean;
}

interface GateLog {
  id: string;
  tenant_id: string;
  action: 'entry' | 'exit' | 'denied_payment' | 'entry_granted' | 'entry_denied';
  timestamp: string;
  tenants?: { first_name: string };
}

// Helper to make authenticated API requests
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return fetch(url, { ...options, headers });
}

export default function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [gateLogs, setGateLogs] = useState<GateLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
      } else {
        setIsAuthenticated(true);
      }
    };
    checkAuth();
  }, [router]);

  const [newTenant, setNewTenant] = useState({
    first_name: '',
    email: '',
    phone: '',
    gate_access_code: '',
    current_balance: '',
    is_locked_out: false,
    unit_id: '',
  });

  const [newUnit, setNewUnit] = useState({
    unit_number: '',
    size: '10x10',
    monthly_price: '100',
    status: 'available' as 'available' | 'occupied' | 'maintenance',
    door_type: 'roll-up' as 'roll-up' | 'swing',
  });
  
  const [newPayment, setNewPayment] = useState({
    tenant_id: '',
    amount: '',
    description: '',
  });

  const [enforcingTenant, setEnforcingTenant] = useState<{id: string, name: string, phone: string} | null>(null);

  const fetchTenants = useCallback(async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('tenants').select('*').order('first_name', { ascending: true });
    if (error) throw error;
    setTenants(data || []);
  }, []);
  
  const fetchUnits = useCallback(async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('units').select('*').order('unit_number', { ascending: true });
    if (error) throw error;
    setUnits(data || []);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      await Promise.all([fetchTenants(), fetchUnits()]);
      const { data: gateLogsData, error: gateLogsError } = await supabase.from('gate_logs').select(`*, tenants (first_name)`).order('timestamp', { ascending: false }).limit(3);
      if (gateLogsError) throw gateLogsError;
      setGateLogs(gateLogsData || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  }, [fetchTenants, fetchUnits]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const occupancy = units.length > 0 ? units.filter(u => u.status === 'occupied').length / units.length : 0;
  const occupancyPercentage = (occupancy * 100).toFixed(0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'maintenance': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getLogIcon = (action: string) => {
    const actions: { [key: string]: React.ReactNode } = {
      'entry': <Car className="text-green-500" />,
      'entry_granted': <Car className="text-green-500" />,
      'exit': <Car className="text-yellow-500" />,
      'denied_payment': <XCircle className="text-red-500" />,
      'entry_denied': <XCircle className="text-red-500" />,
    };
    return actions[action] || <Key />;
  };
  
  const handleChange = <T extends Record<string, unknown>>(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    setter: React.Dispatch<React.SetStateAction<T>>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setter((prev: T) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAddTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        ...newTenant,
        unit_id: newTenant.unit_id || null,
        current_balance: Math.round(parseFloat(newTenant.current_balance || '0') * 100),
      };
      const response = await authFetch('/api/tenants', { method: 'POST', body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add tenant');
      await Promise.all([fetchTenants(), fetchUnits()]);
      setNewTenant({ first_name: '', email: '', phone: '', gate_access_code: '', current_balance: '', is_locked_out: false, unit_id: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add tenant');
    }
  };

  const handleAddUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = { ...newUnit, monthly_price: Math.round(parseFloat(newUnit.monthly_price || '0') * 100) };
      const response = await authFetch('/api/units', { method: 'POST', body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add unit');
      await fetchUnits();
      setNewUnit({ unit_number: '', size: '10x10', monthly_price: '100', status: 'available', door_type: 'roll-up' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add unit');
    }
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.tenant_id) return setError("Please select a tenant.");
    setError(null);
    try {
      const payload = { ...newPayment, amount_in_cents: Math.round(parseFloat(newPayment.amount || '0') * 100) };
      const response = await authFetch('/api/finance/charge', { method: 'POST', body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process payment');
      await fetchTenants();
      setNewPayment({ tenant_id: '', amount: '', description: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (!window.confirm("Are you sure you want to delete this tenant? This will also remove their gate logs and transactions.")) return;
    setError(null);
    try {
      const response = await authFetch(`/api/tenants/${tenantId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete tenant');
      await Promise.all([fetchTenants(), fetchUnits()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete tenant');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading dashboard data...</div>;

  // Don't render until auth check is complete
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <main className="p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
        {error && <div className={`border px-4 py-3 rounded relative mb-4 ${theme === 'dark' ? 'bg-red-900 border-red-700 text-red-200' : 'bg-red-100 border-red-400 text-red-700'}`} role="alert"><strong className="font-bold">Error: </strong><span className="block sm:inline">{error}</span><span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}><svg className={`fill-current h-6 w-6 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`} role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg></span></div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}><h2 className="text-xl font-semibold mb-2">Occupancy Rate</h2><p className="text-5xl font-bold text-blue-600">{isNaN(Number(occupancyPercentage)) ? '0' : occupancyPercentage}%</p><p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Full</p></div>
          <div className={`lg:col-span-2 p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}><h2 className="text-xl font-semibold mb-4">Recent Gate Activity</h2><ul className="space-y-4">{gateLogs.map(log => <li key={log.id} className="flex items-center justify-between"><div className="flex items-center gap-4">{getLogIcon(log.action)}<div><p className="font-semibold">{log.tenants?.first_name || 'Unknown'}</p><p className={`text-sm capitalize ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{log.action.replace(/_/g, ' ')}</p></div></div><p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{new Date(log.timestamp).toLocaleTimeString()}</p></li>)}</ul></div>
        </div>

        <div className={`p-6 rounded-lg shadow-md mb-8 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Financial Management</h2>
          <form onSubmit={handleAddPaymentSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label htmlFor="tenant_id" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Tenant</label><select name="tenant_id" id="tenant_id" value={newPayment.tenant_id} onChange={e => handleChange(e, setNewPayment)} className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300'}`} required><option value="">Select a Tenant</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.first_name}</option>)}</select></div>
            <div><label htmlFor="amount" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Amount (in dollars)</label><input type="number" step="0.01" name="amount" id="amount" value={newPayment.amount} onChange={e => handleChange(e, setNewPayment)} className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300'}`} required placeholder="50.00" /></div>
            <div><label htmlFor="description" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Description</label><input type="text" name="description" id="description" value={newPayment.description} onChange={e => handleChange(e, setNewPayment)} className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300'}`} required placeholder="e.g., November Rent"/></div>
            <div className="md:col-span-3"><button type="submit" className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700">Log Payment (Test)</button></div>
          </form>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Unit Management</h2>
              <div className="flex gap-2">
                <a 
                  href="/unit-map" 
                  className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    theme === 'dark' 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  Map Creator
                </a>
                <button
                  onClick={() => {
                    // This would trigger a SiteLink sync
                    alert('SiteLink sync feature coming soon! Configure your SiteLink API credentials in .env.local');
                  }}
                  className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    theme === 'dark' 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  Sync SiteLink
                </button>
              </div>
            </div>
            <form onSubmit={handleAddUnitSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div><label htmlFor="unit_number" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Unit Number</label><input type="text" name="unit_number" value={newUnit.unit_number} onChange={e => handleChange(e, setNewUnit)} className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300'}`} required /></div>
              <div><label htmlFor="size" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Size</label><input type="text" name="size" value={newUnit.size} onChange={e => handleChange(e, setNewUnit)} className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300'}`} required /></div>
              <div><label htmlFor="monthly_price" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Price (in dollars)</label><input type="number" step="0.01" name="monthly_price" value={newUnit.monthly_price} onChange={e => handleChange(e, setNewUnit)} className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300'}`} required /></div>
              <div><label htmlFor="status" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Status</label><select name="status" value={newUnit.status} onChange={e => handleChange(e, setNewUnit)} className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300'}`}><option value="available">Available</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option></select></div>
              <div><label htmlFor="door_type" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Door Type</label><select name="door_type" value={newUnit.door_type} onChange={e => handleChange(e, setNewUnit)} className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300'}`}><option value="roll-up">Roll-Up</option><option value="swing">Swing</option></select></div>
              <div className="md:col-span-2"><button type="submit" className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">Add Unit</button></div>
            </form>
            <h3 className="text-lg font-semibold mb-2 mt-6">Unit Status</h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {units.map(unit => (
                <div key={unit.id} className={`p-2 text-center rounded-lg text-white text-sm ${getStatusColor(unit.status)}`}>
                  <div className="font-bold">{unit.unit_number}</div>
                  <div className="text-xs">{unit.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <EnforcerModal
          isOpen={!!enforcingTenant}
          onClose={() => setEnforcingTenant(null)}
          tenantId={enforcingTenant?.id || null}
          tenantName={enforcingTenant?.name || null}
          tenantPhone={enforcingTenant?.phone || null}
        />
      </main>
    </div>
  );
}