class VoiceManager {
  constructor() {
    this.isCurrentlySpeaking = false
    this.isCurrentlyListening = false
    this.currentAudio = null
    this.speechQueue = []
    this.isProcessingQueue = false
    this.abortController = null
    this.pendingRequests = new Set()
  }

  // Stop all current voice activities
  stopAll() {
    console.log("[voice] Stopping all voice activities")

    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }

    // Stop speech synthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    this.speechQueue = []
    this.isProcessingQueue = false

    // Abort any ongoing requests
    if (this.abortController) {
      this.abortController.abort()
    }

    this.pendingRequests.clear()

    this.isCurrentlySpeaking = false
    this.isCurrentlyListening = false
  }

  // Check if any voice activity is happening
  isActive() {
    return this.isCurrentlySpeaking || this.isCurrentlyListening
  }

  // Set speaking state
  setSpeaking(speaking) {
    this.isCurrentlySpeaking = speaking
  }

  // Set listening state
  setListening(listening) {
    this.isCurrentlyListening = listening
  }

  // Set current audio
  setCurrentAudio(audio) {
    this.currentAudio = audio
  }

  // Set abort controller
  setAbortController(controller) {
    this.abortController = controller
  }

  async processQueue() {
    if (this.isProcessingQueue || this.speechQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true
    console.log("[voice] Processing voice queue, items:", this.speechQueue.length)

    while (this.speechQueue.length > 0) {
      const { text, options, resolve, reject } = this.speechQueue.shift()

      try {
        console.log("[voice] Speaking from queue:", text.substring(0, 50) + "...")
        await this.directSpeak(text, options)
        resolve()
      } catch (error) {
        console.error("[voice] Queue speech error:", error)
        reject(error)
      }
    }

    this.isProcessingQueue = false
    console.log("[voice] Voice queue processing complete")
  }

  async queueSpeak(text, options = {}) {
    const requestKey = text.substring(0, 50)
    if (this.pendingRequests.has(requestKey)) {
      console.log("[voice] Duplicate request prevented:", requestKey)
      return
    }

    this.pendingRequests.add(requestKey)

    return new Promise((resolve, reject) => {
      this.speechQueue.push({
        text,
        options,
        resolve: () => {
          this.pendingRequests.delete(requestKey)
          resolve()
        },
        reject: (error) => {
          this.pendingRequests.delete(requestKey)
          reject(error)
        },
      })
      console.log("[voice] Added to voice queue:", text.substring(0, 50) + "...")
      this.processQueue()
    })
  }

  async directSpeak(text, options = {}) {
    const requestKey = text.substring(0, 50)
    if (this.isCurrentlySpeaking) {
      console.log("[voice] Already speaking, ignoring duplicate request")
      return
    }

    // Stop any current voice activity first
    this.stopAll()

    try {
      this.isCurrentlySpeaking = true
      console.log("[voice] Making TTS API request for text:", text.substring(0, 50) + "...")

      const abortController = new AbortController()
      this.abortController = abortController

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, options }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`)
      }

      const data = await response.json()
      console.log("[voice] TTS API request successful")

      if (data.error) {
        throw new Error(data.error)
      }

      return await this.playAudio(data.audioContent)
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("[voice] TTS request aborted")
        return
      }
      console.error("[voice] TTS Error:", error)
      return this.fallbackSpeak(text)
    } finally {
      this.isCurrentlySpeaking = false
      this.abortController = null
    }
  }

  async playAudio(base64Audio) {
    try {
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`)
      this.currentAudio = audio

      // Create a promise that resolves on 'ended' and rejects on 'error'
      const playbackPromise = new Promise((resolve, reject) => {
        audio.onended = () => {
          console.log("[voice] Audio playback ended")
          this.currentAudio = null
          resolve()
        }
        audio.onerror = (error) => {
          console.error("[voice] Audio playback error:", error)
          this.currentAudio = null
          reject(error)
        }
      })

      console.log("[voice] Starting audio playback")
      // The play() method returns a promise that resolves when playback begins
      // or rejects if it fails (e.g., autoplay blocked).
      await audio.play()

      // Wait for the audio to finish playing
      await playbackPromise
    } catch (error) {
      console.error("[voice] Audio setup or playback error:", error)
      this.currentAudio = null
      // Re-throw the error so it can be handled by the caller (directSpeak)
      throw error
    }
  }

  fallbackSpeak(text) {
    return new Promise((resolve) => {
      if ("speechSynthesis" in window) {
        // Cancel any existing speech
        window.speechSynthesis.cancel()

        console.log("[voice] Using fallback speech synthesis")
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.onend = () => {
          console.log("[voice] Fallback speech ended")
          resolve()
        }
        utterance.onerror = (error) => {
          console.error("[voice] Fallback speech error:", error)
          resolve()
        }

        window.speechSynthesis.speak(utterance)
      } else {
        console.warn("[voice] Speech synthesis not supported")
        resolve()
      }
    })
  }
}

let voiceManagerInstance = null
export const voiceManager = voiceManagerInstance || (voiceManagerInstance = new VoiceManager())
