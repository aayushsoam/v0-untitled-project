"use client"

import { useState, useCallback } from "react"
import type { ModelType } from "../types/chat"
import { generateGeminiResponse } from "../utils/gemini"
import { generateMixtralResponse } from "../utils/Deepseek"
import { generateFluxImage } from "../utils/flux-ai"
// Add to the existing imports
import { generateGPT4OMiniResponse, validateImageFile } from "../utils/gpt-4o-mini"

type MessageRole = "user" | "assistant" | "system"

// Update the Message interface
interface Message {
  role: MessageRole
  content: string
  model?: ModelType
  metadata?: {
    imageUrl?: string
    tokens?: number
    tokensPerSecond?: number
    timeToFirstToken?: number
    stopReason?: string
  }
  attachments?: { type: string; url: string }[]
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelType>("gemini")
  const [streamingMessage, setStreamingMessage] = useState<string>("")
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)

  // Add the new model to the models object
  const models: Record<ModelType, string> = {
    gemini: "Gemini Pro",
    llama: "Llama 3.2 1B",
    "gpt-4": "GPT-4",
    mixtral: "Deepseek-90B-vision",
    "flux-ai": "Flux AI (Image)",
    "gpt-4o-mini": "GPT-4O Mini",
  }

  // Add a new function to generate response from GPT-4O Mini
  // async function generateGPT4OMiniResponse(prompt: string): Promise<string> {
  //   try {
  //     const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization:
  //           "Bearer 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",
  //       },
  //       body: JSON.stringify({
  //         messages: [
  //           {
  //             role: "system",
  //             content: "You are a helpful assistant.",
  //           },
  //           {
  //             role: "user",
  //             content: prompt,
  //           },
  //         ],
  //         temperature: 1.0,
  //         top_p: 1.0,
  //         max_tokens: 1000,
  //         model: "gpt-4o-mini",
  //       }),
  //     })

  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`)
  //     }

  //     const data = await response.json()
  //     return data.choices[0].message.content
  //   } catch (error) {
  //     console.error("Error calling GPT-4O Mini API:", error)
  //     throw error
  //   }
  // }

  // Update the addMessage function to include the new model
  const addMessage = useCallback(
    async (content: string, role: MessageRole = "user", language = "english", imageFile?: File) => {
      // Validate image if provided
      if (imageFile) {
        try {
          validateImageFile(imageFile)
        } catch (error) {
          setError(error instanceof Error ? error.message : "Invalid image file")
          return
        }
      }

      // Add user message with image attachment if present
      const userMessage = {
        role,
        content,
        attachments: imageFile ? [{ type: "image", url: URL.createObjectURL(imageFile) }] : undefined,
      }
      setMessages((prev) => [...prev, userMessage])
      setError(null)

      if (role === "user") {
        setIsLoading(true)
        setStreamingMessage("")
        try {
          let response: string
          let imageUrl: string | undefined

          if (selectedModel === "gpt-4o-mini") {
            const result = await generateGPT4OMiniResponse(content, imageFile)
            response = result.text
            imageUrl = result.imageUrl
          } else if (selectedModel === "flux-ai") {
            const imageUrl = await generateFluxImage(content)
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "Here's the generated image:",
                model: selectedModel,
                metadata: {
                  imageUrl,
                },
              },
            ])
            return
          } else {
            const generateResponse = selectedModel === "gemini" ? generateGeminiResponse : generateMixtralResponse
            response = await generateResponse(content, language)
          }

          // Format and set the response
          const formattedResponse = response.trim()

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: formattedResponse,
              model: selectedModel,
              metadata: {
                imageUrl,
                tokens: formattedResponse.split("**").length,
                tokensPerSecond: formattedResponse.split("**").length / 2,
                timeToFirstToken: 0.5,
                stopReason: "Completed",
              },
            },
          ])
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
          setIsLoading(false)
          setStreamingMessage("")
        }
      }
    },
    [selectedModel],
  )

  const regenerateLastResponse = useCallback(() => {
    const lastUserMessageIndex = messages.findLastIndex((msg) => msg.role === "user")
    if (lastUserMessageIndex !== -1) {
      const messagesToKeep = messages.slice(0, lastUserMessageIndex + 1)
      setMessages(messagesToKeep)
      addMessage(messages[lastUserMessageIndex].content, "user")
    }
  }, [messages, addMessage])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  // Add uploadFile implementation
  const uploadFile = useCallback(
    (file: File) => {
      if (file.type.startsWith("image/")) {
        // For images, we'll pass both the file and a generic prompt
        addMessage("Could you analyze this image for me?", "user", "english", file)
      } else {
        // Existing file handling logic
        console.log("File uploaded:", file.name)
      }
    },
    [addMessage],
  )


  async function generateImageAnalysisResponse(
    base64Image: string,
    userDescription: string,
    language: string,
  ): Promise<string> {
    // Implement your image analysis logic here
    // This could involve calling a separate API that can handle image analysis
    // For now, we'll return a placeholder response
    return `Based on the uploaded image and your description: "${userDescription}", here's my analysis:

1. [Placeholder for image content description]
2. [Placeholder for relevant details about the image]
3. [Placeholder for any specific observations related to the user's description]

Please note that this is a placeholder response. Implement actual image analysis functionality for accurate results.`
  }

  return {
    messages,
    isLoading,
    error,
    selectedModel,
    setSelectedModel,
    addMessage,
    regenerateLastResponse,
    clearChat,
    uploadFile,
    streamingMessage,
    generatedImageUrl,
    setGeneratedImageUrl,
    generateImageAnalysisResponse,
  }
}

