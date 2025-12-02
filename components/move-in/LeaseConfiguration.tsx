'use client';

import React, { useState } from 'react';

interface LeaseConfiguration {
  leaseTerm: number;
  startDate: string;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  autoRenewal: boolean;
  insuranceRequired: boolean;
  insuranceOptions: {
    provider: string;
    coverage: number;
    monthlyCost: number;
    deductible: number;
  }[];
  services: {
    tenantProtection: boolean;
    lateFeeProtection: boolean;
    climateControl: boolean;
    pestControl: boolean;
    mailService: boolean;
  };
  discounts: {
    military: boolean;
    student: boolean;
    senior: boolean;
    corporate: boolean;
    prepayment: boolean;
    referral: boolean;
  };
}

interface PricingBreakdown {
  baseRate: number;
  monthlyTotal: number;
  proratedFirstMonth: number;
  securityDeposit: number;
  applicationFee: number;
  totalDue: number;
  savings: number;
}

interface LeaseConfigProps {
  unit: any;
  tenantInfo: any;
  onLeaseConfigure: (config: LeaseConfiguration) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function LeaseConfiguration({ unit, tenantInfo, onLeaseConfigure, onNext, onBack }: LeaseConfigProps) {
  const [config, setConfig] = useState<LeaseConfiguration>({
    leaseTerm: 12,
    startDate: new Date().toISOString().split('T')[0],
    billingCycle: 'monthly',
    autoRenewal: true,
    insuranceRequired: true,
    insuranceOptions: [],
    services: {
      tenantProtection: false,
      lateFeeProtection: false,
      climateControl: true,
      pestControl: false,
      mailService: false
    },
    discounts: {
      military: false,
      student: false,
      senior: false,
      corporate: false,
      prepayment: false,
      referral: false
    }
  });

  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate pricing when config changes
  React.useEffect(() => {
    const baseRate = unit?.basePrice || 0;
    let monthlyTotal = baseRate;

    // Apply lease term discounts
    if (config.leaseTerm >= 12) {
      monthlyTotal *= 0.95; // 5% discount for 12+ months
    }
    if (config.leaseTerm >= 24) {
      monthlyTotal *= 0.90; // 10% discount for 24+ months
    }

    // Apply discounts
    let discountAmount = 0;
    if (config.discounts.military) discountAmount += 0.10;
    if (config.discounts.student) discountAmount += 0.05;
    if (config.discounts.senior) discountAmount += 0.05;
    if (config.discounts.corporate) discountAmount += 0.08;
    if (config.discounts.prepayment) discountAmount += 0.10;
    if (config.discounts.referral) discountAmount += 0.05;

    monthlyTotal *= (1 - discountAmount);

    // Add services
    if (config.services.climateControl) monthlyTotal += 15;
    if (config.services.pestControl) monthlyTotal += 10;
    if (config.services.mailService) monthlyTotal += 5;
    if (config.services.tenantProtection) monthlyTotal += 8;
    if (config.services.lateFeeProtection) monthlyTotal += 3;

    // Calculate prorated first month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - today.getDate() + 1;
    const proratedAmount = (monthlyTotal / daysInMonth) * daysRemaining;

    const securityDeposit = baseRate * 0.5; // 50% of one month's rent
    const applicationFee = 25; // Fixed fee

    setPricing({
      baseRate,
      monthlyTotal,
      proratedFirstMonth: proratedAmount,
      securityDeposit,
      applicationFee,
      totalDue: proratedAmount + securityDeposit + applicationFee,
      savings: baseRate - monthlyTotal
    });
  }, [config, unit]);

  const handleConfigChange = (field: keyof LeaseConfiguration, value: any) => {
    setConfig((prev: LeaseConfiguration) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pricing) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      onLeaseConfigure(config);
      onNext();
    } catch (error) {
      console.error('Error configuring lease:', error);
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

  if (!pricing) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-r-2 border-b-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Calculating pricing options...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Your Lease</h2>
          <p className="text-gray-600">Customize your lease terms and services. This should take about 45 seconds.</p>
        </div>

        {/* Pricing Summary */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Monthly Breakdown</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-700">Base Rate:</span>
              <span className="font-medium">{formatCurrency(pricing.baseRate)}</span>
            </div>
            {pricing.savings > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discounts:</span>
                <span className="font-medium">-{formatCurrency(pricing.savings)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-blue-900 border-t pt-2">
              <span>Monthly Total:</span>
              <span>{formatCurrency(pricing.monthlyTotal)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Lease Terms */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lease Terms</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="leaseTerm" className="block text-sm font-medium text-gray-700 mb-2">
                  Lease Term (months)
                </label>
                <select
                  id="leaseTerm"
                  value={config.leaseTerm}
                  onChange={(e) => handleConfigChange('leaseTerm', parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={6}>6 months</option>
                  <option value={12}>12 months</option>
                  <option value={24}>24 months</option>
                  <option value={36}>36 months</option>
                </select>
              </div>

              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={config.startDate}
                  onChange={(e) => handleConfigChange('startDate', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="billingCycle" className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Cycle
                </label>
                <select
                  id="billingCycle"
                  value={config.billingCycle}
                  onChange={(e) => handleConfigChange('billingCycle', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoRenewal"
                  checked={config.autoRenewal}
                  onChange={(e) => handleConfigChange('autoRenewal', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="autoRenewal" className="ml-2 block text-sm text-gray-700">
                  Auto-renewal
                </label>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Services</h3>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="climateControl"
                  checked={config.services.climateControl}
                  onChange={(e) => handleConfigChange('services', { ...config.services, climateControl: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="climateControl" className="ml-2 block text-sm text-gray-700">
                  Climate Control (+$15/month)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pestControl"
                  checked={config.services.pestControl}
                  onChange={(e) => handleConfigChange('services', { ...config.services, pestControl: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="pestControl" className="ml-2 block text-sm text-gray-700">
                  Pest Control (+$10/month)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mailService"
                  checked={config.services.mailService}
                  onChange={(e) => handleConfigChange('services', { ...config.services, mailService: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="mailService" className="ml-2 block text-sm text-gray-700">
                  Mail Service (+$5/month)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="tenantProtection"
                  checked={config.services.tenantProtection}
                  onChange={(e) => handleConfigChange('services', { ...config.services, tenantProtection: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="tenantProtection" className="ml-2 block text-sm text-gray-700">
                  Tenant Protection (+$8/month)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="lateFeeProtection"
                  checked={config.services.lateFeeProtection}
                  onChange={(e) => handleConfigChange('services', { ...config.services, lateFeeProtection: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="lateFeeProtection" className="ml-2 block text-sm text-gray-700">
                  Late Fee Protection (+$3/month)
                </label>
              </div>
            </div>
          </div>

          {/* Discounts */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Discounts</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="military"
                  checked={config.discounts.military}
                  onChange={(e) => handleConfigChange('discounts', { ...config.discounts, military: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="military" className="ml-2 block text-sm text-gray-700">
                  Military (10% off)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="student"
                  checked={config.discounts.student}
                  onChange={(e) => handleConfigChange('discounts', { ...config.discounts, student: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="student" className="ml-2 block text-sm text-gray-700">
                  Student (5% off)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="senior"
                  checked={config.discounts.senior}
                  onChange={(e) => handleConfigChange('discounts', { ...config.discounts, senior: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="senior" className="ml-2 block text-sm text-gray-700">
                  Senior (5% off)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="corporate"
                  checked={config.discounts.corporate}
                  onChange={(e) => handleConfigChange('discounts', { ...config.discounts, corporate: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="corporate" className="ml-2 block text-sm text-gray-700">
                  Corporate (8% off)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="prepayment"
                  checked={config.discounts.prepayment}
                  onChange={(e) => handleConfigChange('discounts', { ...config.discounts, prepayment: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="prepayment" className="ml-2 block text-sm text-gray-700">
                  Prepayment (10% off)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="referral"
                  checked={config.discounts.referral}
                  onChange={(e) => handleConfigChange('discounts', { ...config.discounts, referral: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="referral" className="ml-2 block text-sm text-gray-700">
                  Referral (5% off)
                </label>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Prorated First Month:</span>
                <span className="font-medium">{formatCurrency(pricing.proratedFirstMonth)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Security Deposit:</span>
                <span className="font-medium">{formatCurrency(pricing.securityDeposit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Application Fee:</span>
                <span className="font-medium">{formatCurrency(pricing.applicationFee)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-2">
                <span>Total Due Today:</span>
                <span className="text-blue-600">{formatCurrency(pricing.totalDue)}</span>
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">Step 3 of 4</span>
              <span className="text-sm font-medium text-green-600">✓ Ready to continue</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: '75%' }}
              />
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
              {isLoading ? 'Processing...' : 'Continue to Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}