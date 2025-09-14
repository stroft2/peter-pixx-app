/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import {
  generateEditedImage,
  generateFilteredImage,
  generateImageFromPrompt,
  generateVideoFromPrompt,
  checkVideoOperationStatus,
  removeBackgroundImage,
  upscaleImage,
  balanceImageColors,
  enhancePrompt,
  analyzeVideoFrame,
  generateImage, // ✅ from your snippet
  generateText   // ✅ from your snippet
} from './services/geminiService';

import Header from './components/Header.tsx';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import {
  UndoIcon,
  RedoIcon,
  EyeIcon,
  SparklesIcon,
  MagicWandIcon,
  GenerateImageIcon,
  GenerateVideoIcon,
  PlayIcon,
  PauseIcon,
  VolumeHighIcon,
  VolumeMuteIcon,
  FullscreenIcon,
  ExitFullscreenIcon,
  AnalyzeFrameIcon,
} from './components/icons';
import StartScreen from './components/StartScreen';

// --- IndexedDB Service ---
const DB_NAME = 'PeterPixxDB';
const STORE_NAME = 'missionResults';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveResult = async (id: string, result: Blob | string[]) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ id, result });
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getResult = async (id: string): Promise<Blob | string[] | undefined> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).get(id);
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result?.result);
    request.onerror = () => resolve(undefined);
  });
};

// ❌ Removed unused deleteResult
// const deleteResult = async (id: string) => { ... }
// ✅ Replace with placeholder since not used
const _deleteResult = null;

// --- Fix function signatures from your snippet ---
const applyFilter = async (originalImage: File, filterPrompt?: string): Promise<string> => {
  if (!filterPrompt) throw new Error("Filter prompt is required");
  return await generateImage(filterPrompt).then(imgs => imgs[0] || "");
};

const applyColor = async (originalImage: File, colorPrompt?: string): Promise<string> => {
  if (!colorPrompt) throw new Error("Color prompt is required");
  return await generateImage(colorPrompt).then(imgs => imgs[0] || "");
};

export default function App() {
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <Header />
      {loading && <Spinner />}
      <h1 className="text-xl font-bold">Peter Pixx App</h1>
      {/* Your UI continues here... */}
    </div>
  );
}



// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

// Types
type Tab = 'retouch' | 'crop' | 'adjust' | 'filters';
type View = 'start' | 'editor' | 'image-gen' | 'video-gen';
export type MissionType = 'image-gen' | 'video-gen';

export interface Mission {
  id: string;
  type: MissionType;
  prompt: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progressMessage?: string;
  result?: boolean; // True if result is stored in DB
  error?: string;
  createdAt: number;
  operation?: any;
}

// Mission Management (localStorage)
const MISSIONS_STORAGE_KEY = 'peter-pixx-missions';
const getMissionsFromStorage = (): Mission[] => {
    try {
        const missions = localStorage.getItem(MISSIONS_STORAGE_KEY);
        return missions ? JSON.parse(missions) : [];
    } catch (error) {
        console.error("Failed to parse missions from localStorage", error);
        return [];
    }
};
const saveMissionsToStorage = (missions: Mission[]) => {
    try {
        localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(missions));
    } catch (error) {
        console.error("Failed to save missions to localStorage", error);
    }
};

