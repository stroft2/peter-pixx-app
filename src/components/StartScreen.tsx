/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, GenerateImageIcon, GenerateVideoIcon, PreciseRetouchingIcon, CreativeFiltersIcon, AdjustmentsIcon } from './icons';
import type { Mission } from '../App';
import Spinner from './Spinner';

interface StartScreenProps {
  onFileSelect: (files: FileList | null) => void;
  onNavigate: (view: 'image-gen' | 'video-gen') => void;
  missions: Mission[];
}

const StartScreen: React.FC<StartScreenProps> = ({ onFileSelect, onNavigate, missions }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e.target.files);
  };
  
  const activeMissions = missions.filter(m => m.status === 'in-progress' || m.status === 'pending');

  return (
    <div 
      className={`w-full max-w-6xl mx-auto text-center p-8 transition-all duration-300 rounded-2xl border-2 ${isDraggingOver ? 'bg-purple-500/10 border-dashed border-purple-400' : 'border-transparent'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        onFileSelect(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-100 sm:text-6xl md:text-7xl leading-tight">
          Your Cosmic Playground for<br/> Media, <span className="bg-clip-text text-transparent bg-gradient-to-br from-purple-400 to-pink-400">Powered by AI.</span>
        </h1>
        <p className="max-w-3xl text-lg text-purple-200/70 md:text-xl">
          Edit photos, generate images, or create entire videos from scratch. Your creativity is the only limit. Let's make something awesome!
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <label htmlFor="image-upload-start" className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gradient-to-br from-violet-600 to-purple-600 rounded-lg cursor-pointer group transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner">
                <UploadIcon className="w-6 h-6 mr-3" />
                Upload Image
            </label>
            <input id="image-upload-start" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            
            <button onClick={() => onNavigate('image-gen')} className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-purple-900/40 border border-purple-500/20 rounded-lg cursor-pointer group hover:bg-purple-800/60 transition-colors">
                <GenerateImageIcon className="w-6 h-6 mr-3" />
                Generate Image
            </button>
            <button onClick={() => onNavigate('video-gen')} className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-purple-900/40 border border-purple-500/20 rounded-lg cursor-pointer group hover:bg-purple-800/60 transition-colors">
                <GenerateVideoIcon className="w-6 h-6 mr-3" />
                Generate Video
            </button>
        </div>
        <p className="text-sm text-purple-300/40">You can also drag and drop a file to upload</p>
        
        {activeMissions.length > 0 && (
            <div className="mt-12 w-full max-w-2xl bg-purple-950/50 p-4 rounded-lg border border-purple-800/50 backdrop-blur-2xl">
                <h3 className="text-lg font-bold text-purple-200 mb-3 text-center">Active Missions</h3>
                <div className="space-y-3">
                    {activeMissions.map(m => (
                        <div key={m.id} className="text-left flex items-center gap-4 p-3 bg-purple-900/20 rounded-lg">
                            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                <Spinner />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-semibold text-purple-200 truncate">{m.prompt}</p>
                                <p className="text-xs text-purple-300/60">{m.progressMessage || 'In progress...'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="mt-20 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-purple-950/40 p-6 rounded-lg border border-purple-800/40 flex flex-col items-center text-center animated-panel">
                    <div className="relative flex items-center justify-center w-12 h-12 bg-purple-900/50 rounded-lg mb-4">
                       <div className="absolute inset-0 bg-purple-400/30 blur-lg rounded-full"></div>
                       <PreciseRetouchingIcon className="w-7 h-7 text-purple-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Precise Retouching</h3>
                    <p className="mt-2 text-purple-200/70">Click any point on your image to remove blemishes, change colors, or add elements with pinpoint accuracy.</p>
                </div>
                <div className="bg-purple-950/40 p-6 rounded-lg border border-purple-800/40 flex flex-col items-center text-center animated-panel">
                    <div className="relative flex items-center justify-center w-12 h-12 bg-purple-900/50 rounded-lg mb-4">
                       <div className="absolute inset-0 bg-purple-400/30 blur-lg rounded-full"></div>
                       <CreativeFiltersIcon className="w-7 h-7 text-purple-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Creative Filters</h3>
                    <p className="mt-2 text-purple-200/70">Transform photos with artistic styles. From vintage looks to futuristic glows, find or create the perfect filter.</p>
                </div>
                <div className="bg-purple-950/40 p-6 rounded-lg border border-purple-800/40 flex flex-col items-center text-center animated-panel">
                    <div className="relative flex items-center justify-center w-12 h-12 bg-purple-900/50 rounded-lg mb-4">
                       <div className="absolute inset-0 bg-purple-400/30 blur-lg rounded-full"></div>
                       <AdjustmentsIcon className="w-7 h-7 text-purple-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Adjustments</h3>
                    <p className="mt-2 text-purple-200/70">Enhance lighting, remove backgrounds, or upscale your image. Get studio-quality results without complex tools.</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;