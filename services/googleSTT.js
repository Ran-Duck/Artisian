import { voiceManager } from "./voiceManager.js"

class GoogleSTTService {
  constructor() {
    this.isListening = false
    this.recognition = null
  }

  async startListening(options = {}) {
    // Stop any current voice activity before starting to listen
    voiceManager.stopAll()

    return this.fallbackListen(options)
  }

  // Use Web Speech API for real-time listening
  fallbackListen(options = {}) {
    return new Promise((resolve, reject) => {
      if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        reject(new Error("Speech recognition not supported"))
        return
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      this.recognition = new SpeechRecognition()

      this.recognition.continuous = false
      this.recognition.interimResults = false
      this.recognition.lang = options.language || "en-US"

      voiceManager.setListening(true)
      this.isListening = true

      this.recognition.onresult = (event) => {
        clearTimeout(this.timeoutId)
        const transcript = event.results[0][0].transcript
        voiceManager.setListening(false)
        this.isListening = false
        resolve(transcript)
      }

      this.recognition.onerror = (event) => {
        clearTimeout(this.timeoutId)
        voiceManager.setListening(false)
        this.isListening = false
        reject(new Error(`Speech recognition error: ${event.error}`))
      }

      this.recognition.onend = () => {
        clearTimeout(this.timeoutId)
        voiceManager.setListening(false)
        this.isListening = false
      }

      const timeout = options.timeout || 5000
      this.timeoutId = setTimeout(() => {
        if (this.isListening) {
          this.stopListening()
          resolve("") // Return empty string on timeout
        }
      }, timeout)

      this.recognition.start()
    })
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      voiceManager.setListening(false)
      this.isListening = false
    }
  }
}

export const sttService = new GoogleSTTService()