const CustomVideoPlayer: React.FC<{ src: string }> = ({ src }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isInactive, setIsInactive] = useState(false);
    const inactivityTimer = useRef<number | null>(null);
    const [thumbnailPos, setThumbnailPos] = useState(0);
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);

    const handleAnalyzeFrame = async () => {
        if (!videoRef.current) return;
        setIsAnalyzing(true);
        setAnalysisResult(null);
        videoRef.current.pause();
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64Data = dataUrl.split(',')[1];
        try {
            const result = await analyzeVideoFrame(base64Data);
            setAnalysisResult(result);
        } catch (error) {
            setAnalysisResult("Sorry, I couldn't analyze this frame.");
            console.error(error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const togglePlay = () => videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause();
    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!videoRef.current) return;
        const { left, width } = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - left;
        videoRef.current.currentTime = (clickX / width) * duration;
    };
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) videoRef.current.volume = newVolume;
        setIsMuted(newVolume === 0);
    };
    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (videoRef.current) videoRef.current.muted = !isMuted;
    };
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullScreen(true);
        } else {
            document.exitFullscreen();
            setIsFullScreen(false);
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        const onLoadedMetadata = () => setDuration(video.duration);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
        };
    }, []);

    const resetInactivityTimer = useCallback(() => {
        setIsInactive(false);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = window.setTimeout(() => setIsInactive(true), 3000);
    }, []);

    useEffect(() => {
        resetInactivityTimer();
        const container = containerRef.current;
        container?.addEventListener('mousemove', resetInactivityTimer);
        return () => container?.removeEventListener('mousemove', resetInactivityTimer);
    }, [resetInactivityTimer]);

    const handleSeekbarHover = (e: React.MouseEvent<HTMLDivElement>) => {
        const { left, width } = e.currentTarget.getBoundingClientRect();
        const hoverX = e.clientX - left;
        const time = (hoverX / width) * duration;
        setThumbnailPos(hoverX);

        if (videoRef.current && thumbnailCanvasRef.current) {
            const tempVideo = document.createElement('video');
            tempVideo.src = src;
            tempVideo.currentTime = time;
            tempVideo.onseeked = () => {
                const ctx = thumbnailCanvasRef.current?.getContext('2d');
                ctx?.drawImage(tempVideo, 0, 0, 160, 90);
            };
        }
    };
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                e.preventDefault();
                togglePlay();
            }
            if (e.code === "ArrowRight" && videoRef.current) {
                videoRef.current.currentTime += 5;
            }
            if (e.code === "ArrowLeft" && videoRef.current) {
                videoRef.current.currentTime -= 5;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div ref={containerRef} className={`video-container ${isInactive ? 'inactive' : ''}`}>
            <video ref={videoRef} src={src} autoPlay loop muted={isMuted} onClick={togglePlay} className="w-full h-full" />
            <div className="controls-overlay">
                <div className="seek-bar-container" onClick={handleSeek} onMouseMove={handleSeekbarHover}>
                    <div className="seek-bar-track">
                        <div className="seek-bar-progress" style={{ width: `${(currentTime / duration) * 100}%` }} />
                    </div>
                    <div className="thumbnail-preview" style={{ left: `${thumbnailPos}px` }}>
                        <canvas ref={thumbnailCanvasRef} width="160" height="90"></canvas>
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-white">{isPlaying ? <PauseIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}</button>
                        <div className="volume-container">
                            <button onClick={toggleMute} className="text-white">{isMuted || volume === 0 ? <VolumeMuteIcon className="w-6 h-6"/> : <VolumeHighIcon className="w-6 h-6"/>}</button>
                            <div className="volume-slider">
                                <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="volume-range"/>
                            </div>
                        </div>
                        <span className="text-white text-sm font-mono">{new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date(duration * 1000).toISOString().substr(14, 5)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                       <button onClick={handleAnalyzeFrame} className="text-white flex items-center gap-2 text-sm bg-purple-500/20 px-3 py-1.5 rounded-md hover:bg-purple-500/40 transition-colors disabled:opacity-50" disabled={isAnalyzing}>
                           {isAnalyzing ? <Spinner /> : <AnalyzeFrameIcon className="w-5 h-5" />}
                           <span>Analyze Frame</span>
                       </button>
                       <button onClick={toggleFullScreen} className="text-white">{isFullScreen ? <ExitFullscreenIcon className="w-6 h-6" /> : <FullscreenIcon className="w-6 h-6"/>}</button>
                    </div>
                </div>
            </div>
            {analysisResult && (
                <div className="ai-analysis-panel animate-fade-in">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-purple-300">AI Frame Analysis</h4>
                        <button onClick={() => setAnalysisResult(null)} className="text-gray-400 hover:text-white">&times;</button>
                    </div>
                    <p>{analysisResult}</p>
                </div>
            )}
        </div>
    );
};

