/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { SparklesIcon } from './icons';
import { getAICropSuggestions } from '../services/geminiService';
import type { CropSuggestion } from '../App';
import Spinner from './Spinner';

interface CropPanelProps {
  onApplyCrop: () => void;
  onSetAspect: (aspect: number | undefined) => void;
  onApplyCropSuggestion: (suggestion: CropSuggestion) => void;
  currentImage: File | null;
  isLoading: boolean;
  isCropping: boolean;
}

type AspectRatio = 'free' | '1:1' | '16:9';

const CropPanel: React.FC<CropPanelProps> = ({ onApplyCrop, onSetAspect, onApplyCropSuggestion, currentImage, isLoading, isCropping }) => {
  const [activeAspect, setActiveAspect] = useState<AspectRatio>('free');
  const [isFetchingIdeas, setIsFetchingIdeas] = useState(false);
  const [cropSuggestions, setCropSuggestions] = useState<CropSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const handleAspectChange = (aspect: AspectRatio, value: number | undefined) => {
    setActiveAspect(aspect);
    onSetAspect(value);
  }

  const handleGetAIIdeas = async () => {
    if (!currentImage) return;
    setIsFetchingIdeas(true);
    setCropSuggestions([]);
    setError(null);
    try {
        const suggestions = await getAICropSuggestions(currentImage);
        setCropSuggestions(suggestions);
    } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred.";
        setError(`Could not get suggestions. ${message}`);
        console.error(err);
    } finally {
        setIsFetchingIdeas(false);
    }
  };

  const aspects: { name: AspectRatio, value: number | undefined }[] = [
    { name: 'free', value: undefined },
    { name: '1:1', value: 1 / 1 },
    { name: '16:9', value: 16 / 9 },
  ];

  return (
    <>
      <div className="w-full bg-purple-950/50 border border-purple-800/50 rounded-xl p-2 backdrop-blur-2xl animated-panel">
        <button onClick={handleGetAIIdeas} disabled={isLoading || isFetchingIdeas || !currentImage} className="w-full text-center bg-purple-900/40 text-purple-200 font-semibold py-3 px-4 rounded-lg transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isFetchingIdeas ? <Spinner /> : <SparklesIcon className="w-5 h-5 text-yellow-300" />}
            {isFetchingIdeas ? 'Analyzing...' : 'Get AI Ideas'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 text-center mt-2">{error}</p>}
      {cropSuggestions.length > 0 && (
        <div className="w-full p-2 grid grid-cols-2 md:grid-cols-3 gap-2 animate-fade-in">
          {cropSuggestions.map(suggestion => (
            <button key={suggestion.name} onClick={() => onApplyCropSuggestion(suggestion)} className="text-center bg-purple-900/40 text-purple-200 font-semibold py-2 px-3 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95 text-sm">
              {suggestion.name}
            </button>
          ))}
        </div>
      )}
      <div className="w-full bg-purple-950/50 border border-purple-800/50 rounded-xl p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-2xl mt-4 animated-panel">
          <h3 className="text-lg font-semibold text-purple-200">Crop Image</h3>
          <p className="text-sm text-purple-200/60 -mt-2">Click and drag on the image to select a crop area.</p>
          
          <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-purple-200/80">Aspect Ratio:</span>
              {aspects.map(({ name, value }) => (
              <button
                  key={name}
                  onClick={() => handleAspectChange(name, value)}
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-md text-base font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                  activeAspect === name 
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20' 
                  : 'bg-purple-900/40 hover:bg-purple-800/60 text-purple-200'
                  }`}
              >
                  {name}
              </button>
              ))}
          </div>

          <button
              onClick={onApplyCrop}
              disabled={isLoading || !isCropping}
              className="gradient-button w-full max-w-xs mt-2 bg-gradient-to-br from-pink-500 to-rose-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-rose-500/20 hover:shadow-xl hover:shadow-rose-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-purple-800/50 disabled:to-purple-700/50 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
          >
              Apply Crop
          </button>
      </div>
    </>
  );
};

export default CropPanel;