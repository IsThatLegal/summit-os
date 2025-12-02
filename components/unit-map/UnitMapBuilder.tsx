'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, MapPin, Grid3X3, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

interface Unit {
  id: string;
  unitNumber: string;
  width: number;
  depth: number;
  height: number;
  size: number;
  basePrice: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  doorType: 'roll_up' | 'swing';
  type: string;
  tenantName?: string;
  x?: number;
  y?: number;
  rotation?: number; // 0, 90, 180, 270 degrees
}

export default function UnitMapBuilder() {
  const { theme, toggleTheme } = useTheme();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pixelsPerFoot, setPixelsPerFoot] = useState(20); // Adjustable: 20px = 1 square foot
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [draggedUnit, setDraggedUnit] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [isDraggingMultiple, setIsDraggingMultiple] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const [newUnit, setNewUnit] = useState<Partial<Unit>>({
    unitNumber: '',
    width: 0,
    depth: 0,
    height: 0,
    size: 0,
    basePrice: 0,
    status: 'available',
    doorType: 'roll_up',
    type: 'standard',
  });

  const fetchUnits = async () => {
    try {
      const response = await fetch('/api/units');
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched units:', data);
        setUnits(data);
      } else {
        console.error('Failed to fetch units:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch units:', error);
    }
  };

  const createUnit = async () => {
    try {
      // Calculate size from dimensions
      const calculatedSize = (newUnit.width || 0) * (newUnit.depth || 0);
      
      // Find next available grid position
      const existingPositions = units.map(u => `${u.x},${u.y}`);
      let newX = 0, newY = 0;
      let foundPosition = false;
      
      for (let row = 0; row < 20 && !foundPosition; row++) {
        for (let col = 0; col < 20 && !foundPosition; col++) {
          const testX = col * pixelsPerFoot;
          const testY = row * pixelsPerFoot;
          if (!existingPositions.includes(`${testX},${testY}`)) {
            newX = testX;
            newY = testY;
            foundPosition = true;
          }
        }
      }

      const unitData = {
        ...newUnit,
        size: calculatedSize,
        x: newX,
        y: newY,
      };

      const response = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unitData),
      });

      if (response.ok) {
        await fetchUnits();
        setIsCreating(false);
        setNewUnit({
          unitNumber: '',
          width: 0,
          depth: 0,
          height: 0,
          size: 0,
          basePrice: 0,
          status: 'available',
          doorType: 'roll_up',
          type: 'standard',
        });
      } else {
        const errorData = await response.json();
        alert(`Failed to create unit: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create unit:', error);
      alert('Failed to create unit. Please try again.');
    }
  };

  const updateUnit = async (unit: Unit) => {
    try {
      const response = await fetch(`/api/units/${unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unit),
      });

      if (response.ok) {
        await fetchUnits();
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to update unit:', error);
    }
  };

  const deleteUnit = async (unitId: string) => {
    if (!window.confirm('Are you sure you want to delete this unit?')) return;

    try {
      const response = await fetch(`/api/units/${unitId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchUnits();
        setSelectedUnit(null);
      }
    } catch (error) {
      console.error('Failed to delete unit:', error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, unitId: string) => {
    const unit = units.find((u: Unit) => u.id === unitId);
    if (!unit || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    setDraggedUnit(unitId);
    setDragOffset({
      x: e.clientX - rect.left - (unit.x || 0),
      y: e.clientY - rect.top - (unit.y || 0),
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedUnit || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    let newX = e.clientX - rect.left - dragOffset.x;
    let newY = e.clientY - rect.top - dragOffset.y;

    if (snapToGrid) {
      newX = Math.round(newX / pixelsPerFoot) * pixelsPerFoot;
      newY = Math.round(newY / pixelsPerFoot) * pixelsPerFoot;
    }

    setUnits((prev: Unit[]) => prev.map((unit: Unit) => 
      unit.id === draggedUnit 
        ? { ...unit, x: Math.max(0, newX), y: Math.max(0, newY) }
        : unit
    ));
  };

  const handleMouseUp = async () => {
    if (draggedUnit) {
      const unit = units.find((u: Unit) => u.id === draggedUnit);
      if (unit) {
        await updateUnit(unit);
      }
      setDraggedUnit(null);
    }
  };

  const handleUnitClick = (unit: Unit, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (e.ctrlKey || e.metaKey) {
      // Multi-selection with Ctrl/Cmd key
      setSelectedUnits(prev => {
        const newSet = new Set(prev);
        if (newSet.has(unit.id)) {
          newSet.delete(unit.id);
        } else {
          newSet.add(unit.id);
        }
        return newSet;
      });
    } else {
      // Single selection
      setSelectedUnits(new Set([unit.id]));
      setSelectedUnit(unit);
    }
  };

  const rotateUnit = async (unitId: string, direction: 'left' | 'right') => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    const currentRotation = unit.rotation || 0;
    const newRotation = direction === 'right' 
      ? (currentRotation + 90) % 360 
      : (currentRotation - 90 + 360) % 360;

    const updatedUnit = { ...unit, rotation: newRotation };
    
    // Swap width and depth for 90/270 degree rotations
    if (newRotation === 90 || newRotation === 270) {
      updatedUnit.width = unit.depth;
      updatedUnit.depth = unit.width;
    }

    await updateUnit(updatedUnit);
  };

  const rotateSelectedUnits = async (direction: 'left' | 'right') => {
    for (const unitId of selectedUnits) {
      await rotateUnit(unitId, direction);
    }
  };

  const deleteSelectedUnits = async () => {
    if (selectedUnits.size === 0) return;
    
    const count = selectedUnits.size;
    if (!window.confirm(`Are you sure you want to delete ${count} unit${count > 1 ? 's' : ''}?`)) return;

    for (const unitId of selectedUnits) {
      await deleteUnit(unitId);
    }
    setSelectedUnits(new Set());
    setSelectedUnit(null);
  };

  useEffect(() => {
    console.log('UnitMapBuilder component mounted');
    fetchUnits();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedUnits.size > 0) {
          deleteSelectedUnits();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (e.shiftKey) {
          rotateSelectedUnits('left');
        } else {
          rotateSelectedUnits('right');
        }
      } else if (e.key === 'Escape') {
        setSelectedUnits(new Set());
        setSelectedUnit(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUnits, units]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'maintenance': return 'bg-yellow-500';
      case 'reserved': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  const generateUniqueUnitNumber = () => {
    const existingNumbers = units.map(u => u.unitNumber);
    const letters = ['A', 'B', 'C', 'D'];
    const numbers = Array.from({ length: 20 }, (_, i) => (i + 1).toString().padStart(3, '0'));
    
    for (const letter of letters) {
      for (const number of numbers) {
        const unitNumber = `${letter}${number}`;
        if (!existingNumbers.includes(unitNumber)) {
          return unitNumber;
        }
      }
    }
    return 'CUSTOM001';
  };

  console.log('Rendering UnitMapBuilder with', units.length, 'units');
  
  return (
    <div className={`min-h-screen p-8 ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Unit Map Builder</h1>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={(e) => setSnapToGrid(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Snap to Grid</span>
              </label>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Scale:</label>
                <select
                  value={pixelsPerFoot}
                  onChange={(e) => setPixelsPerFoot(parseInt(e.target.value))}
                  className={`px-3 py-1 text-sm border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300'}`}
                >
                  <option value={10}>10px/ft (Large)</option>
                  <option value={20}>20px/ft (Medium)</option>
                  <option value={30}>30px/ft (Small)</option>
                  <option value={40}>40px/ft (Tiny)</option>
                </select>
                <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>({pixelsPerFoot}px = 1ft²)</span>
              </div>
            </div>
            
            {selectedUnits.size > 0 && (
              <>
                <button
                  onClick={() => rotateSelectedUnits('left')}
                  className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700"
                  title="Rotate Left (Shift+R)"
                >
                  ↺
                </button>
                <button
                  onClick={() => rotateSelectedUnits('right')}
                  className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700"
                  title="Rotate Right (R)"
                >
                  ↻
                </button>
                <button
                  onClick={deleteSelectedUnits}
                  className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700"
                  title="Delete Selected (Delete)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <span className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200'}`}>
                  {selectedUnits.size} selected
                </span>
              </>
            )}
            
            <button
              onClick={() => {
                setIsCreating(true);
                setSelectedUnits(new Set());
                setSelectedUnit(null);
                setIsEditing(false);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Unit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className={`rounded-lg shadow-lg p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Unit Map</h2>
                <Grid3X3 className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`} />
              </div>
              
              <div 
                ref={mapRef}
                className={`relative rounded-lg h-96 overflow-hidden border-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                style={{
                  backgroundImage: snapToGrid 
                    ? `repeating-linear-gradient(0deg, ${theme === 'dark' ? '#374151' : '#e5e7eb'} 0px, transparent 1px, transparent ${pixelsPerFoot - 1}px, ${theme === 'dark' ? '#374151' : '#e5e7eb'} ${pixelsPerFoot}px), repeating-linear-gradient(90deg, ${theme === 'dark' ? '#374151' : '#e5e7eb'} 0px, transparent 1px, transparent ${pixelsPerFoot - 1}px, ${theme === 'dark' ? '#374151' : '#e5e7eb'} ${pixelsPerFoot}px)`
                    : 'none',
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {units.map((unit: Unit) => {
                  const rotation = unit.rotation || 0;
                  const isSelected = selectedUnits.has(unit.id);
                  const isRotated = rotation === 90 || rotation === 270;
                  const displayWidth = isRotated ? unit.depth * pixelsPerFoot : unit.width * pixelsPerFoot;
                  const displayHeight = isRotated ? unit.width * pixelsPerFoot : unit.depth * pixelsPerFoot;
                  
                  return (
                    <div
                      key={unit.id}
                      className={`absolute ${getStatusColor(unit.status)} text-white rounded cursor-move flex items-center justify-center text-xs font-bold transition-all hover:opacity-80 ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${draggedUnit === unit.id ? 'opacity-60' : ''}`}
                      style={{
                        left: `${unit.x || 0}px`,
                        top: `${unit.y || 0}px`,
                        width: `${displayWidth}px`,
                        height: `${displayHeight}px`,
                        margin: 0,
                        padding: 0,
                        transform: `rotate(${rotation}deg)`,
                        transformOrigin: 'center',
                      }}
                      onMouseDown={(e) => handleMouseDown(e, unit.id)}
                      onClick={(e) => !draggedUnit && handleUnitClick(unit, e)}
                    >
                      <div className="relative w-full h-full flex items-center justify-center">
                        <div style={{ transform: `rotate(-${rotation}deg)` }}>
                          {unit.unitNumber}
                        </div>
                        {rotation !== 0 && rotation !== undefined && (
                          <div className="absolute top-0 right-0 w-2 h-2 bg-blue-400 rounded-full" title={`${rotation}°`}></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`mt-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <p>• <strong>Click</strong> to select single unit</p>
                <p>• <strong>Ctrl+Click</strong> to multi-select units</p>
                <p>• <strong>R</strong> to rotate selected right, <strong>Shift+R</strong> to rotate left</p>
                <p>• <strong>Delete</strong> to remove selected units</p>
                <p>• <strong>Drag</strong> to move units (snaps to {snapToGrid ? `${pixelsPerFoot}px grid` : 'free position'})</p>
                <p>• <strong>Scale</strong> adjusts unit size (1ft² = {pixelsPerFoot}px)</p>
                <p>• <strong>Escape</strong> to clear selection</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <h2 className="text-xl font-bold mb-4">Unit Details</h2>
              
              {isCreating ? (
                <div className="space-y-4">
                  <h3 className="font-medium text-blue-600">Create New Unit</h3>
                  
                   <div>
                     <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Unit Number</label>
                     <div className="flex gap-2">
                       <input
                         type="text"
                         placeholder="e.g., A101, B205"
                         value={newUnit.unitNumber || ''}
                         onChange={(e) => setNewUnit({ ...newUnit, unitNumber: e.target.value })}
                         className={`flex-1 px-4 py-3 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                       />
                       <button
                         type="button"
                         onClick={() => setNewUnit({ ...newUnit, unitNumber: generateUniqueUnitNumber() })}
                         className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
                       >
                         Auto
                       </button>
                     </div>
                   </div>
                  
                   <div>
                     <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Dimensions (ft)</label>
                     <div className="grid grid-cols-3 gap-2">
                       <input
                         type="number"
                         placeholder="Width"
                         value={newUnit.width || ''}
                         onChange={(e) => setNewUnit({ ...newUnit, width: parseInt(e.target.value) || 0 })}
                         className={`w-full px-3 py-2 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                       />
                       <input
                         type="number"
                         placeholder="Depth"
                         value={newUnit.depth || ''}
                         onChange={(e) => setNewUnit({ ...newUnit, depth: parseInt(e.target.value) || 0 })}
                         className={`w-full px-3 py-2 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                       />
                       <input
                         type="number"
                         placeholder="Height"
                         value={newUnit.height || ''}
                         onChange={(e) => setNewUnit({ ...newUnit, height: parseInt(e.target.value) || 0 })}
                         className={`w-full px-3 py-2 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                       />
                     </div>
                     <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Square footage: {(newUnit.width || 0) * (newUnit.depth || 0)} sq ft</p>
                   </div>
                  
                   <div>
                     <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Monthly Rent ($)</label>
                     <input
                       type="number"
                       placeholder="e.g., 150, 250, 500"
                       value={newUnit.basePrice || ''}
                       onChange={(e) => setNewUnit({ ...newUnit, basePrice: parseInt(e.target.value) || 0 })}
                       className={`w-full px-4 py-3 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                     />
                   </div>
                  
                   <div>
                     <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Status</label>
                     <select
                       value={newUnit.status || 'available'}
                       onChange={(e) => setNewUnit({ ...newUnit, status: e.target.value as Unit['status'] })}
                       className={`w-full px-4 py-3 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                     >
                       <option value="available">Available</option>
                       <option value="occupied">Occupied</option>
                       <option value="maintenance">Maintenance</option>
                       <option value="reserved">Reserved</option>
                     </select>
                   </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Door Type</label>
                       <select
                         value={newUnit.doorType || 'roll_up'}
                         onChange={(e) => setNewUnit({ ...newUnit, doorType: e.target.value as 'roll_up' | 'swing' })}
                         className={`w-full px-4 py-3 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                       >
                         <option value="roll_up">Roll-Up</option>
                         <option value="swing">Swing</option>
                       </select>
                     </div>
                     
                     <div>
                       <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Unit Type</label>
                       <select
                         value={newUnit.type || 'standard'}
                         onChange={(e) => setNewUnit({ ...newUnit, type: e.target.value })}
                         className={`w-full px-4 py-3 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                       >
                         <option value="standard">Standard</option>
                         <option value="climate">Climate Controlled</option>
                         <option value="drive_up">Drive-Up</option>
                         <option value="parking">Parking</option>
                       </select>
                     </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (newUnit.unitNumber && newUnit.width && newUnit.depth && newUnit.height && newUnit.basePrice) {
                          createUnit();
                        }
                      }}
                      className="flex-1 bg-blue-600 text-white px-4 py-3 text-base font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Create Unit
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setNewUnit({
                          unitNumber: '',
                          width: 0,
                          depth: 0,
                          height: 0,
                          size: 0,
                          basePrice: 0,
                          status: 'available',
                          doorType: 'roll_up',
                          type: 'standard',
                        });
                      }}
                      className="flex-1 bg-gray-600 text-white px-4 py-3 text-base font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : selectedUnit ? (
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                    <h3 className="font-medium text-blue-600">{selectedUnit.unitNumber}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(true)}
                        className={`p-1 rounded ${theme === 'dark' ? 'text-blue-400 hover:bg-blue-900' : 'text-blue-600 hover:bg-blue-100'}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteUnit(selectedUnit.id)}
                        className={`p-1 rounded ${theme === 'dark' ? 'text-red-400 hover:bg-red-900' : 'text-red-600 hover:bg-red-100'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Unit Number</label>
                           <input
                             type="text"
                             value={selectedUnit.unitNumber}
                             onChange={(e) => setSelectedUnit({ ...selectedUnit, unitNumber: e.target.value })}
                             className={`w-full px-4 py-3 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                           />
                         </div>
                         <div>
                           <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Dimensions (ft)</label>
                           <div className="grid grid-cols-3 gap-2">
                             <input
                               type="number"
                               placeholder="Width"
                               value={selectedUnit.width}
                               onChange={(e) => setSelectedUnit({ ...selectedUnit, width: parseInt(e.target.value) || 0 })}
                               className={`w-full px-3 py-2 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                             />
                             <input
                               type="number"
                               placeholder="Depth"
                               value={selectedUnit.depth}
                               onChange={(e) => setSelectedUnit({ ...selectedUnit, depth: parseInt(e.target.value) || 0 })}
                               className={`w-full px-3 py-2 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                             />
                             <input
                               type="number"
                               placeholder="Height"
                               value={selectedUnit.height}
                               onChange={(e) => setSelectedUnit({ ...selectedUnit, height: parseInt(e.target.value) || 0 })}
                               className={`w-full px-3 py-2 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                             />
                           </div>
                           <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Square footage: {selectedUnit.width * selectedUnit.depth} sq ft</p>
                         </div>
                      </div>
                      
                       <div>
                         <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Monthly Rent ($)</label>
                         <input
                           type="number"
                           value={selectedUnit.basePrice}
                           onChange={(e) => setSelectedUnit({ ...selectedUnit, basePrice: parseInt(e.target.value) || 0 })}
                           className={`w-full px-4 py-3 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                         />
                       </div>
                       
                       <div>
                         <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Status</label>
                         <select
                           value={selectedUnit.status}
                           onChange={(e) => setSelectedUnit({ ...selectedUnit, status: e.target.value as Unit['status'] })}
                           className={`w-full px-4 py-3 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
                         >
                           <option value="available">Available</option>
                           <option value="occupied">Occupied</option>
                           <option value="maintenance">Maintenance</option>
                           <option value="reserved">Reserved</option>
                         </select>
                       </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            updateUnit(selectedUnit);
                            setIsEditing(false);
                          }}
                          className="flex-1 bg-blue-600 text-white px-4 py-3 text-base font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="flex-1 bg-gray-600 text-white px-4 py-3 text-base font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                     <div className="space-y-3">
                       <div className="grid grid-cols-2 gap-4">
                         <div>
                           <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Dimensions:</span>
                           <p className="font-medium">{selectedUnit.width}ft × {selectedUnit.depth}ft × {selectedUnit.height}ft</p>
                           <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{selectedUnit.width * selectedUnit.depth} sq ft</p>
                         </div>
                         <div>
                           <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Monthly Rent:</span>
                           <p className="font-medium">${selectedUnit.basePrice}</p>
                         </div>
                       </div>
                       <div>
                         <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Status:</span>
                         <p className="font-medium capitalize">{selectedUnit.status}</p>
                       </div>
                       <div>
                         <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Rotation:</span>
                         <p className="font-medium">{(selectedUnit.rotation || 0)}°</p>
                       </div>
                     </div>
                  )}
                </div>
               ) : (
                 <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                   <MapPin className="w-12 h-12 mx-auto mb-4" />
                   <p className="text-lg mb-2">Click on a unit to view details</p>
                   <p className="text-lg">or click &quot;Add Unit&quot; to create a new one</p>
                 </div>
               )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-6 rounded-lg border-2 ${theme === 'dark' ? 'bg-green-900 border-green-700' : 'bg-green-100 border-green-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span className="text-lg font-semibold">Available</span>
            </div>
            <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
              {units.filter((u: Unit) => u.status === 'available').length}
            </div>
          </div>
          
          <div className={`p-6 rounded-lg border-2 ${theme === 'dark' ? 'bg-red-900 border-red-700' : 'bg-red-100 border-red-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span className="text-lg font-semibold">Occupied</span>
            </div>
            <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>
              {units.filter((u: Unit) => u.status === 'occupied').length}
            </div>
          </div>
          
          <div className={`p-6 rounded-lg border-2 ${theme === 'dark' ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-100 border-yellow-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <span className="text-lg font-semibold">Maintenance</span>
            </div>
            <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
              {units.filter((u: Unit) => u.status === 'maintenance').length}
            </div>
          </div>
          
          <div className={`p-6 rounded-lg border-2 ${theme === 'dark' ? 'bg-blue-900 border-blue-700' : 'bg-blue-100 border-blue-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span className="text-lg font-semibold">Reserved</span>
            </div>
            <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
              {units.filter((u: Unit) => u.status === 'reserved').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}