const PreviewModal: React.FC<{ mission: Mission, onClose: () => void }> = ({ mission, onClose }) => {
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [resultUrls, setResultUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const sliderRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        let active = true;
        const fetchAndSetResult = async () => {
            setIsLoading(true);
            const storedResult = await getResult(mission.id);
            if (!active || !storedResult) {
                setIsLoading(false);
                return;
            }

            if (mission.type === 'video-gen' && storedResult instanceof Blob) {
                setResultUrl(URL.createObjectURL(storedResult));
            } else if (mission.type === 'image-gen' && Array.isArray(storedResult)) {
                setResultUrls(storedResult.map(imgData => `data:image/png;base64,${imgData}`));
            }
            setIsLoading(false);
        };

        fetchAndSetResult();
        return () => { 
            active = false;
            if (resultUrl) URL.revokeObjectURL(resultUrl);
        };
    }, [mission]);

    const handleDownload = async () => {
        const storedResult = await getResult(mission.id);
        if (!storedResult) return;

        let url: string;
        let filename: string;

        if (storedResult instanceof Blob) {
            url = URL.createObjectURL(storedResult);
            filename = `peter-pixx-video-${mission.id}.mp4`;
        } else if (Array.isArray(storedResult)) {
            // For now, download the first image. A zip download would be a future improvement.
            url = `data:image/png;base64,${storedResult[0]}`;
            filename = `peter-pixx-image-${mission.id}-0.png`;
        } else {
            return;
        }

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (storedResult instanceof Blob) {
            URL.revokeObjectURL(url);
        }
    };
    
    const scroll = (direction: 'left' | 'right') => {
        if (sliderRef.current) {
            const scrollAmount = sliderRef.current.clientWidth;
            sliderRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <div className="preview-overlay" onClick={onClose}>
            <div className="preview-content" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                    {mission.type === 'image-gen' ? <GenerateImageIcon className="w-6 h-6 text-purple-400" /> : <GenerateVideoIcon className="w-6 h-6 text-purple-400" />}
                    Mission Result
                  </h3>
                  <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl font-bold">&times;</button>
                </div>
                <p className="text-sm text-purple-200/70 max-h-24 overflow-y-auto pr-2">{mission.prompt}</p>
                <div className="flex-grow flex items-center justify-center preview-media-container">
                    {isLoading ? <Spinner /> : (
                        <>
                            {mission.type === 'video-gen' && resultUrl && <CustomVideoPlayer src={resultUrl} />}
                            {mission.type === 'image-gen' && resultUrls.length > 0 && (
                                <div className="relative w-full h-full flex items-center justify-center">
                                    <div ref={sliderRef} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full h-full">
                                        {resultUrls.map((imgUrl, idx) => (
                                            <div key={idx} className="flex-shrink-0 w-full snap-center flex items-center justify-center">
                                                <img src={imgUrl} className="max-w-full max-h-[60vh] object-contain rounded-md" />
                                            </div>
                                        ))}
                                    </div>
                                    {resultUrls.length > 1 && (
                                        <>
                                            <button onClick={() => scroll('left')} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full text-white hover:bg-black/80 transition-opacity opacity-70 hover:opacity-100 z-10"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg></button>
                                            <button onClick={() => scroll('right')} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full text-white hover:bg-black/80 transition-opacity opacity-70 hover:opacity-100 z-10"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg></button>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <button onClick={handleDownload} className="w-full bg-gradient-to-br from-pink-500 to-rose-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-rose-500/20 hover:shadow-xl hover:shadow-rose-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base">Download</button>
            </div>
        </div>
    );
};


const ImageGenerationScreen: React.FC<{ onStartMission: (prompt: string) => void, initialPrompt?: string }> = ({ onStartMission, initialPrompt }) => {
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [activeStyle, setActiveStyle] = useState('Photorealistic');
    
    const randomPrompts = [
      "A majestic whale shark swimming through a cosmic nebula, digital art",
      "Synthwave-style illustration of a retro-futuristic car driving into a sunset",
      "An oil painting of a cozy, cluttered library in a treehouse during a thunderstorm",
      "A photorealistic close-up of a chameleon tasting a raspberry",
      "An anime-style scene of a ramen shop on a rainy night in Tokyo",
    ];

    const styles: {[key: string]: string} = {
      'Cinematic': "cinematic, dramatic lighting, movie still, wide angle, 8k",
      'Photorealistic': "photorealistic, sharp focus, high detail, 8k, professional photography",
      'Anime': "vibrant anime style, cel-shaded, detailed background, by Makoto Shinkai",
      'Digital Art': "digital painting, fantasy, intricate, sharp details, ArtStation HQ",
      'Low Poly': "low poly, isometric, vibrant colors, simple shapes, 3d render",
      'Pixel Art': "pixel art, 16-bit, retro gaming aesthetic, detailed sprites"
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        const fullPrompt = `${prompt}, ${styles[activeStyle]}`;
        onStartMission(fullPrompt);
        setTimeout(() => {
            setIsLoading(false);
            setPrompt('');
        }, 1000);
    };

    const handleSurpriseMe = () => {
        setPrompt(randomPrompts[Math.floor(Math.random() * randomPrompts.length)]);
    };

    const handleEnhancePrompt = async () => {
        if (!prompt.trim()) return;
        setIsEnhancing(true);
        try {
            const enhanced = await enhancePrompt(prompt);
            setPrompt(enhanced);
        } catch (error) {
            console.error("Failed to enhance prompt:", error);
        } finally {
            setIsEnhancing(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
            <h2 className="text-4xl font-bold tracking-tight">Generate Image with AI</h2>
            <p className="text-purple-200/70">Describe the image you want to create, pick a style, and let the AI work its magic.</p>
            
            <div className="w-full flex flex-wrap items-center justify-center gap-2 mb-4">
              {Object.keys(styles).map((name) => (
                <button key={name} onClick={() => setActiveStyle(name)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 active:scale-95 ${activeStyle === name ? 'bg-violet-600 text-white style-button-active' : 'bg-purple-900/40 hover:bg-purple-800/60 text-purple-200'}`}>
                  {name}
                </button>
              ))}
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-center gap-3">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., An astronaut riding a unicorn on the moon"
                    className="flex-grow bg-purple-950/50 border border-purple-800 text-gray-200 rounded-lg p-4 text-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoading || isEnhancing}
                />
                <button type="button" onClick={handleEnhancePrompt} title="Enhance prompt with AI" className="bg-purple-900/40 border border-purple-500/30 text-purple-200 font-semibold py-4 px-5 rounded-lg transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95 text-lg disabled:opacity-50 flex items-center justify-center" disabled={isLoading || isEnhancing || !prompt.trim()}>
                    {isEnhancing ? <Spinner /> : <MagicWandIcon className="w-6 h-6"/>}
                </button>
                <button type="button" onClick={handleSurpriseMe} title="Surprise me with a random prompt" className="bg-purple-900/40 border border-purple-500/30 text-purple-200 font-semibold py-4 px-5 rounded-lg transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95 text-lg disabled:opacity-50" disabled={isLoading || isEnhancing}><SparklesIcon className="w-6 h-6"/></button>
            </form>
             <button
                    onClick={handleGenerate}
                    className="w-full bg-gradient-to-br from-violet-600 to-purple-600 text-white font-bold py-4 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-purple-800/50 disabled:to-purple-700/50 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                    disabled={isLoading || isEnhancing || !prompt.trim()}
                >
                    {isLoading ? "Starting Mission..." : "Start Generation Mission"}
            </button>
            <p className="text-sm text-purple-300/50">Your generation will be processed in the background. Check the Missions panel for progress.</p>
        </div>
    );
};

const VideoGenerationScreen: React.FC<{ onStartMission: (prompt: string) => void, initialPrompt?: string }> = ({ onStartMission, initialPrompt }) => {
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [isLoading, setIsLoading] = useState(false);
    
    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        onStartMission(prompt);
        setTimeout(() => {
            setIsLoading(false);
            setPrompt('');
        }, 1000);
    };
    
    return (
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
            <h2 className="text-4xl font-bold tracking-tight">Generate Video with AI</h2>
            <p className="text-purple-200/70">Describe the video you want to create. From prompt to motion picture!</p>
            <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-center gap-3 bg-purple-950/50 border border-purple-800 rounded-lg p-2 backdrop-blur-xl">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A cinematic shot of a cyberpunk city in the rain"
                    className="flex-grow bg-transparent text-gray-200 p-2 text-lg focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="bg-purple-800/80 text-purple-100 font-bold py-3 px-6 text-base rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-black/20 hover:bg-purple-700/80 active:scale-95 disabled:bg-purple-800/40 disabled:shadow-none disabled:cursor-not-allowed"
                    disabled={isLoading || !prompt.trim()}
                >
                    {isLoading ? "Starting..." : "Start Mission"}
                </button>
            </form>
             <p className="text-sm text-purple-300/50">Video generation can take several minutes. Your task will run in the background.</p>
        </div>
    );
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('start');
  const [missionToEdit, setMissionToEdit] = useState<Mission | null>(null);
  const [previewMission, setPreviewMission] = useState<Mission | null>(null);

  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [missions, setMissions] = useState<Mission[]>([]);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  
  // --- Mission Management ---
  useEffect(() => {
      const loadedMissions = getMissionsFromStorage();
      const unfinishedMissions = loadedMissions.filter(m => m.status === 'in-progress' || m.status === 'pending');
      if (unfinishedMissions.length > 0) {
          const requeued = unfinishedMissions.map(m => ({ ...m, status: 'pending' as const }));
          const completed = loadedMissions.filter(m => m.status !== 'in-progress' && m.status !== 'pending');
          setMissions([...completed, ...requeued]);
      } else {
          setMissions(loadedMissions);
      }
  }, []);

  useEffect(() => {
      saveMissionsToStorage(missions);
  }, [missions]);
  
  const updateMission = (id: string, updates: Partial<Mission>) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };
  
  const processMission = useCallback(async (mission: Mission) => {
    updateMission(mission.id, { status: 'in-progress', progressMessage: 'Starting...' });

    try {
        if (mission.type === 'image-gen') {
            updateMission(mission.id, { progressMessage: 'Generating images...' });
            const images = await generateImageFromPrompt(mission.prompt);
            await saveResult(mission.id, images);
            updateMission(mission.id, { status: 'completed', result: true });
        } else if (mission.type === 'video-gen') {
            let operation = mission.operation;
            if (!operation) { 
                updateMission(mission.id, { progressMessage: 'Initializing video...' });
                operation = await generateVideoFromPrompt(mission.prompt);
                updateMission(mission.id, { operation });
            }

            const loadingMessages = [
              "Brewing cosmic coffee for the AI...",
              "Teaching pixels to dance...",
              "This can take a few minutes...",
              "Reticulating splines...",
              "Finalizing the motion picture..."
            ];
            let msgIndex = 0;

            while (!operation.done) {
                updateMission(mission.id, { progressMessage: loadingMessages[msgIndex % loadingMessages.length] });
                msgIndex++;
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await checkVideoOperationStatus(operation);
            }
            
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                const response = await fetch(`${downloadLink}&key=${import.meta.env.c}`);
                const blob = await response.blob();
                await saveResult(mission.id, blob);
                updateMission(mission.id, { status: 'completed', result: true, progressMessage: "Done!" });
            } else {
                throw new Error("Video generation finished, but no URL was returned.");
            }
        }
    } catch (err) {
        const error = err instanceof Error ? err.message : 'An unknown error occurred.';
        updateMission(mission.id, { status: 'failed', error });
    }
  }, []);

  useEffect(() => {
    const pendingMission = missions.find(m => m.status === 'pending');
    if (pendingMission) {
        processMission(pendingMission);
    }
  }, [missions, processMission]);

  const handleStartMission = (type: MissionType, prompt: string) => {
      const newMission: Mission = {
          id: `mission_${Date.now()}`,
          type,
          prompt,
          status: 'pending',
          createdAt: Date.now(),
      };
      setMissions(prev => [...prev, newMission]);
      setView('start');
  };

  const handleRegenerateMission = (mission: Mission) => {
      handleStartMission(mission.type, mission.prompt);
  };

  const handleEditMission = (mission: Mission) => {
      setMissionToEdit(mission);
      setView(mission.type);
  };
  
  useEffect(() => {
    if (view === 'start' || view === 'editor') {
        setMissionToEdit(null); // Clear mission to edit when navigating away
    }
  }, [view]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setView('editor');
  }, []);

  const handleAIGeneration = useCallback(async (
    generationFn: (file: File, prompt?: string) => Promise<string>,
    prompt?: string
  ) => {
    if (!currentImage) return;
    setIsLoading(true);
    setError(null);
    try {
        const resultImageUrl = await generationFn(currentImage, prompt);
        const newImageFile = dataURLtoFile(resultImageUrl, `ai-edit-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the effect. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleGenerate = useCallback(async () => {
    if (!currentImage || !prompt.trim() || !editHotspot) return;
    await handleAIGeneration((file) => generateEditedImage(file, prompt, editHotspot));
    setEditHotspot(null);
    setDisplayHotspot(null);
    setPrompt('');
  }, [currentImage, prompt, editHotspot, handleAIGeneration]);
  
  const handleApplyFilter = (filterPrompt: string) => handleAIGeneration(generateFilteredImage, filterPrompt);
  const handleRemoveBackground = () => handleAIGeneration(removeBackgroundImage);
  const handleUpscaleImage = () => handleAIGeneration(upscaleImage);
  const handleBalanceColors = (colorPrompt: string) => handleAIGeneration(balanceImageColors, colorPrompt);
  
  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) return;
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(image, completedCrop.x * scaleX, completedCrop.y * scaleY, completedCrop.width * scaleX, completedCrop.height * scaleY, 0, 0, completedCrop.width, completedCrop.height);
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);
  }, [completedCrop, addImageToHistory]);

  const handleUndo = useCallback(() => canUndo && setHistoryIndex(historyIndex - 1), [canUndo, historyIndex]);
  const handleRedo = useCallback(() => canRedo && setHistoryIndex(historyIndex + 1), [canRedo, historyIndex]);
  const handleReset = useCallback(() => history.length > 0 && setHistoryIndex(0), [history]);

  const handleBackToHome = useCallback(() => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
      setView('start');
  }, []);

  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `peter-pixx-edit.png`;
          link.click();
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);
  
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch') return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    setDisplayHotspot({ x: offsetX, y: offsetY });
    setEditHotspot({ x: Math.round(offsetX * (img.naturalWidth / img.clientWidth)), y: Math.round(offsetY * (img.naturalHeight / img.clientHeight)) });
  };

  const renderContent = () => {
    if (view === 'start') return <StartScreen missions={missions} onFileSelect={(files) => files && handleImageUpload(files[0])} onNavigate={setView} />;
    if (view === 'image-gen') return <ImageGenerationScreen onStartMission={(prompt) => handleStartMission('image-gen', prompt)} initialPrompt={missionToEdit?.prompt} />;
    if (view === 'video-gen') return <VideoGenerationScreen onStartMission={(prompt) => handleStartMission('video-gen', prompt)} initialPrompt={missionToEdit?.prompt} />;
      
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-900/20 border border-red-500/30 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">An Error Occurred</h2>
            <p className="text-md text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors">Try Again</button>
          </div>
        );
    }
    
    if (!currentImageUrl) {
        return <StartScreen missions={missions} onFileSelect={(files) => files && handleImageUpload(files[0])} onNavigate={setView} />;
    }

    const imageDisplay = (
      <div className="relative">
        {originalImageUrl && <img key={originalImageUrl} src={originalImageUrl} alt="Original" className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none" />}
        <img ref={imgRef} key={currentImageUrl} src={currentImageUrl} alt="Current" onClick={handleImageClick} className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-300 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' ? 'cursor-none' : ''}`} />
      </div>
    );
    
    const cropImageElement = (
      <img ref={imgRef} key={`crop-${currentImageUrl}`} src={currentImageUrl} alt="Crop this image" className="w-full h-auto object-contain max-h-[60vh] rounded-xl" />
    );

    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative w-full shadow-2xl rounded-xl overflow-hidden bg-black/40">
            {isLoading && (
                <div className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in backdrop-blur-sm">
                    <Spinner />
                    <p className="text-purple-200/80">The AI is working its magic...</p>
                </div>
            )}
            
            {activeTab === 'crop' ? (
              <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={aspect} className="max-h-[60vh] flex justify-center">
                {cropImageElement}
              </ReactCrop>
            ) : imageDisplay }

            {displayHotspot && !isLoading && activeTab === 'retouch' && (
                <div className="edit-hotspot-display" style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}/>
            )}
        </div>
        
        <div className="w-full bg-purple-950/50 border border-purple-800/50 rounded-xl p-2 flex items-center justify-around gap-2 backdrop-blur-2xl animated-panel">
            {(['retouch', 'crop', 'adjust', 'filters'] as Tab[]).map(tab => (
                 <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)} 
                    className={`relative w-full z-0 capitalize font-semibold py-3 px-5 rounded-lg transition-all duration-300 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${activeTab === tab ? 'text-white' : 'text-purple-200/70 hover:text-white hover:bg-white/5'}`}
                  >
                     {activeTab === tab && (
                        <span className="absolute inset-0 bg-gradient-to-br from-violet-600 to-purple-600 rounded-lg -z-10 shadow-lg shadow-purple-500/30"></span>
                     )}
                    {tab}
                </button>
            ))}
        </div>
        
        <div className="w-full">
            {activeTab === 'retouch' && (
                <div className="flex flex-col items-center gap-4">
                    <p className="text-md text-purple-200/70">{editHotspot ? 'Now, describe the change you want to make.' : 'First, click a point on the image to edit.'}</p>
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-center gap-3">
                        <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={editHotspot ? "e.g., 'remove the scar'" : "First click a point on the image"} className="flex-grow bg-purple-950/50 border border-purple-800 text-gray-200 rounded-lg p-4 text-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoading || !editHotspot} />
                        <button type="submit" className="bg-gradient-to-br from-violet-600 to-purple-600 text-white font-bold py-4 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-gray-700 disabled:to-gray-600 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none" disabled={isLoading || !prompt.trim() || !editHotspot}>
                            Generate
                        </button>
                    </form>
                </div>
            )}
            {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
            {activeTab === 'adjust' && <AdjustmentPanel onRemoveBackground={handleRemoveBackground} onUpscale={handleUpscaleImage} onBalanceColors={handleBalanceColors} isLoading={isLoading} />}
            {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 w-full">
            <button onClick={handleUndo} disabled={!canUndo} className="flex items-center justify-center text-center bg-purple-900/40 border border-purple-500/20 text-purple-200 font-semibold py-2 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Undo last action"><UndoIcon className="w-4 h-4 mr-2" />Undo</button>
            <button onClick={handleRedo} disabled={!canRedo} className="flex items-center justify-center text-center bg-purple-900/40 border border-purple-500/20 text-purple-200 font-semibold py-2 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Redo last action"><RedoIcon className="w-4 h-4 mr-2" />Redo</button>
            {canUndo && <button onMouseDown={() => setIsComparing(true)} onMouseUp={() => setIsComparing(false)} onMouseLeave={() => setIsComparing(false)} onTouchStart={() => setIsComparing(true)} onTouchEnd={() => setIsComparing(false)} className="flex items-center justify-center text-center bg-purple-900/40 border border-purple-500/20 text-purple-200 font-semibold py-2 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95 text-sm" aria-label="Press and hold to see original image"><EyeIcon className="w-4 h-4 mr-2" />Compare</button>}
            <button onClick={handleReset} disabled={!canUndo} className="text-center bg-purple-900/40 border border-purple-500/20 text-purple-200 font-semibold py-2 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-800/60 active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed">Reset</button>
            <div className="flex-grow"></div>
            <button onClick={handleBackToHome} className="text-center bg-purple-900/60 border border-purple-500/30 text-purple-100 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-800/80 active:scale-95 text-base">Upload New</button>
            <button onClick={handleDownload} className="bg-gradient-to-br from-pink-500 to-rose-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-rose-500/20 hover:shadow-xl hover:shadow-rose-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base">Download Image</button>
        </div>
      </div>
    );
  };
  
  return (
    <div className={`min-h-screen text-gray-100 flex flex-col ${activeTab === 'retouch' && view === 'editor' ? 'hide-cursor' : ''}`}>
      <div className="custom-cursor">
        <div className="glow" style={{ left: `${cursorPos.x}px`, top: `${cursorPos.y}px` }} />
        <div className="dot" style={{ left: `${cursorPos.x}px`, top: `${cursorPos.y}px` }} />
      </div>
      {previewMission && <PreviewModal mission={previewMission} onClose={() => setPreviewMission(null)} />}
      <Header 
        currentView={view} 
        onBackToHome={handleBackToHome} 
        missions={missions} 
        setMissions={setMissions} 
        onRegenerateMission={handleRegenerateMission}
        onEditMission={handleEditMission}
        onSetPreview={setPreviewMission}
      />
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center ${view === 'start' || view === 'image-gen' || view === 'video-gen' ? 'items-center' : 'items-start'}`}>
        {renderContent()}
      </main>
       {view === 'editor' && (
         <footer className="text-center p-4 text-purple-300/40 text-sm">
           PP (made with love from egypt)
         </footer>
       )}
    </div>
  );
};

export default App;