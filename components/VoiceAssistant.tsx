import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, Blob } from "@google/genai";
import { Mic, MicOff, Loader, X, Sparkles } from 'lucide-react';

interface VoiceAssistantProps {
  onNavigate: (view: any) => void; // Deprecated but kept for signature compatibility
  onRoomAction: (code: string, action: 'CHECKIN' | 'CHECKOUT' | 'CLEAN') => string;
  onGetStats: () => string;
}

// --- Audio Helper Functions ---

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    let s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Tool Definitions ---

const roomActionTool: FunctionDeclaration = {
  name: 'roomAction',
  description: 'Perform an action on a specific room.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: {
        type: Type.STRING,
        description: 'The room code (e.g., "101", "205", "VIP1").'
      },
      action: {
        type: Type.STRING,
        description: 'The action to perform. Options: "CHECKIN", "CHECKOUT", "CLEAN".'
      }
    },
    required: ['code', 'action']
  }
};

const getStatsTool: FunctionDeclaration = {
  name: 'getStats',
  description: 'Get current hotel statistics including occupancy, dirty rooms, and inventory.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  }
};

// --- Component ---

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onRoomAction, onGetStats }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volume, setVolume] = useState(0);

  const propsRef = useRef({ onRoomAction, onGetStats });
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    propsRef.current = { onRoomAction, onGetStats };
  }, [onRoomAction, onGetStats]);

  const disconnect = () => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            try { session.close(); } catch(e) { console.error("Session close error", e); }
        });
        sessionPromiseRef.current = null;
    }

    if (inputProcessorRef.current) {
        inputProcessorRef.current.disconnect();
        inputProcessorRef.current = null;
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }

    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }

    setIsActive(false);
    setIsConnecting(false);
    setVolume(0);
  };

  const connect = async () => {
    try {
      setIsConnecting(true);
      
      // Correct initialization using process.env.API_KEY directly as per Google GenAI SDK guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are "翁翁", a professional hotel butler at "Ai Shang Xi Weng". You help manage room status. Speak in Traditional Chinese (Taiwan). Be concise.',
          tools: [{ functionDeclarations: [roomActionTool, getStatsTool] }],
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setIsConnecting(false);
            setIsActive(true);

            const source = inputCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            inputProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(100, Math.round(rms * 100 * 5))); 

              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
               try {
                   const audioBuffer = await decodeAudioData(
                     decode(base64Audio),
                     outputCtx,
                     24000,
                     1
                   );
                   
                   const source = outputCtx.createBufferSource();
                   source.buffer = audioBuffer;
                   source.connect(outputNode);
                   
                   const now = outputCtx.currentTime;
                   const startAt = Math.max(now, nextStartTimeRef.current);
                   source.start(startAt);
                   
                   nextStartTimeRef.current = startAt + audioBuffer.duration;
                   
                   sourcesRef.current.add(source);
                   source.onended = () => sourcesRef.current.delete(source);

               } catch (err) {
                   console.error("Audio decode error", err);
               }
            }

            if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = outputCtx.currentTime;
            }

            if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                    console.log("Tool Call:", fc.name, fc.args);
                    let result = "OK";
                    
                    try {
                        if (fc.name === 'roomAction') {
                            const code = (fc.args as any).code;
                            const action = (fc.args as any).action;
                            result = propsRef.current.onRoomAction(code, action);
                        } else if (fc.name === 'getStats') {
                            result = propsRef.current.onGetStats();
                        }
                    } catch (err) {
                        result = "執行失敗";
                        console.error(err);
                    }

                    sessionPromise.then(session => {
                        session.sendToolResponse({
                            functionResponses: {
                                id: fc.id,
                                name: fc.name,
                                response: { result: { result } } 
                            }
                        });
                    });
                }
            }
          },
          onclose: () => {
              console.log("Session Closed");
              disconnect();
          },
          onerror: (e) => {
              console.error("Session Error", e);
              disconnect();
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (error) {
      console.error("Connection Failed", error);
      setIsConnecting(false);
      setIsActive(false);
      alert("無法連接語音助理");
    }
  };

  const toggleVoice = () => {
    if (isActive || isConnecting) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {(isActive || isConnecting) && (
        <div className="bg-glamping-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-luxury-gold/30 animate-scale-in w-64">
           <div className="flex justify-between items-center mb-3">
              <h3 className="font-serif font-bold text-luxury-gold flex items-center gap-2">
                 <Sparkles size={16} /> AI 語音管家
              </h3>
              <button onClick={disconnect} className="hover:text-red-400 transition">
                 <X size={16} />
              </button>
           </div>
           
           <div className="flex flex-col items-center justify-center py-2 gap-3">
              {isConnecting ? (
                  <div className="flex flex-col items-center gap-2 text-glamping-300">
                      <Loader size={24} className="animate-spin text-luxury-gold" />
                      <span className="text-xs">連線中...</span>
                  </div>
              ) : (
                  <>
                    <div className="h-12 flex items-end gap-1 justify-center w-full">
                        {[...Array(5)].map((_, i) => (
                           <div 
                             key={i} 
                             className="w-2 bg-luxury-gold rounded-t-full transition-all duration-75"
                             style={{ 
                               height: `${Math.max(15, Math.random() * volume * (i % 2 === 0 ? 1.5 : 0.8) + 10)}%`,
                               opacity: 0.8 + (volume / 100) * 0.2
                             }}
                           ></div>
                        ))}
                    </div>
                    <p className="text-xs text-glamping-300 font-medium">
                       {volume > 10 ? "正在聆聽..." : "請說出指令..."}
                    </p>
                  </>
              )}
           </div>
           
           <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-glamping-400 text-center">
              支援: "201 入住"、"營運狀況"、"全部退房"
           </div>
        </div>
      )}

      <button 
        onClick={toggleVoice}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 ${
          isActive 
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
            : 'bg-luxury-gold hover:bg-yellow-600 text-white'
        }`}
      >
        {isActive ? <MicOff size={24} /> : <Mic size={24} />}
      </button>
    </div>
  );
};

export default VoiceAssistant;