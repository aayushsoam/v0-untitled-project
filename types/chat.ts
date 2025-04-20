export type Message = {
  role: "user" | "assistant" | "system"
  content: string
  model?: string
  metadata?: {
    imageUrl?: string
    tokens?: number
    tokensPerSecond?: number
    timeToFirstToken?: number
    stopReason?: string
  }
  attachments?: {
    type: "image"
    url: string
  }[]
}

export type ModelType = "gemini" | "llama" | "gpt-4" | "Deepseek" | "flux-ai" | "mistral" | "gpt-4o-mini"

