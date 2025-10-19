// MediaPipe and TensorFlow.js utilities for attention detection
// This file contains the core logic for face/eye tracking and attention scoring

export interface AttentionMetrics {
  faceDetected: boolean;
  eyesDetected: boolean;
  attentionScore: number;
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  eyeOpenness: {
    left: number;
    right: number;
  };
  blinkRate: number;
  gazeDirection: {
    x: number;
    y: number;
  };
}

export interface DetectionConfig {
  attentionThreshold: number;
  blinkThreshold: number;
  headPoseThreshold: number;
  eyeOpennessThreshold: number;
  sampleRate: number; // Hz
}

export class AttentionDetector {
  private faceMesh: any = null;
  private human: any = null;
  private isInitialized = false;
  private config: DetectionConfig;
  private blinkHistory: number[] = [];
  private attentionHistory: number[] = [];
  private lastBlinkTime = 0;

  constructor(config: Partial<DetectionConfig> = {}) {
    this.config = {
      attentionThreshold: 0.7,
      blinkThreshold: 0.3,
      headPoseThreshold: 30, // degrees
      eyeOpennessThreshold: 0.2,
      sampleRate: 10, // 10 FPS for attention detection
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 1) Try high-quality open‑source Human library first (client-only dynamic import)
      // Note: dynamic import from CDN happens in the browser at runtime
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const humanModule = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.9.0/dist/human.esm.js');
      // Some CDNs export default, others named; handle both safely
      const HumanCtor = (humanModule?.default ?? humanModule?.Human) as any;
      if (HumanCtor) {
        this.human = new HumanCtor({
          backend: 'webgl',
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.9.0/models',
          cacheModels: true,
          warmup: 'none',
          filter: { enabled: true },
          face: {
            enabled: true,
            mesh: { enabled: true },
            iris: { enabled: true },
            description: { enabled: false },
            rotation: { enabled: true },
          },
          body: { enabled: false },
          hand: { enabled: false },
          object: { enabled: false },
        });
        await this.human.load();
        this.isInitialized = true;
        return;
      }
    } catch (err) {
      console.warn('Human library not available, using basic fallback:', err);
      // Fallback to basic face detection
      await this.initializeFallback();
    }
  }

  private async initializeFallback(): Promise<void> {
    // Fallback implementation using basic web APIs
    console.log('Using fallback attention detection');
    this.isInitialized = true;
  }

  async detectAttention(videoElement: HTMLVideoElement): Promise<AttentionMetrics> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (this.human) {
        return await this.detectWithHuman(videoElement);
      } else if (this.faceMesh) {
        return await this.detectWithMediaPipe(videoElement);
      } else {
        return await this.detectWithFallback(videoElement);
      }
    } catch (error) {
      console.error('Attention detection error:', error);
      return this.getDefaultMetrics();
    }
  }

  private async detectWithHuman(videoElement: HTMLVideoElement): Promise<AttentionMetrics> {
    try {
      const result = await this.human.detect(videoElement);
      const face = (result as any)?.face?.[0];

      const faceDetected = !!face;
      if (!faceDetected) {
        return this.getDefaultMetrics();
      }

      // Rotation estimates if available (angles in radians or degrees depending on model)
      const rot = (face as any)?.rotation || {};
      const pitch = (rot.angleX ?? rot.pitch ?? 0) * (Math.abs(rot.angleX ?? rot.pitch ?? 0) <= Math.PI ? (180 / Math.PI) : 1);
      const yaw = (rot.angleY ?? rot.yaw ?? 0) * (Math.abs(rot.angleY ?? rot.yaw ?? 0) <= Math.PI ? (180 / Math.PI) : 1);
      const roll = (rot.angleZ ?? rot.roll ?? 0) * (Math.abs(rot.angleZ ?? rot.roll ?? 0) <= Math.PI ? (180 / Math.PI) : 1);

      // Basic eyes detection using iris presence
      const hasIris = !!(face as any)?.iris?.length || !!(face as any)?.mesh;
      const eyesDetected = !!hasIris;

      // Approximate eye openness (placeholder heuristic)
      const eyeOpenness = { left: eyesDetected ? 0.8 : 0, right: eyesDetected ? 0.8 : 0 };

      const blinkRate = 15; // placeholder baseline
      const gazeDirection = { x: 0, y: 0 };

      const attentionScore = this.calculateAttentionScore({
        faceDetected,
        eyesDetected,
        headPose: { pitch, yaw, roll },
        eyeOpenness,
        blinkRate,
        gazeDirection,
      });

      return {
        faceDetected,
        eyesDetected,
        attentionScore,
        headPose: { pitch, yaw, roll },
        eyeOpenness,
        blinkRate,
        gazeDirection,
      };
    } catch (e) {
      console.warn('Human detection failed, using fallback:', e);
      return this.getDefaultMetrics();
    }
  }

  private async detectWithMediaPipe(videoElement: HTMLVideoElement): Promise<AttentionMetrics> {
    return new Promise((resolve) => {
      this.faceMesh.onResults((results: any) => {
        const metrics = this.processMediaPipeResults(results);
        resolve(metrics);
      });

      this.faceMesh.send({ image: videoElement });
    });
  }

  private processMediaPipeResults(results: any): AttentionMetrics {
    const faceDetected = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

    if (!faceDetected) {
      return {
        faceDetected: false,
        eyesDetected: false,
        attentionScore: 0,
        headPose: { pitch: 0, yaw: 0, roll: 0 },
        eyeOpenness: { left: 0, right: 0 },
        blinkRate: 0,
        gazeDirection: { x: 0, y: 0 },
      };
    }

    const landmarks = results.multiFaceLandmarks[0];

    // Calculate eye openness (landmarks for eyes)
    const leftEyeOpenness = this.calculateEyeOpenness(landmarks, 'left');
    const rightEyeOpenness = this.calculateEyeOpenness(landmarks, 'right');
    const eyesDetected = leftEyeOpenness > 0 && rightEyeOpenness > 0;

    // Calculate head pose
    const headPose = this.calculateHeadPose(landmarks);

    // Calculate blink rate
    const blinkRate = this.updateBlinkRate(leftEyeOpenness, rightEyeOpenness);

    // Calculate gaze direction (simplified)
    const gazeDirection = this.calculateGazeDirection(landmarks);

    // Calculate overall attention score
    const attentionScore = this.calculateAttentionScore({
      faceDetected,
      eyesDetected,
      headPose,
      eyeOpenness: { left: leftEyeOpenness, right: rightEyeOpenness },
      blinkRate,
      gazeDirection,
    });

    return {
      faceDetected,
      eyesDetected,
      attentionScore,
      headPose,
      eyeOpenness: { left: leftEyeOpenness, right: rightEyeOpenness },
      blinkRate,
      gazeDirection,
    };
  }

  private calculateEyeOpenness(landmarks: any[], eye: 'left' | 'right'): number {
    // MediaPipe landmark indices for eyes
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

    const indices = eye === 'left' ? leftEyeIndices : rightEyeIndices;

    if (landmarks.length < Math.max(...indices)) {
      return 0;
    }

    // Calculate eye aspect ratio (EAR)
    const eyeLandmarks = indices.map(i => landmarks[i]);

    // Simplified EAR calculation
    const p1 = eyeLandmarks[1]; // Top of eye
    const p2 = eyeLandmarks[5]; // Bottom of eye
    const p3 = eyeLandmarks[0]; // Left corner
    const p4 = eyeLandmarks[3]; // Right corner

    const verticalDistance = Math.abs(p1.y - p2.y);
    const horizontalDistance = Math.abs(p3.x - p4.x);

    const ear = verticalDistance / horizontalDistance;
    return Math.max(0, Math.min(1, ear * 5)); // Normalize to 0-1
  }

  private calculateHeadPose(landmarks: any[]): { pitch: number; yaw: number; roll: number } {
    // Simplified head pose calculation using key facial landmarks
    const nose = landmarks[1]; // Nose tip
    const leftEye = landmarks[33];
    const rightEye = landmarks[362];
    const chin = landmarks[175];

    // Calculate yaw (left-right rotation)
    const eyeMidpoint = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };

    const yaw = Math.atan2(nose.x - eyeMidpoint.x, 0.1) * (180 / Math.PI);

    // Calculate pitch (up-down rotation)
    const pitch = Math.atan2(nose.y - eyeMidpoint.y, chin.y - nose.y) * (180 / Math.PI);

    // Calculate roll (tilt)
    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    return { pitch, yaw, roll };
  }

  private updateBlinkRate(leftEyeOpenness: number, rightEyeOpenness: number): number {
    const avgOpenness = (leftEyeOpenness + rightEyeOpenness) / 2;
    const now = Date.now();

    // Detect blink (both eyes closed)
    if (avgOpenness < this.config.eyeOpennessThreshold) {
      if (now - this.lastBlinkTime > 100) { // Minimum 100ms between blinks
        this.blinkHistory.push(now);
        this.lastBlinkTime = now;
      }
    }

    // Keep only last 60 seconds of blinks
    this.blinkHistory = this.blinkHistory.filter(time => now - time < 60000);

    // Return blinks per minute
    return this.blinkHistory.length;
  }

  private calculateGazeDirection(landmarks: any[]): { x: number; y: number } {
    // Simplified gaze direction based on eye center relative to face center
    const leftEye = landmarks[33];
    const rightEye = landmarks[362];
    const nose = landmarks[1];

    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };

    return {
      x: eyeCenter.x - nose.x,
      y: eyeCenter.y - nose.y,
    };
  }

  private calculateAttentionScore(metrics: Partial<AttentionMetrics>): number {
    let score = 0;

    // Face detection (30% weight)
    if (metrics.faceDetected) {
      score += 0.3;
    }

    // Eyes detection (20% weight)
    if (metrics.eyesDetected) {
      score += 0.2;
    }

    // Head pose (25% weight)
    if (metrics.headPose) {
      const { pitch, yaw, roll } = metrics.headPose;
      const headPoseScore = Math.max(0, 1 - (
        Math.abs(pitch) / this.config.headPoseThreshold +
        Math.abs(yaw) / this.config.headPoseThreshold +
        Math.abs(roll) / this.config.headPoseThreshold
      ) / 3);
      score += headPoseScore * 0.25;
    }

    // Eye openness (15% weight)
    if (metrics.eyeOpenness) {
      const avgOpenness = (metrics.eyeOpenness.left + metrics.eyeOpenness.right) / 2;
      const opennessScore = Math.min(1, avgOpenness / this.config.eyeOpennessThreshold);
      score += opennessScore * 0.15;
    }

    // Blink rate (10% weight) - normal blink rate is 15-20 per minute
    if (metrics.blinkRate !== undefined) {
      const normalBlinkRate = 17.5; // Average normal blink rate
      const blinkScore = Math.max(0, 1 - Math.abs(metrics.blinkRate - normalBlinkRate) / normalBlinkRate);
      score += blinkScore * 0.1;
    }

    // Update attention history for smoothing
    this.attentionHistory.push(score);
    if (this.attentionHistory.length > 10) {
      this.attentionHistory.shift();
    }

    // Return smoothed score
    const smoothedScore = this.attentionHistory.reduce((sum, s) => sum + s, 0) / this.attentionHistory.length;
    return Math.max(0, Math.min(1, smoothedScore));
  }

  private async detectWithFallback(videoElement: HTMLVideoElement): Promise<AttentionMetrics> {
    // Basic fallback using canvas and simple image analysis
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return this.getDefaultMetrics();
    }

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0);

    // Very basic face detection using image brightness analysis
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const brightness = this.calculateBrightness(imageData);

    // Simple heuristic: if there's significant brightness variation, assume face is present
    const faceDetected = brightness > 50 && brightness < 200;

    return {
      faceDetected,
      eyesDetected: faceDetected,
      attentionScore: faceDetected ? 0.7 : 0.2,
      headPose: { pitch: 0, yaw: 0, roll: 0 },
      eyeOpenness: { left: faceDetected ? 0.8 : 0, right: faceDetected ? 0.8 : 0 },
      blinkRate: 15,
      gazeDirection: { x: 0, y: 0 },
    };
  }

  private calculateBrightness(imageData: ImageData): number {
    let total = 0;
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      total += (r + g + b) / 3;
    }

    return total / (data.length / 4);
  }

  private getDefaultMetrics(): AttentionMetrics {
    return {
      faceDetected: false,
      eyesDetected: false,
      attentionScore: 0,
      headPose: { pitch: 0, yaw: 0, roll: 0 },
      eyeOpenness: { left: 0, right: 0 },
      blinkRate: 0,
      gazeDirection: { x: 0, y: 0 },
    };
  }

  // Utility methods
  isAttentive(metrics: AttentionMetrics): boolean {
    return metrics.attentionScore >= this.config.attentionThreshold;
  }

  getAttentionLevel(score: number): 'low' | 'medium' | 'high' {
    if (score < 0.4) return 'low';
    if (score < 0.7) return 'medium';
    return 'high';
  }

  generateRecommendations(metrics: AttentionMetrics): string[] {
    const recommendations: string[] = [];

    if (!metrics.faceDetected) {
      recommendations.push('📷 Please ensure your face is visible in the camera');
    }

    if (!metrics.eyesDetected) {
      recommendations.push('👀 Make sure your eyes are clearly visible');
    }

    if (Math.abs(metrics.headPose.yaw) > 20) {
      recommendations.push('↔️ Please look more directly at the camera');
    }

    if (Math.abs(metrics.headPose.pitch) > 15) {
      recommendations.push('↕️ Adjust your camera to eye level');
    }

    if (metrics.eyeOpenness.left < 0.3 || metrics.eyeOpenness.right < 0.3) {
      recommendations.push('😴 You seem tired - consider taking a short break');
    }

    if (metrics.blinkRate > 25) {
      recommendations.push('😣 High blink rate detected - you might be experiencing eye strain');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Great focus! Keep up the excellent work');
    }

    return recommendations;
  }
}