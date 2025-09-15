import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { audioContent } = await request.json()

    const apiKey = process.env.GOOGLE_STT_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "STT API key not configured" }, { status: 500 })
    }

    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: "en-US",
          enableAutomaticPunctuation: true,
        },
        audio: {
          content: audioContent,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`STT API error: ${response.status}`)
    }

    const data = await response.json()
    const transcript = data.results?.[0]?.alternatives?.[0]?.transcript || ""

    return NextResponse.json({ transcript })
  } catch (error) {
    console.error("STT API Error:", error)
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 })
  }
}
