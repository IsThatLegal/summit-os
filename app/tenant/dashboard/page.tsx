'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CreditCard, DollarSign, Home, LogOut, User, Clock, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

interface Tenant {
  id: string;
  first_name: string;
  email: string;
  current_balance: number;
  is_locked_out: boolean;
  gate_access_code: string;
}

interface Transaction {
  id: string;
  type: 'payment' | 'charge';
  amount: number;
  description: string;
  created_at: string;
}

export default function TenantDashboard() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [showCheckForm, setShowCheckForm] = useState(false);
  const [showMoneyOrderForm, setShowMoneyOrderForm] = useState(false);
  const [showCashForm, setShowCashForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userInfo = localStorage.getItem('user_info');
    
    if (!token || !userInfo) {
      router.push('/auth/login');
      return;
    }

    const user = JSON.parse(userInfo);
    if (user.role !== 'TENANT') {
      router.push('/');
      return;
    }

    fetchTenantData(token, user.tenant_data?.id);
  }, [router]);

  const fetchTenantData = async (token: string, tenantId: string) => {
    try {
      const response = await fetch(`/api/tenants/${tenantId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch tenant data');
      }
      
      const tenantData = await response.json();
      setTenant(tenantData);

      const transactionsResponse = await fetch(`/api/tenants/${tenantId}/transactions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        setTransactions(transactionsData || []);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
      
      let endpoint = '/api/tenant/payments';
      let payload: any = {
        tenant_id: userInfo.tenant_data?.id,
        amount_in_cents: Math.round(parseFloat(amount) * 100),
        description: `Online payment from ${userInfo.tenant_data?.first_name}`
      };

      if (paymentMethod === 'check') {
        endpoint = '/api/payments/checks';
        payload = {
          ...payload,
          check_number: (document.getElementById('check_number') as HTMLInputElement)?.value,
          bank_name: (document.getElementById('bank_name') as HTMLInputElement)?.value,
          routing_number: (document.getElementById('routing_number') as HTMLInputElement)?.value,
          account_number: (document.getElementById('account_number') as HTMLInputElement)?.value
        };
      } else if (paymentMethod === 'money_order') {
        endpoint = '/api/payments/money-orders';
        payload = {
          ...payload,
          money_order_number: (document.getElementById('money_order_number') as HTMLInputElement)?.value,
          issuing_organization: (document.getElementById('issuing_organization') as HTMLInputElement)?.value
        };
      } else if (paymentMethod === 'cash') {
        endpoint = '/api/payments/cash';
        payload = {
          ...payload,
          verification_method: (document.getElementById('verification_method') as HTMLSelectElement)?.value,
          cash_drawer_id: (document.getElementById('cash_drawer_id') as HTMLInputElement)?.value,
          receipt_number: (document.getElementById('receipt_number') as HTMLInputElement)?.value,
          notes: (document.getElementById('cash_notes') as HTMLTextAreaElement)?.value
        };
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      setSuccess(true);
      
      setTimeout(() => {
        fetchTenantData(token!, userInfo.tenant_data?.id);
        setSuccess(false);
        setAmount('');
        setShowCheckForm(false);
        setShowMoneyOrderForm(false);
        setShowCashForm(false);
      }, 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    router.push('/auth/login');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const getStatusColor = (balance: number) => {
    return balance > 0 ? 'text-red-600' : 'text-green-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment information...</p>
        </div>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading payment information</p>
          <Link href="/tenant/dashboard" className="text-blue-600 hover:underline">
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <nav className={`shadow-sm border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/tenant/dashboard" className="flex items-center text-gray-700 hover:text-gray-900">
                <Home className="h-8 w-8" />
                <span className="ml-2 text-xl font-semibold">SummitOS</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Welcome, {tenant?.first_name}</span>
              <button
                onClick={handleLogout}
                className={`flex items-center text-gray-500 hover:text-gray-700 ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-md ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                title="Toggle dark mode"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className={`shadow-lg rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="px-6 py-8">
            <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Tenant Dashboard</h2>
            
            {tenant && (
              <>
                <div className={`rounded-lg p-4 mb-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Account Overview</h3>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Manage your account and payments</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-2xl font-bold ${getStatusColor(tenant.current_balance)}`}>
                        {formatCurrency(tenant.current_balance)}
                      </span>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        tenant.is_locked_out 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {tenant.is_locked_out ? 'Locked' : 'Active'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                    <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Quick Actions</h4>
                    <div className="space-y-3">
                      <Link
                        href="/tenant/payments"
                        className={`block w-full text-center px-4 py-2 rounded-md text-sm font-medium ${
                          theme === 'dark' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <CreditCard className="h-5 w-5 mr-2 inline" />
                        Make a Payment
                      </Link>
                      <Link
                        href="/tenant/transactions"
                        className={`block w-full text-center px-4 py-2 rounded-md text-sm font-medium ${
                          theme === 'dark' ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-600 text-white hover:bg-gray-700'
                        }`}
                      >
                        <DollarSign className="h-5 w-5 mr-2 inline" />
                        View Transactions
                      </Link>
                    </div>
                  </div>
                </div>

                <div className={`rounded-lg p-4 mb-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                  <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Account Information</h4>
                  <div className="space-y-3">
                    <div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Name</p>
                      <p className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{tenant.first_name}</p>
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Email</p>
                      <p className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{tenant.email}</p>
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Gate Access Code</p>
                      <p className={`text-lg font-mono ${theme === 'dark' ? 'text-white bg-gray-600 px-2 py-1 rounded' : 'text-gray-900 bg-gray-100 px-2 py-1 rounded'}`}>{tenant.gate_access_code}</p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                  <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Recent Transactions</h4>
                  <div className="space-y-3">
                    {transactions.length === 0 ? (
                      <p className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>No transactions found</p>
                    ) : (
                      <>
                        {transactions.slice(0, 5).map((transaction) => (
                          <div key={transaction.id} className={`border-b ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'} pb-3`}>
                            <div className="flex justify-between items-center">
                              <div>
                                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {new Date(transaction.created_at).toLocaleDateString()}
                                </p>
                                <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {transaction.description}
                                </p>
                              </div>
                              <div className={`text-right font-medium ${transaction.type === 'payment' ? 'text-green-600' : 'text-red-600'}`}>
                                {transaction.type === 'payment' ? '-' : '+'}{formatCurrency(transaction.amount)}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="text-center mt-4">
                          <Link
                            href="/tenant/transactions"
                            className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                              theme === 'dark' ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-600 text-white hover:bg-gray-700'
                            }`}
                          >
                            View All Transactions
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}