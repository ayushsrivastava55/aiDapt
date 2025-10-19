// OpenAI Realtime API integration for voice interactions in study rooms
// This file contains utilities for voice-based AI assistance

export interface VoiceConfig {
  apiKey?: string;
  model: string;
  voice: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface VoiceSession {
  id: string;
  isActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  startTime: Date;
  participantId: string;
  roomId: string;
}

export interface VoiceInteraction {
  timestamp: Date;
  query: string;
  response: string;
  confidence: number;
  duration: number;
  metadata?: any;
}

export class VoiceAssistant {
  private config: VoiceConfig;
  private session: VoiceSession | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recognition: any = null; // SpeechRecognition
  private synthesis: SpeechSynthesis;
  private isInitialized = false;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private remoteAudioEl: HTMLAudioElement | null = null;
  private realtimeConnected = false;

  constructor(config: Partial<VoiceConfig> = {}) {
    this.config = {
      model: "gpt-4o-realtime-preview",
      voice: "alloy",
      temperature: 0.7,
      maxTokens: 150,
      systemPrompt: `You are an AI study assistant helping students in a focused learning environment.

      Guidelines:
      - Keep responses concise and educational (under 30 seconds)
      - Focus on academic topics and study techniques
      - Encourage focus and concentration
      - Provide quick explanations and clarifications
      - If asked about non-academic topics, gently redirect to studies
      - Be encouraging and supportive

      Current context: You are in an AI-monitored study room where attention tracking is active.`,
      ...config,
    };

    this.synthesis = window.speechSynthesis;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Web Speech API
      await this.initializeSpeechRecognition();
      await this.initializeSpeechSynthesis();

      this.isInitialized = true;
      console.log("Voice Assistant initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Voice Assistant:", error);
      throw error;
    }
  }

  private async initializeSpeechRecognition(): Promise<void> {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Speech recognition not supported in this browser");
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    // Set up event handlers
    this.recognition.onstart = () => {
      if (this.session) {
        this.session.isListening = true;
      }
      console.log("Voice recognition started");
    };

    this.recognition.onend = () => {
      if (this.session) {
        this.session.isListening = false;
      }
      console.log("Voice recognition ended");
    };

    this.recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (this.session) {
        this.session.isListening = false;
      }
    };

    this.recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;

      console.log("Recognized speech:", transcript, "Confidence:", confidence);

