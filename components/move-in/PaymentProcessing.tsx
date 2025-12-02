'use client';

import React, { useState } from 'react';

interface PaymentDetails {
  paymentMethod: 'card' | 'bank' | 'crypto';
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
  bankAccountNumber?: string;
  routingNumber?: string;
  accountHolderName?: string;
  savePaymentMethod: boolean;
  setupAutoPay: boolean;
}

interface PaymentProcessingProps {
  tenantInfo: any;
  unit: any;
  leaseConfig: any;
  pricing: any;
  onPaymentComplete: (paymentDetails: PaymentDetails) => void;
  onBack: () => void;
}

export default function PaymentProcessing({ 
  tenantInfo, 
  unit, 
  leaseConfig, 
  pricing, 
  onPaymentComplete, 
  onBack 
}: PaymentProcessingProps) {
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    paymentMethod: 'card',
    savePaymentMethod: true,
    setupAutoPay: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof PaymentDetails, value: any) => {
    setPaymentDetails((prev: PaymentDetails) => ({ ...prev, [field]: value }));
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 4) return digits;
    if (digits.length <= 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    if (digits.length <= 12) return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`;
  };

  const validatePayment = () => {
    const newErrors: Record<string, string> = {};
    
    if (paymentDetails.paymentMethod === 'card') {
      if (!paymentDetails.cardNumber || paymentDetails.cardNumber.replace(/\D/g, '').length < 16) {
        newErrors.cardNumber = 'Valid card number is required';
      }
      if (!paymentDetails.expiryDate) {
        newErrors.expiryDate = 'Expiry date is required';
      }
      if (!paymentDetails.cvv || paymentDetails.cvv.length < 3) {
        newErrors.cvv = 'Valid CVV is required';
      }
    }
    
    if (paymentDetails.paymentMethod === 'bank') {
      if (!paymentDetails.bankAccountNumber || paymentDetails.bankAccountNumber.length < 8) {
        newErrors.bankAccountNumber = 'Valid account number is required';
      }
      if (!paymentDetails.routingNumber || paymentDetails.routingNumber.length < 9) {
        newErrors.routingNumber = 'Valid routing number is required';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePayment()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Generate access credentials
      const accessCredentials = {
        gateCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        mobileAppCredentials: {
          username: `${tenantInfo.firstName.toLowerCase()}${tenantInfo.lastName.toLowerCase()}`,
          temporaryPassword: Math.random().toString(36).substring(2, 10)
        },
        qrCode: `SUMMIT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
      };
      
      onPaymentComplete(paymentDetails);
      
      // Show success message
      alert('Payment successful! Welcome to SummitOS. Your access credentials have been generated.');
      
    } catch (error) {
      console.error('Payment processing error:', error);
      setErrors({ submit: 'Payment failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment & Activation</h2>
          <p className="text-gray-600">Complete your payment to activate your unit access immediately.</p>
        </div>

        {/* Order Summary */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Order Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-700">Tenant:</span>
              <span className="font-medium">{tenantInfo.firstName} {tenantInfo.lastName}</span>
            </div>
          <div className="flex justify-between">
            <span>Unit:</span>
            <span data-testid="unit-number">{unit?.unitNumber}</span>
          </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Size:</span>
              <span className="font-medium">{unit.size} sq ft</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between text-lg font-bold text-blue-900">
                <span>Total Due:</span>
                <span data-testid="total-due">{formatCurrency(pricing.totalDue)}</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Method Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
            <div className="grid grid-cols-3 gap-4">
              <label className={`cursor-pointer p-4 border-2 rounded-lg text-center ${
                paymentDetails.paymentMethod === 'card' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={paymentDetails.paymentMethod === 'card'}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  className="sr-only"
                />
                <div className="text-lg">💳</div>
                <div className="text-sm font-medium">Credit Card</div>
              </label>

              <label className={`cursor-pointer p-4 border-2 rounded-lg text-center ${
                paymentDetails.paymentMethod === 'bank' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank"
                  checked={paymentDetails.paymentMethod === 'bank'}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  className="sr-only"
                />
                <div className="text-lg">🏦</div>
                <div className="text-sm font-medium">Bank Account</div>
              </label>

              <label className={`cursor-pointer p-4 border-2 rounded-lg text-center ${
                paymentDetails.paymentMethod === 'crypto' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="crypto"
                  checked={paymentDetails.paymentMethod === 'crypto'}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  className="sr-only"
                />
                <div className="text-lg">₿</div>
                <div className="text-sm font-medium">Cryptocurrency</div>
              </label>
            </div>
          </div>

          {/* Card Payment Fields */}
          {paymentDetails.paymentMethod === 'card' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Card Number *
                </label>
                <input
                  type="text"
                  id="cardNumber"
                  value={paymentDetails.cardNumber}
                  onChange={(e) => handleInputChange('cardNumber', formatCardNumber(e.target.value))}
                  className={`w-full px-4 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.cardNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                />
                {errors.cardNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.cardNumber}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date *
                  </label>
                  <input
                    type="text"
                    id="expiryDate"
                    value={paymentDetails.expiryDate}
                    onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.expiryDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="MM/YY"
                    maxLength={5}
                  />
                  {errors.expiryDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.expiryDate}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-2">
                    CVV *
                  </label>
                  <input
                    type="text"
                    id="cvv"
                    value={paymentDetails.cvv}
                    onChange={(e) => handleInputChange('cvv', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.cvv ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="123"
                    maxLength={4}
                  />
                  {errors.cvv && (
                    <p className="mt-1 text-sm text-red-600">{errors.cvv}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bank Payment Fields */}
          {paymentDetails.paymentMethod === 'bank' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-700 mb-2">
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  id="accountHolderName"
                  value={paymentDetails.accountHolderName}
                  onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Account Number *
                </label>
                <input
                  type="text"
                  id="bankAccountNumber"
                  value={paymentDetails.bankAccountNumber}
                  onChange={(e) => handleInputChange('bankAccountNumber', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.bankAccountNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="123456789"
                  maxLength={17}
                />
                {errors.bankAccountNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.bankAccountNumber}</p>
                )}
              </div>

              <div>
                <label htmlFor="routingNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Routing Number *
                </label>
                <input
                  type="text"
                  id="routingNumber"
                  value={paymentDetails.routingNumber}
                  onChange={(e) => handleInputChange('routingNumber', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.routingNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="123456789"
                  maxLength={9}
                />
                {errors.routingNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.routingNumber}</p>
                )}
              </div>
            </div>
          )}

          {/* Payment Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Options</h3>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="savePaymentMethod"
                  checked={paymentDetails.savePaymentMethod}
                  onChange={(e) => handleInputChange('savePaymentMethod', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="savePaymentMethod" className="ml-2 block text-sm text-gray-700">
                  Save payment method for future use
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="setupAutoPay"
                  checked={paymentDetails.setupAutoPay}
                  onChange={(e) => handleInputChange('setupAutoPay', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="setupAutoPay" className="ml-2 block text-sm text-gray-700">
                  Setup automatic monthly payments
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Back
            </button>
            
            <button
              type="submit"
              disabled={isLoading}
              className={`flex-1 px-6 py-3 rounded-lg font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Processing Payment...' : `Complete Move-In - ${formatCurrency(pricing.totalDue)}`}
            </button>
          </div>

          {errors.submit && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">{errors.submit}</p>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 015 5v2a5 5 0 015-5h10a5 5 0 015-5v-2a5 5 0 01-5 5H5a5 5 0 01-5 5v2a5 5 0 015 5zm3.293 7.707a1 1 0 00-1.414 1.414l1.414 1.414a1 1 0 001.414-1.414l-1.414-1.414a1 1 0 01-1.414 1.414l1.414 1.414a1 1 0 001.414 1.414l-1.414-1.414a1 1 0 01-1.414 1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-700">
                  <strong>Secure Payment:</strong> Your payment information is encrypted and secure. We never store your card details on our servers.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}