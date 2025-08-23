'use client';

import React, { useState, useCallback } from 'react';
import { CanvasStage } from './CanvasStage';
import type { PerformanceMetrics } from './CanvasStage';

/**
 * Demo component showcasing the enhanced CanvasStage with performance monitoring
 * and hardware acceleration features.
 */
export const CanvasStageDemo: React.FC = () => {
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    currentFPS: 60,
    averageFPS: 60,
    frameTime: 16.67,
    renderTime: 0,
    isOptimal: true,
    warnings: [],
  });

  const handlePerformanceUpdate = useCallback((metrics: PerformanceMetrics) => {
    setPerformanceMetrics(metrics);
  }, []);

  const performanceConfig = {
    enableFPSMonitoring: true,
    enableHardwareAcceleration: true,
    enablePerformanceWarnings: true,
    targetFPS: 60,
    fpsAveragingWindow: 30,
  };

  const hardwareAccelerationConfig = {
    useWebGL: true,
    enableLayering: true,
    enableCaching: true,
    useOptimizedDrawing: true,
    bufferRatio: window.devicePixelRatio || 2,
  };

  return (
    <div className="w-full h-screen bg-gray-50 relative">
      {/* Performance Dashboard */}
      <div className="absolute top-4 left-4 z-10 bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-2">Performance Monitor</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium">Current FPS:</div>
            <div className={`text-lg ${performanceMetrics.currentFPS >= 55 ? 'text-green-600' : 'text-red-600'}`}>
              {performanceMetrics.currentFPS}
            </div>
          </div>
          <div>
            <div className="font-medium">Average FPS:</div>
            <div className={`text-lg ${performanceMetrics.averageFPS >= 55 ? 'text-green-600' : 'text-red-600'}`}>
              {performanceMetrics.averageFPS}
            </div>
          </div>
          <div>
            <div className="font-medium">Frame Time:</div>
            <div className="text-lg">{performanceMetrics.frameTime.toFixed(1)}ms</div>
          </div>
          <div>
            <div className="font-medium">Status:</div>
            <div className={`text-lg ${performanceMetrics.isOptimal ? 'text-green-600' : 'text-yellow-600'}`}>
              {performanceMetrics.isOptimal ? 'Optimal' : 'Suboptimal'}
            </div>
          </div>
        </div>
        
        {performanceMetrics.warnings.length > 0 && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <div className="font-medium text-yellow-800 text-sm mb-1">Performance Warnings:</div>
            {performanceMetrics.warnings.map((warning, index) => (
              <div key={index} className="text-xs text-yellow-700">{warning}</div>
            ))}
          </div>
        )}
      </div>

      {/* Hardware Acceleration Info */}
      <div className="absolute top-4 right-4 z-10 bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-2">Hardware Acceleration</h3>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>WebGL:</span>
            <span className={hardwareAccelerationConfig.useWebGL ? 'text-green-600' : 'text-red-600'}>
              {hardwareAccelerationConfig.useWebGL ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Caching:</span>
            <span className={hardwareAccelerationConfig.enableCaching ? 'text-green-600' : 'text-red-600'}>
              {hardwareAccelerationConfig.enableCaching ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Buffer Ratio:</span>
            <span className="text-blue-600">{hardwareAccelerationConfig.bufferRatio}x</span>
          </div>
          <div className="flex justify-between">
            <span>Optimized Drawing:</span>
            <span className={hardwareAccelerationConfig.useOptimizedDrawing ? 'text-green-600' : 'text-red-600'}>
              {hardwareAccelerationConfig.useOptimizedDrawing ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced CanvasStage */}
      <CanvasStage
        width={window.innerWidth}
        height={window.innerHeight}
        scale={{ x: 1, y: 1 }}
        position={{ x: 0, y: 0 }}
        performanceConfig={performanceConfig}
        hardwareAcceleration={hardwareAccelerationConfig}
        onPerformanceUpdate={handlePerformanceUpdate}
      >
        {/* Demo content would go here */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="text-center text-gray-600">
            <h2 className="text-2xl font-bold mb-2">Enhanced Canvas Stage</h2>
            <p className="text-sm">Hardware acceleration enabled</p>
            <p className="text-sm">Real-time performance monitoring active</p>
          </div>
        </div>
      </CanvasStage>
    </div>
  );
};