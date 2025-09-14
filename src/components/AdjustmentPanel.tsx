/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { RemoveBackgroundIcon, UpscaleIcon, ColorBalanceIcon } from './icons';

interface AdjustmentPanelProps {
  onRemoveBackground: () => void;
  onUpscale: () => void;
  onAutoEnhance: () => void;
  onBalanceColors: (prompt: string) => void;
  isLoading: boolean;
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ onRemoveBackground, onUpscale, onAutoEnhance, onBalanceColors, isLoading }) => {
  const [colorPrompt, setColorPrompt] = useState('');

  const handleColorBalanceApply = () => {
    if (colorPrompt) {
      onBalanceColors(colorPrompt);
      setColorPrompt('');
    }
  };

  return (
    <div className="w-full bg-purple-950/50 border border-purple-800/50 rounded-xl p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-2xl animated-panel">
      <h3 className="text-lg font-semibold text-center text-purple-200">Adjustments</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={onRemoveBackground}
          disabled={isLoading}
          className="w-full text-center bg-purple-950/60 border border-purple-700/40 text-purple-200 font-semibold py-3 px-4 rounded-lg transition-all duration-200 ease-in-out hover:bg-purple-900/80 hover:border-purple-600 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <RemoveBackgroundIcon className="w-5 h-5" /> Remove Background
        </button>
         <button
          onClick={onUpscale}
          disabled={isLoading}
          className="w-full text-center bg-purple-950/60 border border-purple-700/40 text-purple-200 font-semibold py-3 px-4 rounded-lg transition-all duration-200 ease-in-out hover:bg-purple-900/80 hover:border-purple-600 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <UpscaleIcon className="w-5 h-5" /> AI Upscale
        </button>
         <button
          onClick={onAutoEnhance}
          disabled={isLoading}
          className="w-full text-center bg-purple-950/60 border border-purple-700/40 text-purple-200 font-semibold py-3 px-4 rounded-lg transition-all duration-200 ease-in-out hover:bg-purple-900/80 hover:border-purple-600 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <ColorBalanceIcon className="w-5 h-5" /> Auto-Enhance
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={colorPrompt}
          onChange={(e) => setColorPrompt(e.target.value)}
          placeholder="Or describe a color adjustment (e.g., 'make it warmer')"
          className="flex-grow bg-purple-950/60 border border-purple-700/40 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
          disabled={isLoading}
        />
        <button
            onClick={handleColorBalanceApply}
            className="bg-purple-800 text-white font-bold py-3 px-5 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-900/40 hover:bg-purple-700 active:scale-95 text-base disabled:bg-purple-800/50 disabled:shadow-none disabled:cursor-not-allowed"
            disabled={isLoading || !colorPrompt.trim()}
        >
            Apply
        </button>
      </div>
    </div>
  );
};

export default AdjustmentPanel;