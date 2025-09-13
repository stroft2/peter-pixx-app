/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import type { Mission } from '../App';
import { MissionsIcon, GenerateImageIcon, GenerateVideoIcon, RedoIcon, EditIcon, EyeIcon } from './icons';
import Spinner from './Spinner';

const MissionItem: React.FC<{ 
    mission: Mission;
    isExpanded: boolean;
    onToggle: () => void;
    onRegenerate: (mission: Mission) => void;
    onEdit: (mission: Mission) => void;
    onSetPreview: (mission: Mission) => void;
}> = ({ mission, isExpanded, onToggle, onRegenerate, onEdit, onSetPreview }) => {
    
    const sliderRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (sliderRef.current) {
            const scrollAmount = sliderRef.current.clientWidth;
            sliderRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };
    
    return (
        <div className="border-b border-purple-500/10 last:border-b-0">
            <div className="p-3 cursor-pointer hover:bg-purple-500/5" onClick={onToggle}>
                <div className="flex items-start gap-3">
                    <div className="mt-1">
                        {mission.type === 'image-gen' ? <GenerateImageIcon className="w-5 h-5 text-purple-400" /> : <GenerateVideoIcon className="w-5 h-5 text-purple-400" />}
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <p className="text-sm font-semibold text-gray-200 truncate">{mission.prompt}</p>
                        <p className="text-xs text-purple-300/60 capitalize">{mission.status === 'in-progress' ? mission.progressMessage : mission.status}</p>
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                        {(mission.status === 'in-progress' || mission.status === 'pending') && <Spinner />}
                    </div>
                </div>
            </div>
             {isExpanded && (
                <div className="p-3 bg-black/20 animate-fade-in">
                    <p className="text-xs text-purple-300/80 mb-2 whitespace-pre-wrap break-words max-h-24 overflow-y-auto scrollbar-hide">{mission.prompt}</p>
                    
                    {mission.status === 'failed' && <p className="text-xs text-red-400 mt-1">{mission.error}</p>}
                    
                    <div className="flex items-center gap-2 mt-3">
                        {mission.status === 'completed' && mission.result && (
                            <button onClick={() => onSetPreview(mission)} className="flex items-center justify-center gap-1.5 w-full text-center text-xs bg-purple-600/40 border border-purple-400/30 text-purple-100 font-semibold py-1.5 px-3 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-600/60 active:scale-95"><EyeIcon className="w-3 h-3"/>View Result</button>
                        )}
                       <button onClick={() => onRegenerate(mission)} className="flex items-center justify-center gap-1.5 w-full text-center text-xs bg-purple-900/40 border border-purple-500/20 text-purple-200 font-semibold py-1.5 px-3 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95"><RedoIcon className="w-3 h-3"/>Regenerate</button>
                       <button onClick={() => onEdit(mission)} className="flex items-center justify-center gap-1.5 w-full text-center text-xs bg-purple-900/40 border border-purple-500/20 text-purple-200 font-semibold py-1.5 px-3 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95"><EditIcon className="w-3 h-3"/>Edit</button>
                    </div>
                </div>
             )}
        </div>
    );
};

interface HeaderProps {
  currentView: 'start' | 'editor' | 'image-gen' | 'video-gen';
  onBackToHome: () => void;
  missions: Mission[];
  setMissions: React.Dispatch<React.SetStateAction<Mission[]>>;
  onRegenerateMission: (mission: Mission) => void;
  onEditMission: (mission: Mission) => void;
  onSetPreview: (mission: Mission) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, onBackToHome, missions, setMissions, onRegenerateMission, onEditMission, onSetPreview }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeMissions = missions.filter(m => m.status === 'in-progress' || m.status === 'pending');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
            setIsPanelOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const handleToggleExpand = (missionId: string) => {
    setExpandedMissionId(prevId => prevId === missionId ? null : missionId);
  }

  const handleClearCompleted = () => {
    // This logic should be in App.tsx to handle IndexedDB
    setMissions(prev => prev.filter(m => m.status !== 'completed' && m.status !== 'failed'));
  };

  return (
    <header className="w-full py-3 px-4 sm:px-8 border-b border-purple-500/10 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between relative h-10">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {currentView !== 'start' && (
            <button onClick={onBackToHome} className="text-purple-200/80 hover:text-white transition-colors flex items-center gap-2 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              <span className="hidden sm:inline">Back to Home</span>
            </button>
          )}
        </div>
        
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
            <div className="header-logo font-bold text-xl">
                <span className="font-mono p-1 rounded-md text-purple-100">PP</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-100">Peter Pixx</h1>
        </div>

        <div className="absolute right-4 top-1/2 -translate-y-1/2" ref={panelRef}>
            <button onClick={() => setIsPanelOpen(o => !o)} className="relative p-2 rounded-full hover:bg-purple-500/10 transition-colors">
                <MissionsIcon className="w-6 h-6 text-purple-200" />
                {activeMissions.length > 0 && (
                    <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-purple-500 ring-2 ring-gray-950 animate-pulse" />
                )}
            </button>
            {isPanelOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-gray-950/80 backdrop-blur-xl border border-purple-500/20 rounded-lg shadow-2xl z-50 animate-fade-in">
                    <div className="p-3 flex justify-between items-center border-b border-purple-500/10 sticky top-0 bg-gray-950/80 backdrop-blur-xl">
                        <h3 className="font-bold text-gray-100">Missions</h3>
                        <button onClick={handleClearCompleted} className="text-xs text-purple-300/60 hover:text-white transition-colors">Clear Completed</button>
                    </div>
                    {missions.length === 0 ? (
                        <p className="p-4 text-center text-sm text-purple-300/40">No missions yet.</p>
                    ) : (
                        [...missions].reverse().map(mission => (
                            <MissionItem 
                                key={mission.id} 
                                mission={mission} 
                                isExpanded={expandedMissionId === mission.id}
                                onToggle={() => handleToggleExpand(mission.id)}
                                onRegenerate={onRegenerateMission}
                                onEdit={() => {
                                    onEditMission(mission);
                                    setIsPanelOpen(false);
                                }}
                                onSetPreview={(m) => {
                                    onSetPreview(m);
                                    setIsPanelOpen(false);
                                }}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;