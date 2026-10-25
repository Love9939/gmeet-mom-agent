"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface MeetRecorderHook {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  recordedBlob: Blob | null;
  recordedAudioUrl: string | null;
  resetRecording: () => void;
}

export function useMeetRecorder(): MeetRecorderHook {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const cleanupAudioContext = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    streamsRef.current = [];

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Monitor audio levels for UI visualization
  const startAudioMeter = useCallback((analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const checkLevel = () => {
      if (!isRecording) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      // Normalize to 0-100 range with sensitivity curve
      const normalized = Math.min(100, Math.round((avg / 128) * 100));
      setAudioLevel(normalized);
      animFrameRef.current = requestAnimationFrame(checkLevel);
    };
    checkLevel();
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    setRecordedBlob(null);

    try {
      // 1. Capture Google Meet Tab Audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const tabAudioTracks = displayStream.getAudioTracks();
      if (tabAudioTracks.length === 0) {
        displayStream.getTracks().forEach((t) => t.stop());
        throw new Error(
          'No tab audio detected! Please make sure "Also share tab audio" is toggled ON when selecting your Google Meet tab.'
        );
      }

      // 2. Capture User\'s Local Microphone Audio
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (micErr) {
        console.warn("Microphone access not granted; recording Google Meet tab audio only.", micErr);
      }

      streamsRef.current = micStream ? [displayStream, micStream] : [displayStream];

      // 3. Mix Tab Audio + Mic Audio via Web Audio API
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      // Resume context if suspended by browser autoplay policy
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const destination = audioContext.createMediaStreamDestination();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      // Connect tab audio to destination and analyser
      const tabSource = audioContext.createMediaStreamSource(
        new MediaStream([tabAudioTracks[0]])
      );
      tabSource.connect(destination);
      tabSource.connect(analyser);

      // Connect mic audio if present
      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
        micSource.connect(analyser);
      }

      // 4. Determine supported recording format
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else {
          mimeType = "";
        }
      }

      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 48000, // 48 kbps (~21 MB per hour)
      };
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(destination.stream, recorderOptions);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Automatically stop if user clicks "Stop sharing" on the native Chrome banner
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        };
      }

      recorder.start(1000); // 1-second time slices
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Duration counter
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Start volume meter
      startAudioMeter(analyser);
    } catch (err: unknown) {
      cleanupAudioContext();
      const message = err instanceof Error ? err.message : "Failed to start recording.";
      setError(message);
    }
  }, [cleanupAudioContext, recordedAudioUrl, startAudioMeter]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      if (analyserRef.current) {
        startAudioMeter(analyserRef.current);
      }
    }
  }, [startAudioMeter]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanupAudioContext();
        setIsRecording(false);
        setIsPaused(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(audioBlob);
        setRecordedBlob(audioBlob);
        setRecordedAudioUrl(url);

        cleanupAudioContext();
        setIsRecording(false);
        setIsPaused(false);
        resolve(audioBlob);
      };

      recorder.stop();
    });
  }, [cleanupAudioContext]);

  const resetRecording = useCallback(() => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedBlob(null);
    setRecordedAudioUrl(null);
    setDuration(0);
    setError(null);
    setAudioLevel(0);
  }, [recordedAudioUrl]);

  useEffect(() => {
    return () => {
      cleanupAudioContext();
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [cleanupAudioContext, recordedAudioUrl]);

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordedBlob,
    recordedAudioUrl,
    resetRecording,
  };
}