      if (confidence > 0.5) {
        await this.processQuery(transcript, confidence);
      } else {
        await this.speak("I didn't quite catch that. Could you please repeat your question?");
      }
    };
  }

  private async initializeSpeechSynthesis(): Promise<void> {
    // Wait for voices to load
    return new Promise((resolve) => {
      if (this.synthesis.getVoices().length > 0) {
        resolve();
      } else {
        this.synthesis.onvoiceschanged = () => {
          resolve();
        };
      }
    });
  }

  async startSession(roomId: string, participantId: string): Promise<VoiceSession> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.session?.isActive) {
      throw new Error("Voice session already active");
    }

    this.session = {
      id: crypto.randomUUID(),
      isActive: true,
      isListening: false,
      isSpeaking: false,
      startTime: new Date(),
      participantId,
      roomId,
    };

    console.log("Voice session started:", this.session.id);
    try {
      await this.initializeRealtime();
    } catch (e) {
      console.warn("Realtime init failed, falling back to Web Speech API only:", e);
    }
    await this.speak("Voice assistant activated. How can I help you with your studies?");

    return this.session;
  }

  async endSession(): Promise<void> {
    if (!this.session) return;

    this.stopListening();
    this.stopSpeaking();

    // Cleanup realtime connection
    try {
      if (this.dc) {
        this.dc.close();
        this.dc = null;
      }
      if (this.pc) {
        this.pc.getSenders().forEach((s) => s.track?.stop());
        this.pc.close();
        this.pc = null;
      }
      if (this.remoteAudioEl) {
        this.remoteAudioEl.srcObject = null;
        this.remoteAudioEl.remove();
        this.remoteAudioEl = null;
      }
      this.realtimeConnected = false;
    } catch (e) {
      console.warn("Error cleaning up realtime:", e);
    }

    this.session.isActive = false;
    this.session = null;

    console.log("Voice session ended");
  }

  async startListening(): Promise<void> {
    if (!this.session?.isActive || !this.recognition) {
      throw new Error("Voice session not active or recognition not available");
    }

    if (this.session.isListening) {
      console.log("Already listening");
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error("Failed to start listening:", error);
      throw error;
    }
  }

  stopListening(): void {
    if (this.recognition && this.session?.isListening) {
      this.recognition.stop();
    }
  }

  private async processQuery(query: string, confidence: number): Promise<void> {
    if (!this.session) return;

    try {
      this.session.isSpeaking = true;

      if (this.realtimeConnected && this.dc && this.dc.readyState === "open") {
        await this.sendRealtimeText(query);
        // We won't TTS here, audio will stream via remote track
        const interaction: VoiceInteraction = {
          timestamp: new Date(),
          query,
          response: "[voice]", // audio response streamed
          confidence,
          duration: 0,
        };
        await this.recordInteraction(interaction);
        return;
      }

      // Fallback to mock response + browser TTS
      const response = await this.generateResponse(query);

      const interaction: VoiceInteraction = {
        timestamp: new Date(),
        query,
        response,
        confidence,
        duration: 0,
      };

      // Record the interaction
      await this.recordInteraction(interaction);

      // Speak the response
      await this.speak(response);

    } catch (error) {
      console.error("Failed to process query:", error);
      await this.speak("I'm sorry, I encountered an error. Please try asking your question again.");
    } finally {
      if (this.session) {
        this.session.isSpeaking = false;
      }
    }
  }

  private async generateResponse(query: string): Promise<string> {
    // Mock response generation - replace with actual OpenAI Realtime API
    const responses = {
      // Study techniques
      "how to focus": "Try the Pomodoro Technique: 25 minutes of focused study followed by a 5-minute break. This helps maintain concentration and prevents mental fatigue.",

      "study tips": "Here are some effective study tips: eliminate distractions, take regular breaks, use active recall, teach concepts to others, and review material spaced over time.",

      "memory techniques": "Try mnemonic devices, visualization, the method of loci, or creating acronyms. Breaking information into smaller chunks also helps with retention.",

      // Subject-specific help
      "math": "For math problems, start by identifying what you know and what you need to find. Break complex problems into smaller steps and check your work.",

      "science": "In science, focus on understanding concepts rather than memorizing facts. Draw diagrams, make connections between ideas, and practice applying principles to new situations.",

      "writing": "For better writing, start with an outline, write a rough draft without editing, then revise for clarity and structure. Read your work aloud to catch errors.",

      // Motivation and focus
      "motivation": "Remember your goals and why you're studying. Set small, achievable targets and reward yourself when you reach them. You're making progress!",

      "tired": "If you're feeling tired, take a short 10-15 minute break, do some light stretching, drink water, or step outside for fresh air. Your brain needs rest to function well.",

      "stressed": "Take deep breaths and remind yourself that it's normal to feel challenged. Break your work into smaller tasks and tackle them one at a time.",
    };

    // Find the best matching response
    const queryLower = query.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
      if (queryLower.includes(key)) {
        return response;
      }
    }

    // Default responses for common question patterns
    if (queryLower.includes("what") || queryLower.includes("how") || queryLower.includes("why")) {
      return "That's a great question! While I can provide general study guidance, you might want to consult your textbook or ask your instructor for detailed subject-specific information.";
    }

    if (queryLower.includes("help")) {
      return "I'm here to help with your studies! You can ask me about study techniques, focus strategies, or general learning tips. What specific area would you like help with?";
    }

    // Encourage refocusing on studies
    return "I'm designed to help with study-related questions. Could you ask me something about your learning, study techniques, or academic work?";
  }

  private async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error("Speech synthesis not available"));
        return;
      }

      // Cancel any ongoing speech
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      // Configure voice
      const voices = this.synthesis.getVoices();
      const preferredVoice = voices.find(voice =>
        voice.name.toLowerCase().includes('alloy') ||
        voice.name.toLowerCase().includes('female') ||
        voice.lang.startsWith('en')
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      utterance.onstart = () => {
        if (this.session) {
          this.session.isSpeaking = true;
        }
      };

      utterance.onend = () => {
        if (this.session) {
          this.session.isSpeaking = false;
        }
        resolve();
      };

      utterance.onerror = (event) => {
        if (this.session) {
          this.session.isSpeaking = false;
        }
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      this.synthesis.speak(utterance);
    });
  }

  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    if (this.session) {
      this.session.isSpeaking = false;
    }
  }

  private async recordInteraction(interaction: VoiceInteraction): Promise<void> {
    if (!this.session) return;

    try {
      await fetch("/api/study-rooms?action=voice-interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: this.session.roomId,
          learnerId: this.session.participantId,
          query: interaction.query,
          response: interaction.response,
          duration: interaction.duration,
          confidence: interaction.confidence,
          metadata: interaction.metadata,
        }),
      });
    } catch (error) {
      console.error("Failed to record voice interaction:", error);
    }
  }

  // Utility methods
  getSession(): VoiceSession | null {
    return this.session;
  }

  isSessionActive(): boolean {
    return this.session?.isActive ?? false;
  }

  isCurrentlyListening(): boolean {
    return this.session?.isListening ?? false;
  }

  isCurrentlySpeaking(): boolean {
    return this.session?.isSpeaking ?? false;
  }

  private async initializeRealtime(): Promise<void> {
    // Get ephemeral token from our server
    const tokenRes = await fetch("/api/realtime/session");
    if (!tokenRes.ok) {
      throw new Error("Failed to create ephemeral Realtime session");
    }
    const tokenData = await tokenRes.json();
    const ephemeralKey = tokenData.client_secret;
    if (!ephemeralKey) throw new Error("No client_secret in ephemeral token response");

    // Create peer connection
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Data channel for events
    this.dc = this.pc.createDataChannel("oai-events");
    this.dc.onopen = () => {
      this.realtimeConnected = true;
    };
    this.dc.onclose = () => {
      this.realtimeConnected = false;
    };

    // Remote audio track
    this.pc.ontrack = (e) => {
      if (!this.remoteAudioEl) {
        this.remoteAudioEl = document.createElement("audio");
        this.remoteAudioEl.autoplay = true;
        this.remoteAudioEl.style.display = "none";
        document.body.appendChild(this.remoteAudioEl);
      }
      this.remoteAudioEl.srcObject = e.streams[0];
    };

    // Get microphone and add to connection
    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    ms.getTracks().forEach((t) => this.pc!.addTrack(t, ms));

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const sdpResponse = await fetch(
      `https://api.openai.com/v1/realtime?model=${encodeURIComponent(this.config.model)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
        body: offer.sdp || "",
      }
    );

    if (!sdpResponse.ok) {
      const errText = await sdpResponse.text();
      throw new Error(`Realtime SDP exchange failed: ${errText}`);
    }

    const answer = await sdpResponse.text();
    await this.pc.setRemoteDescription({ type: "answer", sdp: answer });
    this.realtimeConnected = true;
  }

  private async sendRealtimeText(text: string): Promise<void> {
    if (!this.realtimeConnected || !this.dc || this.dc.readyState !== "open") return;
    const event = {
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        input_text: text,
        instructions: text,
        voice: this.config.voice,
      },
    } as any;
    this.dc.send(JSON.stringify(event));
  }
}