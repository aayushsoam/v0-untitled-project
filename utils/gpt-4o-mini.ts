const API_URL = "https://models.inference.ai.azure.com/chat/completions"
const API_KEY = ""

// Type definitions for message content
type MessageContent = {
  text?: string
  type: "text" | "image_url"
  image_url?: {
    url: string
    detail: "low" | "high"
  }
}

interface GPT4OMessage {
  role: "system" | "user" | "assistant"
  content: string | MessageContent[]
}

// Function to convert File to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Failed to convert file to base64"))
      }
    }
    reader.onerror = (error) => reject(error)
  })
}

// Main function to generate response from GPT-4O Mini
export async function generateGPT4OMiniResponse(
  prompt: string,
  imageFile?: File,
): Promise<{ text: string; imageUrl?: string }> {
  try {
    const messages: GPT4OMessage[] = [
      {
        role: "system",
        content: imageFile
          ? "You are a helpful assistant that describes images in detail. Please analyze the image and provide a comprehensive description."
          : "You are a helpful assistant.",
      },
    ]

    if (imageFile) {
      // Convert image to base64
      const base64Image = await fileToBase64(imageFile)

      // Create message with both text and image
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: prompt || "Please analyze this image in detail.",
          },
          {
            type: "image_url",
            image_url: {
              url: base64Image,
              detail: "high",
            },
          },
        ],
      })
    } else {
      // Text-only message
      messages.push({
        role: "user",
        content: prompt,
      })
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        messages,
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 4096,
        model: "gpt-4o",
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Create object URL for the image if it exists
    const imageUrl = imageFile ? URL.createObjectURL(imageFile) : undefined

    return {
      text: data.choices[0].message.content,
      imageUrl,
    }
  } catch (error) {
    console.error("Error calling GPT-4O Mini API:", error)
    throw error
  }
}

// Function to validate image file
export function validateImageFile(file: File): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  const maxSize = 4 * 1024 * 1024 // 4MB

  if (!validTypes.includes(file.type)) {
    throw new Error("Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.")
  }

  if (file.size > maxSize) {
    throw new Error("File too large. Maximum size is 4MB.")
  }

  return true
}

