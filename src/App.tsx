import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Image as ImageIcon, Sparkles, Camera, Loader2 } from 'lucide-react';
import { cn } from './lib/utils';

type Engine = 'realistic' | 'aesthetics';

interface FazionAppProps {}

export default function FazionApp({}: FazionAppProps) {
  const [engine, setEngine] = useState<Engine>('realistic');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file: File) => file.type.startsWith('image/'));
    if (droppedFiles.length > 0) {
      setImages(prev => {
        const newImages = [...prev, ...droppedFiles].slice(0, 3);
        return newImages;
      });
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((file: File) => file.type.startsWith('image/'));
      setImages(prev => {
        const newImages = [...prev, ...selectedFiles].slice(0, 3);
        return newImages;
      });
    }
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResultImage(null);

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('engine', engine);
      
      images.forEach(img => {
        formData.append('images', img);
      });

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      setResultImage(data.imageUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white/20 flex flex-col relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 w-full max-w-5xl mx-auto">
        
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12 mt-12"
        >
          <h1 className="text-5xl md:text-7xl font-medium tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            Welcome to best image generator on the planet
          </h1>
          <p className="text-white/40 text-lg md:text-xl font-light tracking-wide">
            Powered by Gemini 3.1 Flash. Choose your engine.
          </p>
        </motion.div>

        {/* Glass Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/50"
        >
          
          {/* Engine Toggle */}
          <div className="flex p-1 bg-black/40 rounded-2xl mb-8 w-full max-w-md mx-auto relative border border-white/[0.05]">
            <div 
              className="absolute inset-y-1 w-[calc(50%-4px)] bg-white/10 rounded-xl transition-all duration-500 ease-out shadow-sm"
              style={{ left: engine === 'realistic' ? '4px' : 'calc(50%)' }}
            />
            <button
              onClick={() => setEngine('realistic')}
              className={cn(
                "flex-1 py-3 text-sm font-medium rounded-xl transition-colors relative z-10 flex items-center justify-center gap-2",
                engine === 'realistic' ? "text-white" : "text-white/50 hover:text-white/80"
              )}
            >
              <Camera className="w-4 h-4" />
              Faizon Realistic
            </button>
            <button
              onClick={() => setEngine('aesthetics')}
              className={cn(
                "flex-1 py-3 text-sm font-medium rounded-xl transition-colors relative z-10 flex items-center justify-center gap-2",
                engine === 'aesthetics' ? "text-white" : "text-white/50 hover:text-white/80"
              )}
            >
              <Sparkles className="w-4 h-4" />
              Faizon Aesthetics
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Column */}
            <div className="flex flex-col gap-6">
              
              {/* Text Prompt */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-white/50 ml-1">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your vision..."
                  className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent resize-none h-32 transition-all"
                />
              </div>

              {/* Image Dropzone */}
              <div className="space-y-2">
                <div className="flex justify-between items-end ml-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-white/50">Reference Images</label>
                  <span className="text-xs text-white/30">{images.length}/3</span>
                </div>
                
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => images.length < 3 && fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 text-center",
                    images.length < 3 
                      ? "border-white/10 hover:border-white/30 hover:bg-white/[0.02] cursor-pointer" 
                      : "border-white/5 bg-black/20 opacity-50 cursor-not-allowed"
                  )}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                  />
                  <Upload className="w-6 h-6 text-white/40" />
                  <div>
                    <p className="text-sm text-white/70 font-medium">Click or drag images here</p>
                    <p className="text-xs text-white/40 mt-1">Up to 3 images for multimodal edits</p>
                  </div>
                </div>

                {/* Image Previews */}
                {images.length > 0 && (
                  <div className="flex gap-3 mt-4">
                    <AnimatePresence>
                      {images.map((img, idx) => (
                        <motion.div
                          key={`${img.name}-${idx}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 group"
                        >
                          <img 
                            src={URL.createObjectURL(img)} 
                            alt="preview" 
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                            className="absolute top-1 right-1 bg-black/60 backdrop-blur-md p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full bg-white text-black font-medium py-4 rounded-2xl hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Masterpiece
                  </>
                )}
              </button>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Output Column */}
            <div className="flex flex-col h-full min-h-[400px]">
              <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl overflow-hidden relative flex items-center justify-center">
                {isGenerating ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 border-t-2 border-white/20 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
                      <div className="absolute inset-2 border-r-2 border-white/40 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
                      <div className="absolute inset-4 border-b-2 border-white/80 rounded-full animate-spin" style={{ animationDuration: '1s' }} />
                      <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-white animate-pulse" />
                    </div>
                    <p className="mt-6 text-white/60 text-sm font-medium tracking-widest uppercase animate-pulse">
                      Synthesizing Pixels...
                    </p>
                  </div>
                ) : resultImage ? (
                  <motion.img
                    initial={{ opacity: 0, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.8 }}
                    src={resultImage}
                    alt="Generated artwork"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-white/20">
                    <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-sm font-medium">Your creation will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center relative z-10">
        <div className="flex flex-col items-center justify-center gap-1">
          <p className="text-xs font-semibold tracking-widest text-white/40 uppercase">Built by TEKDEV</p>
          <p className="text-xs text-white/30">© Fazion</p>
        </div>
      </footer>
    </div>
  );
}
