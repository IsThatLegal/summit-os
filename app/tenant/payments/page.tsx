'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CreditCard, ArrowLeft, CheckCircle, Wallet, FileText, Building2 } from 'lucide-react';

interface Tenant {
  id: string;
  first_name: string;
  email: string;
  current_balance: number;
  is_locked_out: boolean;
}

interface Transaction {
  id: string;
  type: 'payment' | 'charge';
  amount: number;
  description: string;
  created_at: string;
}

export default function TenantPayments() {
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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/tenant/dashboard" className="flex items-center text-gray-700 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg">
          <div className="px-6 py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Make a Payment</h2>
            
            {tenant && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Current Balance:</span>
                  <span className={`text-2xl font-bold ${getStatusColor(tenant.current_balance)}`}>
                    {formatCurrency(tenant.current_balance)}
                  </span>
                </div>
                {tenant.is_locked_out && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                    ⚠️ Your account is currently locked out due to outstanding balance
                  </div>
                )}
              </div>
            )}

            {success ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-gray-600">Your account has been updated. Redirecting...</p>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Payment Method</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('credit_card');
                        setShowCheckForm(false);
                        setShowMoneyOrderForm(false);
                        setShowCashForm(false);
                      }}
                      className={`px-4 py-2 border rounded-md text-sm font-medium ${
                        paymentMethod === 'credit_card'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      💳 Credit Card
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('check');
                        setShowCheckForm(true);
                        setShowMoneyOrderForm(false);
                        setShowCashForm(false);
                      }}
                      className={`px-4 py-2 border rounded-md text-sm font-medium ${
                        paymentMethod === 'check'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      📝 Check
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('money_order');
                        setShowCheckForm(false);
                        setShowMoneyOrderForm(true);
                        setShowCashForm(false);
                      }}
                      className={`px-4 py-2 border rounded-md text-sm font-medium ${
                        paymentMethod === 'money_order'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      🏦 Money Order
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('cash');
                        setShowCheckForm(false);
                        setShowMoneyOrderForm(false);
                        setShowCashForm(true);
                      }}
                      className={`px-4 py-2 border rounded-md text-sm font-medium ${
                        paymentMethod === 'cash'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      💵 Cash
                    </button>
                  </div>
                </div>

                {showCheckForm && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-medium text-blue-900 mb-3">Check Payment Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Check Number</label>
                        <input
                          type="text"
                          id="check_number"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          placeholder="1234"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Bank Name</label>
                        <input
                          type="text"
                          id="bank_name"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          placeholder="Bank of America"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Routing Number</label>
                        <input
                          type="text"
                          id="routing_number"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          placeholder="123456789"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Account Number</label>
                        <input
                          type="text"
                          id="account_number"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          placeholder="123456789"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {showMoneyOrderForm && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-medium text-green-900 mb-3">Money Order Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Money Order Number</label>
                        <input
                          type="text"
                          id="money_order_number"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          placeholder="MO123456"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Issuing Organization</label>
                        <input
                          type="text"
                          id="issuing_organization"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          placeholder="US Treasury"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {showCashForm && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-medium text-yellow-900 mb-3">Cash Payment Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Verification Method</label>
                        <select
                          id="verification_method"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          required
                        >
                          <option value="counterfeit_detector">Counterfeit Detector</option>
                          <option value="manual_count">Manual Count</option>
                          <option value="safe_drop_box">Safe Drop Box</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Cash Drawer ID</label>
                        <input
                          type="text"
                          id="cash_drawer_id"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          placeholder="CD-001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Receipt Number</label>
                        <input
                          type="text"
                          id="receipt_number"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          placeholder="R-1234"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Notes</label>
                        <textarea
                          id="cash_notes"
                          rows={3}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          placeholder="Additional notes..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Payment Information</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Payments are processed securely via Stripe</li>
                    <li>• Your account will be unlocked immediately after payment</li>
                    <li>• You will receive a payment confirmation via email</li>
                    <li>• All payments are final and non-refundable</li>
                  </ul>
                </div>

                <form onSubmit={handlePayment} className="space-y-6">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Amount (USD)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        id="amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        step="0.01"
                        min="1.00"
                        required
                        className="block w-full pl-8 pr-12 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-lg"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Enter amount you'd like to pay today
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quick Amounts</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {tenant && [
                        { label: 'Current Balance', amount: Math.abs(tenant.current_balance / 100) },
                        { label: '$25', amount: 25 },
                        { label: '$50', amount: 50 },
                        { label: '$100', amount: 100 }
                      ].map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => setAmount(option.amount.toString())}
                          className="px-4 py-2 border border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={processing || !amount}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay Now
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}