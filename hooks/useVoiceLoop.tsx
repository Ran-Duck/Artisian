"use client"

import { useState, useCallback, useEffect } from "react"
import { ttsService } from "@/services/googleTTS"
import { sttService } from "@/services/googleSTT"
import { voiceManager } from "@/services/voiceManager"

export function useVoiceLoop() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [lastCommand, setLastCommand] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      console.log("[voice] useVoiceLoop cleanup - stopping all voice activities")
      voiceManager.stopAll()
    }
  }, [])

  const speak = useCallback(async (text: string) => {
    try {
      console.log("[voice] useVoiceLoop speak:", text.substring(0, 50) + "...")
      setIsSpeaking(true)
      setError(null)
      if (voiceManager.isCurrentlySpeaking) {
        console.log("[voice] Already speaking, skipping duplicate request")
        return
      }
      await ttsService.speak(text)
    } catch (err) {
      console.error("[voice] useVoiceLoop speak error:", err)
      setError(err instanceof Error ? err.message : "Speech error")
    } finally {
      setIsSpeaking(false)
    }
  }, [])

  const listen = useCallback(async (timeout = 5000) => {
    try {
      setIsListening(true)
      setError(null)
      const command = await sttService.startListening({ timeout })
      setLastCommand(command)
      return command
    } catch (err) {
      setError(err instanceof Error ? err.message : "Listening error")
      return ""
    } finally {
      setIsListening(false)
    }
  }, [])

  const speakThenListen = useCallback(
    async (text: string, timeout = 5000) => {
      await speak(text)
      await new Promise((resolve) => setTimeout(resolve, 500))
      return await listen(timeout)
    },
    [speak, listen],
  )

  const stopListening = useCallback(() => {
    sttService.stopListening()
    setIsListening(false)
  }, [])

  const stopAll = useCallback(() => {
    voiceManager.stopAll()
    setIsListening(false)
    setIsSpeaking(false)
  }, [])

  return {
    speak,
    listen,
    speakThenListen,
    stopListening,
    stopAll,
    isListening,
    isSpeaking,
    lastCommand,
    error,
    isActive: isListening || isSpeaking,
  }
}
