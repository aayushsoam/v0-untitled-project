const API_KEY = ""
const API_URL = "https://api.groq.com/openai/v1/chat/completions"

export async function generateMixtralResponse(prompt: string): Promise<string> {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI assistant. Provide detailed, well-structured responses. Use markdown formatting when appropriate for better readability. Include examples and explanations where relevant.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 4096,
        top_p: 0.9,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || "API request failed")
    }

    const data = await response.json()

    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Invalid response format from API")
    }

    return data.choices[0].message.content
  } catch (error) {
    console.error("Error calling Mixtral API:", error)
    return "Sorry, I encountered an error while processing your request. Please try again later."
  }
}

