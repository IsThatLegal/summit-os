'use client';

import { Key, Car, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import React, { useState, useEffect } from 'react';

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
  action: 'entry' | 'exit' | 'denied_payment';
  timestamp: string;
  tenants?: { first_name: string };
}

export default function DashboardPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [gateLogs, setGateLogs] = useState<GateLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for adding a new tenant
  const [newTenant, setNewTenant] = useState({
    first_name: '',
    email: '',
    phone: '',
    gate_access_code: '',
    current_balance: 0,
    is_locked_out: false,
  });

  // Form state for adding a new unit
  const [newUnit, setNewUnit] = useState({
    unit_number: '',
    size: '10x10',
    monthly_price: 100,
    status: 'available' as 'available' | 'occupied' | 'maintenance',
    door_type: 'roll-up' as 'roll-up' | 'swing',
  });


  // Fetch data on component mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const { data: unitsData, error: unitsError } = await supabase.from('units').select('*');
        if (unitsError) throw unitsError;
        setUnits(unitsData || []);

        const { data: tenantsData, error: tenantsError } = await supabase.from('tenants').select('*');
        if (tenantsError) throw tenantsError;
        setTenants(tenantsData || []);

        const { data: gateLogsData, error: gateLogsError } = await supabase.from('gate_logs').select(`
          *,
          tenants (first_name)
        `).order('timestamp', { ascending: false }).limit(3);
        if (gateLogsError) throw gateLogsError;
        setGateLogs(gateLogsData || []);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to fetch data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []); // Empty dependency array means this runs once on mount

  const occupancy = units.filter(u => u.status === 'occupied').length / units.length;
  const occupancyPercentage = (occupancy * 100).toFixed(0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'occupied':
        return 'bg-red-500';
      case 'maintenance':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'entry':
        return <Car className="text-green-500" />;
      case 'exit':
        return <Car className="text-yellow-500" />;
      case 'denied_payment':
        return <XCircle className="text-red-500" />;
      default:
        return <Key />;
    }
  };

  const handleNewTenantChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setNewTenant(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); // Temporarily set loading, can refine later for specific form loading
    setError(null);
    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTenant),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add tenant');
      }

      setTenants(prev => [...prev, data]);
      setNewTenant({
        first_name: '',
        email: '',
        phone: '',
        gate_access_code: '',
        current_balance: 0,
        is_locked_out: false,
      });
    } catch (err: any) {
      console.error('Error adding tenant:', err);
      setError(err.message || 'Failed to add tenant.');
    } finally {
      setLoading(false); // Reset loading
    }
  };

  const handleNewUnitChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setNewUnit(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) : value
    }));
  };

  const handleAddUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); // Temporarily set loading
    setError(null);
    try {
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUnit),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add unit');
      }

      setUnits(prev => [...prev, data]);
      setNewUnit({
        unit_number: '',
        size: '10x10',
        monthly_price: 100,
        status: 'available',
        door_type: 'roll-up',
      });
    } catch (err: any) {
      console.error('Error adding unit:', err);
      setError(err.message || 'Failed to add unit.');
    } finally {
      setLoading(false); // Reset loading
    }
  };


  if (loading) return <div className="p-8 text-center">Loading dashboard data...</div>;
  if (error) return <div className="text-red-500 p-8">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="p-8">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Occupancy Card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Occupancy Rate</h2>
            <p className="text-5xl font-bold text-blue-600">{isNaN(occupancyPercentage) ? 'N/A' : occupancyPercentage}%</p>
            <p className="text-gray-500">Full</p>
          </div>

          {/* Recent Gate Activity */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Recent Gate Activity</h2>
            <ul className="space-y-4">
              {gateLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getLogIcon(log.action)}
                    <div>
                      <p className="font-semibold">{log.tenants?.first_name || 'N/A'}</p>
                      <p className="text-sm text-gray-500 capitalize">{log.action.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Tenant Management */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Tenant Management</h2>
          <form onSubmit={handleAddTenantSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name</label>
              <input type="text" name="first_name" id="first_name" value={newTenant.first_name} onChange={handleNewTenantChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" id="email" value={newTenant.email} onChange={handleNewTenantChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="text" name="phone" id="phone" value={newTenant.phone} onChange={handleNewTenantChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
            </div>
            <div>
              <label htmlFor="gate_access_code" className="block text-sm font-medium text-gray-700">Gate Access Code</label>
              <input type="text" name="gate_access_code" id="gate_access_code" value={newTenant.gate_access_code} onChange={handleNewTenantChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
            </div>
            <div>
              <label htmlFor="current_balance" className="block text-sm font-medium text-gray-700">Current Balance</label>
              <input type="number" name="current_balance" id="current_balance" value={newTenant.current_balance} onChange={handleNewTenantChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div className="flex items-center">
              <input type="checkbox" name="is_locked_out" id="is_locked_out" checked={newTenant.is_locked_out} onChange={handleNewTenantChange} className="h-4 w-4 text-red-600 border-gray-300 rounded" />
              <label htmlFor="is_locked_out" className="ml-2 block text-sm text-gray-900">Is Locked Out?</label>
            </div>
            <div className="lg:col-span-3">
              <button type="submit" className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Add Tenant
              </button>
            </div>
          </form>

          {/* List existing tenants */}
          <h3 className="text-lg font-semibold mb-2">Existing Tenants</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gate Code</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Locked Out</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tenant.first_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tenant.current_balance}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.gate_access_code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tenant.is_locked_out ? <XCircle className="h-5 w-5 text-red-500" /> : <Key className="h-5 w-5 text-green-500" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unit Management */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Unit Management</h2>
          <form onSubmit={handleAddUnitSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label htmlFor="unit_number" className="block text-sm font-medium text-gray-700">Unit Number</label>
              <input type="text" name="unit_number" id="unit_number" value={newUnit.unit_number} onChange={handleNewUnitChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
            </div>
            <div>
              <label htmlFor="size" className="block text-sm font-medium text-gray-700">Size</label>
              <input type="text" name="size" id="size" value={newUnit.size} onChange={handleNewUnitChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
            </div>
            <div>
              <label htmlFor="monthly_price" className="block text-sm font-medium text-gray-700">Monthly Price</label>
              <input type="number" name="monthly_price" id="monthly_price" value={newUnit.monthly_price} onChange={handleNewUnitChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
              <select name="status" id="status" value={newUnit.status} onChange={handleNewUnitChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label htmlFor="door_type" className="block text-sm font-medium text-gray-700">Door Type</label>
              <select name="door_type" id="door_type" value={newUnit.door_type} onChange={handleNewUnitChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required>
                <option value="roll-up">Roll-Up</option>
                <option value="swing">Swing</option>
              </select>
            </div>
            <div className="lg:col-span-3">
              <button type="submit" className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                Add Unit
              </button>
            </div>
          </form>
        </div>

        {/* Unit Status Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Unit Status</h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-4">
            {units.map((unit) => (
              <div key={unit.id} className={`p-4 rounded-lg text-white flex flex-col items-center justify-center ${getStatusColor(unit.status)}`}>
                <span className="font-bold text-lg">{unit.unit_number}</span>
                <span className="text-xs capitalize">{unit.status}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}



