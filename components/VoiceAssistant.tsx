
import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Zap, Volume2, X } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";

interface VoiceAssistantProps {
  onNavigate: (view: 'dashboard' | 'members' | 'rooms' | 'kitchen') => void;
  onRoomAction: (code: string, action: 'CHECKIN' | 'CHECKOUT' | 'CLEAN') => string; // Returns result string
  onGetStats: () => string; // New prop for getting detailed stats
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onNavigate, onRoomAction, onGetStats }) => {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
  const [volume, setVolume] = useState(0); // For visualization
  
  // Audio Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session Ref
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopSession();
    };
  }, []);

  // --- Logger Helper ---
  const logVoiceCommand = (toolName: string, args: any, result: string) => {
    try {
      const logEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        tool: toolName,
        args: args,
        result: result
      };
      
      const existingLogs = JSON.parse(localStorage.getItem('voice_command_logs') || '[]');
      // Keep last 50 logs
      const updatedLogs = [logEntry, ...existingLogs].slice(0, 50);
      localStorage.setItem('voice_command_logs', JSON.stringify(updatedLogs));
      console.log("[VoiceLog]", toolName, result);
    } catch (e) {
      console.error("Failed to log voice command", e);
    }
  };

  // --- Audio Helpers ---
  const createBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    
    return {
      data: b64,
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const decodeAudioData = async (base64: string, ctx: AudioContext) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  // --- Tool Definitions ---
  const tools: { functionDeclarations: FunctionDeclaration[] }[] = [{
    functionDeclarations: [
      {
        name: "navigate",
        description: "Switch the application view to a specific page.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            view: {
              type: Type.STRING,
              description: "The view to navigate to. Options: 'dashboard' (戰情室/首頁), 'rooms' (客房管理/房態), 'kitchen' (廚房/備餐), 'members' (會員/貴賓).",
              enum: ['dashboard', 'rooms', 'kitchen', 'members']
            }
          },
          required: ["view"]
        }
      },
      {
        name: "roomAction",
        description: "Perform an action on a specific room code. Supports checking out, cleaning, or checking in.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            roomCode: {
              type: Type.STRING,
              description: "The room code (e.g., '201', '尊1', '10', '水2')."
            },
            action: {
              type: Type.STRING,
              description: "The action to perform. 'CLEAN' (掃完了/設為空房), 'CHECKOUT' (退房), 'CHECKIN' (入住).",
              enum: ['CLEAN', 'CHECKOUT', 'CHECKIN']
            }
          },
          required: ["roomCode", "action"]
        }
      },
      {
        name: "getHotelStats",
        description: "Get current hotel statistics and detailed availability by room type.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        }
      }
    ]
  }];

  // --- Main Logic ---

  const startSession = async () => {
    try {
      setStatus('CONNECTING');
      setIsActive(true);

      // 1. Initialize Audio Contexts
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // 2. Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 3. Connect to Gemini Live
      let apiKey = '';
      try {
        if (typeof process !== 'undefined' && process.env) {
          apiKey = process.env.API_KEY || '';
        }
      } catch(e) { console.warn("API Key missing"); }

      aiRef.current = new GoogleGenAI({ apiKey });
      
      // Prompt Engineering for better room recognition and speed
      const SYSTEM_INSTRUCTION = `
      你是愛上喜翁豪華露營的「極速語音管家」。你的任務是快速執行操作，不要多話。

      **重要：房號對照表 (請嚴格遵守)**
      1. **尊爵帳 (VIP)**: 聽到「尊一」、「尊1」、「VIP 1」，參數 roomCode 一律為 "尊1"。聽到 "尊2"->"尊2", "尊3"->"尊3"。
      2. **水屋 (Water House)**: 聽到「水一」、「水1」，參數 roomCode 一律為 "水1"。聽到 "水2"->"水2", "水3"->"水3", "水4"->"水4"。
      3. **雙人帳 (Double)**: 聽到「雙人帳5號」、「5號」、「五號」，參數 roomCode 為 "5"。範圍 1~11。
      4. **皇宮帳 (Palace)**: 聽到「皇宮12」、「12號」，參數 roomCode 為 "12"。範圍 12~16。
      5. **檜木房 (Cypress)**: 聽到「201」、「二零一」，參數 roomCode 為 "201"。範圍 201~204。

      **操作規則**：
      1. **速度第一**：聽到指令後，優先呼叫 Tool。
      2. **簡短回應**：執行成功後，只需回覆「好的，尊1已退房」、「已設為空房」、「已切換」等，不要超過 10 個字。
      3. **模糊指令**：
         - 「尊一髒了」、「尊一退房」 -> 對 "尊1" 執行 CHECKOUT (退房/設為待清潔)。
         - 「尊一掃完了」、「尊一好了」 -> 對 "尊1" 執行 CLEAN (設為空房)。
         - 「201 客人來了」 -> 對 "201" 執行 CHECKIN。
      4. **狀態查詢**：
         - 「還有空房嗎？」、「水屋剩幾間？」-> 呼叫 getHotelStats。
         - 根據回傳的 JSON 回答重點數據即可。

      請使用繁體中文。
      `;

      sessionPromiseRef.current = aiRef.current.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: tools,
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setStatus('LISTENING');
            
            // Start Audio Stream
            if (!inputContextRef.current || !streamRef.current) return;
            
            sourceRef.current = inputContextRef.current.createMediaStreamSource(streamRef.current);
            processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Simple volume meter
              let sum = 0;
              for(let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(100, rms * 1000)); // Scale for UI

              const pcmBlob = createBlob(inputData);
              sessionPromiseRef.current?.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(inputContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputContextRef.current) {
              setStatus('SPEAKING');
              setIsSpeaking(true);
              const ctx = outputContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const buffer = await decodeAudioData(audioData, ctx);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              
              source.onended = () => {
                audioSourcesRef.current.delete(source);
                if (audioSourcesRef.current.size === 0) {
                  setIsSpeaking(false);
                  setStatus('LISTENING');
                }
              };
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
            }

            // Handle Tool Calls
            if (msg.toolCall) {
              setStatus('THINKING');
              for (const fc of msg.toolCall.functionCalls) {
                console.log("Tool Call:", fc.name, fc.args);
                let result = "OK";
                
                try {
                  if (fc.name === 'navigate') {
                    const view = (fc.args as any).view;
                    onNavigate(view);
                    result = `已切換至 ${view}`;
                  } else if (fc.name === 'roomAction') {
                    const { roomCode, action } = fc.args as any;
                    const res = onRoomAction(roomCode, action);
                    result = res;
                  } else if (fc.name === 'getHotelStats') {
                     // Use the new prop to get stats
                     result = onGetStats(); 
                  }
                } catch (e) {
                  result = "操作失敗";
                }

                // Log the command and result to localStorage
                logVoiceCommand(fc.name, fc.args, result);

                sessionPromiseRef.current?.then(session => {
                  session.sendToolResponse({
                    functionResponses: {
                      id: fc.id,
                      name: fc.name,
                      response: { result: result }
                    }
                  });
                });
              }
            }
          },
          onclose: () => {
            console.log("Connection Closed");
            stopSession();
          },
          onerror: (err) => {
            console.error("Gemini Error:", err);
            stopSession();
          }
        }
      });

    } catch (e) {
      console.error("Failed to start session:", e);
      stopSession();
    }
  };

  const stopSession = () => {
    setStatus('IDLE');
    setIsActive(false);
    setIsSpeaking(false);
    setVolume(0);

    // Stop Audio
    streamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    inputContextRef.current?.close();
    outputContextRef.current?.close();
    
    // Clear refs
    streamRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
    inputContextRef.current = null;
    outputContextRef.current = null;
    nextStartTimeRef.current = 0;
    
    // Close Session
    sessionPromiseRef.current?.then(s => s.close());
    sessionPromiseRef.current = null;
  };

  const toggleSession = () => {
    if (isActive) {
      stopSession();
    } else {
      startSession();
    }
  };

  // --- Render ---

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Status Bubble */}
      {isActive && (
        <div className="bg-glamping-900 text-white px-4 py-2 rounded-2xl shadow-xl border border-luxury-gold/50 flex items-center gap-3 animate-fade-in mb-2 min-w-[200px]">
           <div className="relative">
             <div className={`w-3 h-3 rounded-full ${status === 'SPEAKING' ? 'bg-luxury-gold' : 'bg-emerald-500'}`}></div>
             {status === 'LISTENING' && <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>}
           </div>
           
           <div className="flex-1">
             <div className="text-xs font-bold text-glamping-300 uppercase tracking-wider">
                {status === 'CONNECTING' && '連線中...'}
                {status === 'LISTENING' && '聆聽中...'}
                {status === 'THINKING' && '處理中...'}
                {status === 'SPEAKING' && '管家說話中'}
             </div>
             {/* Visualizer Bar */}
             {status === 'LISTENING' && (
                <div className="flex gap-0.5 mt-1 h-3 items-end">
                   {[...Array(5)].map((_, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-luxury-gold rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(20, Math.random() * volume)}%` }}
                      ></div>
                   ))}
                </div>
             )}
           </div>
           
           <button onClick={stopSession} className="text-glamping-400 hover:text-white">
              <X size={16} />
           </button>
        </div>
      )}

      {/* Main FAB */}
      <button 
        onClick={toggleSession}
        className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 relative group overflow-hidden ${
          isActive 
          ? 'bg-glamping-900 border-2 border-luxury-gold text-luxury-gold scale-110' 
          : 'bg-luxury-gold text-white hover:bg-yellow-600 hover:scale-105'
        }`}
      >
        {/* Pulse effect when inactive but hovering */}
        {!isActive && <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-0 group-hover:opacity-100 duration-1000"></div>}
        
        {isActive ? (
           status === 'SPEAKING' ? <Volume2 size={28} className="animate-pulse" /> : <Mic size={28} />
        ) : (
           <Mic size={28} />
        )}
      </button>
    </div>
  );
};

export default VoiceAssistant;
