'use client';

import React, { useState, useEffect } from 'react';

interface Unit {
  id: string;
  unitNumber: string;
  size: number;
  type: string;
  basePrice: number;
  features: string[];
  location: string;
  isAvailable: boolean;
  monthlyPrice?: number;
}

interface UnitSelectionProps {
  onUnitSelect: (unit: Unit) => void;
  onNext: () => void;
  onBack: () => void;
  selectedUnit?: Unit;
}

export default function UnitSelection({ onUnitSelect, onNext, onBack, selectedUnit }: UnitSelectionProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    minSize: 0,
    maxSize: 1000,
    maxPrice: 1000,
    features: [] as string[]
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data for demonstration
  useEffect(() => {
    const mockUnits: Unit[] = [
      {
        id: '1',
        unitNumber: 'A101',
        size: 25,
        type: 'storage',
        basePrice: 45,
        features: ['climate_control', 'security_camera'],
        location: 'indoor_first_floor',
        isAvailable: true,
        monthlyPrice: 45
      },
      {
        id: '2',
        unitNumber: 'A102',
        size: 50,
        type: 'storage',
        basePrice: 75,
        features: ['climate_control', 'security_camera', 'drive_up_access'],
        location: 'indoor_first_floor',
        isAvailable: true,
        monthlyPrice: 75
      },
      {
        id: '3',
        unitNumber: 'B101',
        size: 100,
        type: 'storage',
        basePrice: 125,
        features: ['climate_control', 'security_camera', 'drive_up_access', 'high_ceiling'],
        location: 'indoor_second_floor',
        isAvailable: true,
        monthlyPrice: 125
      },
      {
        id: '4',
        unitNumber: 'B102',
        size: 150,
        type: 'storage',
        basePrice: 175,
        features: ['climate_control', 'security_camera', 'drive_up_access', 'high_ceiling'],
        location: 'indoor_second_floor',
        isAvailable: false,
        monthlyPrice: 175
      },
      {
        id: '5',
        unitNumber: 'C101',
        size: 200,
        type: 'storage',
        basePrice: 225,
        features: ['climate_control', 'security_camera', 'drive_up_access', 'high_ceiling', 'fire_suppression'],
        location: 'indoor_third_floor',
        isAvailable: true,
        monthlyPrice: 225
      }
    ];

    setTimeout(() => {
      setUnits(mockUnits);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredUnits = units.filter(unit => {
    const matchesSize = unit.size >= filters.minSize && unit.size <= filters.maxSize;
    const matchesPrice = unit.monthlyPrice && unit.monthlyPrice <= filters.maxPrice;
    const matchesSearch = unit.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         unit.size.toString().includes(searchTerm);
    const matchesFeatures = filters.features.length === 0 || 
                           filters.features.every(feature => unit.features.includes(feature));
    
    return matchesSize && matchesPrice && matchesSearch && matchesFeatures;
  });

  const handleUnitClick = (unit: Unit) => {
    onUnitSelect(unit);
  };

  const getSizeColor = (size: number) => {
    if (size <= 50) return 'text-green-600 bg-green-100';
    if (size <= 100) return 'text-blue-600 bg-blue-100';
    if (size <= 150) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-r-2 border-b-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading available units...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Your Unit</h2>
          <p className="text-gray-600">Choose from our available units. This should take about 30 seconds.</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Size (sq ft)</label>
              <input
                type="number"
                value={filters.minSize}
                onChange={(e) => setFilters(prev => ({ ...prev, minSize: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Size (sq ft)</label>
              <input
                type="number"
                value={filters.maxSize}
                onChange={(e) => setFilters(prev => ({ ...prev, maxSize: parseInt(e.target.value) || 1000 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="1000"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Price ($)</label>
              <input
                type="number"
                value={filters.maxPrice}
                onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: parseInt(e.target.value) || 1000 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="1000"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Unit number or size..."
              />
            </div>
          </div>
        </div>

        {/* Units Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6" data-testid="unit-grid">
        {filteredUnits.map((unit) => (
          <div
            key={unit.id}
            data-testid="unit-card"
            onClick={() => handleUnitClick(unit)}
            className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
              selectedUnit?.id === unit.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${!unit.isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Unit {unit.unitNumber}</h3>
                  <p className="text-sm text-gray-600">{unit.size} sq ft</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${getSizeColor(unit.size)}`}>
                  {unit.size} sq ft
                </div>
              </div>
              
              <div className="mb-3">
                <div className="text-2xl font-bold text-gray-900">
                  {formatPrice(unit.monthlyPrice || unit.basePrice)}
                  <span className="text-sm text-gray-600 font-normal">/month</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {unit.features.map((feature, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {feature.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                    </span>
                  ))}
                </div>
                
                <div className="text-sm text-gray-600">
                  📍 {unit.location.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                </div>
              </div>
              
              {!unit.isAvailable && (
                <div className="mt-3 p-2 bg-red-100 text-red-800 text-sm rounded">
                  Currently Occupied
                </div>
              )}
              
              {selectedUnit?.id === unit.id && (
                <div className="mt-3 p-2 bg-green-100 text-green-800 text-sm rounded">
                  ✓ Selected
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Back
          </button>
          
          <button
            onClick={onNext}
            disabled={!selectedUnit}
            className={`flex-1 px-6 py-3 rounded-lg font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              !selectedUnit
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Continue to Lease Setup
          </button>
        </div>

        {/* Quick Recommendations */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Quick Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-blue-600 font-medium mb-1">Best Value</div>
              <div className="text-lg font-bold text-blue-900">B101</div>
              <div className="text-sm text-blue-600">100 sq ft • {formatPrice(125)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600 font-medium mb-1">Most Popular</div>
              <div className="text-lg font-bold text-blue-900">B102</div>
              <div className="text-sm text-blue-600">150 sq ft • {formatPrice(175)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600 font-medium mb-1">Largest Available</div>
              <div className="text-lg font-bold text-blue-900">C101</div>
              <div className="text-sm text-blue-600">200 sq ft • {formatPrice(225)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}