'use client';

import React, { useState } from 'react';
import TenantInfoForm from './TenantInfoForm';
import UnitSelection from './UnitSelection';
import LeaseConfiguration from './LeaseConfiguration';
import PaymentProcessing from './PaymentProcessing';

interface MoveInData {
  tenantInfo: any;
  selectedUnit: any;
  leaseConfig: any;
  pricing: any;
}

export default function MoveInWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [moveInData, setMoveInData] = useState<MoveInData>({
    tenantInfo: null,
    selectedUnit: null,
    leaseConfig: null,
    pricing: null
  });

  const totalSteps = 4;

  const handleTenantInfoSubmit = async (tenantInfo: any) => {
    try {
      // Generate gate access code
      const gateAccessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: tenantInfo.firstName,
          last_name: tenantInfo.lastName,
          email: tenantInfo.email,
          phone: tenantInfo.phone,
          gate_access_code: gateAccessCode,
          current_balance: 0,
          is_locked_out: false,
          // Add test identifier for cleanup
          notes: tenantInfo.email.includes('test') || tenantInfo.email.includes('e2e') ? 'TEST_DATA' : null
        })
      });
      
      if (!response.ok) throw new Error('Failed to create tenant');
      
      const tenantData = await response.json();
      setMoveInData((prev: MoveInData) => ({ ...prev, tenantInfo: { ...tenantInfo, id: tenantData.id, gateAccessCode } }));
      setCurrentStep(2);
    } catch (error) {
      alert('Error creating tenant record. Please try again.');
      console.error('Tenant creation error:', error);
    }
  };

  const handleUnitSelect = async (selectedUnit: any) => {
    try {
      // Update unit status to occupied
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_number: selectedUnit.unitNumber,
          size: selectedUnit.size,
          monthly_price: selectedUnit.price,
          status: 'occupied',
          door_type: 'roll_up'
        })
      });
      
      if (!response.ok) throw new Error('Failed to reserve unit');
      
      const unitData = await response.json();
      setMoveInData((prev: MoveInData) => ({ ...prev, selectedUnit: { ...selectedUnit, id: unitData.id } }));
      setCurrentStep(3);
    } catch (error) {
      alert('Error reserving unit. Please try again.');
      console.error('Unit reservation error:', error);
    }
  };

  const handleLeaseConfig = (leaseConfig: any) => {
    setMoveInData((prev: MoveInData) => ({ ...prev, leaseConfig }));
    setCurrentStep(4);
  };

  const handlePaymentComplete = async (paymentDetails: any) => {
    try {
      // Link tenant to unit
      if (moveInData.tenantInfo?.id && moveInData.selectedUnit?.id) {
        const response = await fetch(`/api/tenants/${moveInData.tenantInfo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unit_id: moveInData.selectedUnit.id
          })
        });
        
        if (!response.ok) throw new Error('Failed to link tenant to unit');
      }
      
      setMoveInData((prev: MoveInData) => ({ ...prev, pricing: { paymentDetails } }));
      alert('Move-in complete! Welcome to SummitOS. Your gate access code is: ' + moveInData.tenantInfo?.gateAccessCode);
    } catch (error) {
      alert('Error completing move-in. Please contact support.');
      console.error('Move-in completion error:', error);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Tenant Information';
      case 2: return 'Select Unit';
      case 3: return 'Configure Lease';
      case 4: return 'Payment & Activation';
      default: return 'Welcome';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress Bar */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">SummitOS Move-In Wizard</h1>
            <div className="text-sm text-gray-600">
              Step {currentStep} of {totalSteps}: {getStepTitle()}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step < currentStep
                        ? 'bg-blue-600 text-white'
                        : step === currentStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {step}
                  </div>
                  {step < 4 && (
                    <div className="w-16 h-1 bg-gray-300 ml-2"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {currentStep === 1 && (
          <TenantInfoForm
            onSubmit={handleTenantInfoSubmit}
            onNext={() => {}}
          />
        )}
        
        {currentStep === 2 && (
          <UnitSelection
            onUnitSelect={handleUnitSelect}
            onNext={() => {}}
            onBack={handleBack}
            selectedUnit={moveInData.selectedUnit}
          />
        )}
        
        {currentStep === 3 && (
          <LeaseConfiguration
            unit={moveInData.selectedUnit}
            tenantInfo={moveInData.tenantInfo}
            onLeaseConfigure={handleLeaseConfig}
            onNext={() => {}}
            onBack={handleBack}
          />
        )}
        
        {currentStep === 4 && (
          <PaymentProcessing
            tenantInfo={moveInData.tenantInfo}
            unit={moveInData.selectedUnit}
            leaseConfig={moveInData.leaseConfig}
            pricing={{ totalDue: 150 }}
            onPaymentComplete={handlePaymentComplete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}