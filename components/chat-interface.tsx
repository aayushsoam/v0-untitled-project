"use client"
import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  ChevronDown,
  Copy,
  Pencil,
  Play, 
  ArrowLeft,
  Download,
  FileText,
  MessageSquare,
  RotateCcw,
  Settings,
  Trash2,
  Menu,
  Upload,
  Moon,
  Sun,
  Volume2,
  Loader2,
  Maximize,
  Minimize,
  ImageIcon,
  LogIn,
  ThumbsUp,
  ThumbsDown,
  Mic,
  MicOff,
  Code,
  Search,
  X,
} from "lucide-react"
import { useChat } from "@/hooks/use-chat"
import type { ModelType } from "@/types/chat"
import { useToast } from "@/components/ui/use-toast"
import { useTheme } from "next-themes"
import hljs from "highlight.js"
import "highlight.js/styles/atom-one-dark.css"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

const API_KEY = "e88732a0dcmsh93d153bd2de7bc9p16598djsn6c90a2e9cc23"
const JUDGE0_API_URL = "https://judge0-ce.p.rapidapi.com/submissions"

type CodeExecutionResult = {
  status: {
    id: number
    description: string
  }
  stdout: string
  stderr: string
  compile_output: string
  message: string
  time: string
}

const executeCode = async (code: string, language: string): Promise<CodeExecutionResult> => {
  const languageId = getLanguageId(language)

  if (language.toLowerCase() === "java") {
    code = wrapJavaCode(code)
  }

  const submissionData = {
    source_code: code, // Base64 Encoding हटाया
    language_id: languageId,
    stdin: "",
    expected_output: "",
    cpu_time_limit: "8", // Java Execution Timeout fix
    memory_limit: "256000", // Java के लिए High Memory
  }

  try {
    const submissionResponse = await fetch(JUDGE0_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
      body: JSON.stringify(submissionData),
    })

    if (!submissionResponse.ok) {
      throw new Error(`HTTP error! status: ${submissionResponse.status}`)
    }

    const submissionResult = await submissionResponse.json()

    if (!submissionResult.token) {
      throw new Error("No token received from Judge0 API")
    }

    let result: CodeExecutionResult
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const resultResponse = await fetch(`${JUDGE0_API_URL}/${submissionResult.token}?base64_encoded=false&fields=*`, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      })

      if (!resultResponse.ok) {
        throw new Error(`HTTP error! status: ${resultResponse.status}`)
      }

      const responseText = await resultResponse.text()

      try {
        result = JSON.parse(responseText)
      } catch (error) {
        console.error("Failed to parse JSON:", responseText)
        throw new Error("Invalid JSON response from Judge0 API")
      }

      if (result.status.id !== 1 && result.status.id !== 2) {
        break
      }

      attempts++
    }

    if (attempts >= maxAttempts) {
      throw new Error("Timeout: Code execution took too long")
    }

    if (language.toLowerCase() === "java" && (result.stderr || result.compile_output)) {
      console.error("Java Compilation Error:", result.stderr || result.compile_output)
    }

    return result
  } catch (error) {
    console.error("Error in executeCode:", error)
    throw error
  }
}

const wrapJavaCode = (code) => {
  if (!code.includes("class ")) {
    return `public class Main { public static void main(String[] args) { ${code} } }`
  }
  return code
}

const getLanguageId = (language: string): number => {
  const languageMap: { [key: string]: number } = {
    python: 71,
    javascript: 63,
    typescript: 74,
    cpp: 54,
    c: 50,
    java: 62,
    html: 42,
    css: 41,
  }
  return languageMap[language.toLowerCase()] || 63 // Default to JavaScript if language not found
}

const isWebLanguage = (language: string): boolean => {
  return ["html", "css", "javascript", "typescript"].includes(language.toLowerCase())
}

const getLanguageFromCode = (code: string): string => {
  if (code.includes("<html>") || code.includes("<body>")) return "html"
  if (code.includes("body {") || code.includes("@media")) return "css"
  if (code.includes("function") || code.includes("var ") || code.includes("let ") || code.includes("const "))
    return "javascript"
  if (code.includes(": ") || code.includes("interface ") || code.includes("type ")) return "typescript"
  if (code.includes("def ") || code.includes("print(")) return "python"
  if (code.includes("int main()") || code.includes("#include")) return "cpp"
  if (code.includes("public static void main(String[] args)")) return "java"
  return "javascript" // Default to JavaScript
}

const PreviewBox = ({ html, css, js, searchQuery }: { html: string; css: string; js: string; searchQuery: string }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const { toast } = useToast()

  const fetchGoogleImages = useCallback(async (query: string) => {
    if (!query) return

    const url = `https://google-search72.p.rapidapi.com/search?q=${query}&lr=en-US&num=10`

    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-host": "google-search72.p.rapidapi.com",
        "x-rapidapi-key": "e88732a0dcmsh93d153bd2de7bc9p16598djsn6c90a2e9cc23",
      },
    }

    try {
      const response = await fetch(url, options)
      const data = await response.json()
      const images = data.items || []
      setImageUrls(images.map((image: any) => image.link || ""))
    } catch (error) {
      console.error("Error fetching images from Google:", error)
      setImageUrls([])
    }
  }, [])

  useEffect(() => {
    if (searchQuery) {
      fetchGoogleImages(searchQuery)
    }
  }, [searchQuery, fetchGoogleImages])

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(`
          <html>
            <head>
              <style>${css}</style>
            </head>
            <body>
              ${html || '<div id="app"></div>'}
              <div id="images">
                ${imageUrls.map((url) => `<img src="${url}" alt="Google Image" style="width:100%; height:auto;"/>`).join("")}
              </div>
              <script>${js}</script>
            </body>
          </html>
        `)
        doc.close()
      }
    }
  }, [html, css, js, imageUrls])

  const toggleFullScreen = () => {
    if (isFullScreen) {
      setIsFullScreen(false)
    } else {
      const newWindow = window.open("", "_blank", "width=800,height=600")
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <style>${css}</style>
            </head>
            <body>
              ${html || '<div id="app"></div>'}
              <div id="images">
                ${imageUrls.map((url) => `<img src="${url}" alt="Google Image" style="width:100%; height:auto;"/>`).join("")}
              </div>
              <script>${js}</script>
            </body>
          </html>
        `)
        newWindow.document.close()
      }
    }
  }

  return (
    <div
      className={`relative border border-gray-700 rounded-md overflow-hidden ${isFullScreen ? "fixed inset-0 z-50" : ""}`}
    >
      <div className="bg-gray-800 text-white p-2 text-sm flex justify-between items-center">
        <span>Preview</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullScreen}
          className="hover:bg-transparent hover:border hover:border-white"
        >
          {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </Button>
      </div>
      {!isFullScreen && <iframe ref={iframeRef} className={`w-full border-none h-[300px]`} />}
    </div>
  )
}
const OutputBox = ({ output }: { output: string }) => {
  return (
    <div className="border border-gray-700 rounded-md overflow-hidden">
      <div className="bg-gray-800 text-white p-2 text-sm">Output</div>
      <pre className="p-4 whitespace-pre-wrap break-words bg-gray-900 text-white">{output}</pre>
    </div>
  )
}


const FileUploadButton = ({
  onUpload,
  setInput,
}: {
  onUpload: (file: File) => void
  setInput: React.Dispatch<React.SetStateAction<string>>
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        // Validate file is an image
        if (!file.type.startsWith("image/")) {
          throw new Error("Please upload an image file")
        }

        // Create preview URL
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        setUploadedFile(file)

        // Add the image to the chat as a user message
        const imageUrl = URL.createObjectURL(file)
        onUpload(file)

        // Update input placeholder to prompt for description
        setInput("")
        toast({
          description: "Image uploaded! Please add a description and click Send.",
          duration: 3000,
        })
      } catch (error) {
        console.error("Error reading file:", error)
        toast({
          description: error instanceof Error ? error.message : "Error reading file. Please try again.",
          duration: 2000,
        })
      }
    }
  }

  // Cleanup preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <div className="flex items-center gap-2">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: "none" }} />
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        className="hover:bg-transparent hover:border hover:border-white"
      >
        <Upload size={16} />
      </Button>
      {previewUrl && (
        <div className="relative group">
          <img src={previewUrl || "/placeholder.svg"} alt="Upload preview" className="h-8 w-8 object-cover rounded" />
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => {
              setPreviewUrl(null)
              setUploadedFile(null)
              if (fileInputRef.current) {
                fileInputRef.current.value = ""
              }
            }}
          >
            ×
          </Button>
        </div>
      )}
    </div>
  )
}

const SettingsMenu = ({
  theme,
  setTheme,
  selectedLanguage,
  setSelectedLanguage,
  selectedVoice,
  setSelectedVoice,
  availableVoices,
  languages,
}: {
  theme: string
  setTheme: (theme: string) => void
  selectedLanguage: string
  setSelectedLanguage: (language: string) => void
  selectedVoice: SpeechSynthesisVoice | null
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void
  availableVoices: SpeechSynthesisVoice[]
  languages: { value: string; label: string }[]
}) => {
  const [isVoicesDropdownOpen, setIsVoicesDropdownOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span>Theme</span>
        <Button variant="outline" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span>Language</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {languages.find((lang) => lang.value === selectedLanguage)?.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {languages.map((lang) => (
              <DropdownMenuItem key={lang.value} onClick={() => setSelectedLanguage(lang.value)}>
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span>Voice</span>
          <Button variant="outline" size="sm" onClick={() => setIsVoicesDropdownOpen(!isVoicesDropdownOpen)}>
            {selectedVoice?.name || "Default"}
          </Button>
        </div>
        {isVoicesDropdownOpen && (
          <ScrollArea className="h-[200px] w-full rounded-md border">
            <div className="p-4">
              {availableVoices.map((voice) => (
                <Button
                  key={voice.name}
                  variant="ghost"
                  className="w-full justify-start text-left mb-2"
                  onClick={() => {
                    setSelectedVoice(voice)
                    setIsVoicesDropdownOpen(false)
                  }}
                >
                  <div>
                    <div className="font-medium">{voice.name}</div>
                    <div className="text-xs text-gray-500">{voice.lang}</div>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}

const chunkText = (text: string, maxLength = 200): string[] => {
  const chunks: string[] = []
  let currentChunk = ""

  text.split(/([.,!?])\s+/).forEach((sentence) => {
    if (currentChunk.length + sentence.length <= maxLength) {
      currentChunk += sentence + " "
    } else {
      if (currentChunk) chunks.push(currentChunk.trim())
      currentChunk = sentence + " "
    }
  })

  if (currentChunk) chunks.push(currentChunk.trim())
  return chunks
}

const AnimatedImageBox = () => (
  <div className="w-[50%] h-[400px] bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
    <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
  </div>
)

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Emoji mapping for text replacement
const emojiMap: { [key: string]: string } = {
  important: "⚠️ Important",
  note: "📝 Note",
  warning: "🚨 Warning",
  info: "ℹ️ Info",
  success: "✅ Success",
  error: "❌ Error",
  love: "❤️ Love",
  star: "⭐ Star",
  fire: "🔥 Fire",
  cool: "😎 Cool",
  happy: "😊 Happy",
  sad: "😢 Sad",
  thinking: "🤔 Thinking",
  idea: "💡 Idea",
  check: "✔️ Check",
  cross: "❎ Cross",
  rocket: "🚀 Rocket",
  clap: "👏 Clap",
};

// Add emojis to text based on keywords
const addEmojis = (text: string): string => {
  return text.replace(
    /\b(important|note|warning|info|success|error|love|star|fire|cool|happy|sad|thinking|idea|check|cross|rocket|clap)\b/gi,
    (match) => emojiMap[match.toLowerCase()] || match
  );
};

// Remove unwanted symbols from text
const highlightSymbols = (text: string): string => {
  return text.replace(/(["",<>])/g, "");
};

// Typing effect component
const TypingEffect = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [text]);

  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayedText}</ReactMarkdown>;
};



// Main table formatting component
const formatTable = (content: string): JSX.Element => {
  if (!content.includes("|") && !isTableQuery(content)) {
    return <TypingEffect text={highlightSymbols(addEmojis(content))} />;
  }

  const tableMatch = content.match(/(\|.*\|(\n\|.*\|)*)/);
  const tableContent = tableMatch ? tableMatch[0] : generateTableIfNeeded(content);

  const beforeText = tableMatch ? content.split(tableContent)[0].trim() : "";
  const afterText = tableMatch ? content.split(tableContent)[1].trim() : "";

  return (
    <div className="w-full my-4 text-white">
      {beforeText && (
        <div className="mb-4 text-gray-300">
          {beforeText.split("\n").map((line, index) => (
            <div key={index} className="mt-1">
              <TypingEffect text={highlightSymbols(addEmojis(line))} />
            </div>
          ))}
        </div>
      )}

      {/* Responsive table wrapper */}
      <div className="relative bg-silver p-1 rounded-[20px] overflow-x-auto">
        <button
          onClick={() => copyTableToClipboard(tableContent)}
          className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm"
        >
          ▣
        </button>

        {/* Table with responsive features */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] sm:min-w-full border border-gray-700 text-[10px] sm:text-xs md:text-sm lg:text-base">
            <thead>
              <tr className="bg-gray-800 text-white">
                {formatTableData(tableContent).headers.map((header, i) => (
                  <th key={i} className="px-2 py-1 sm:px-3 sm:py-2 text-left font-bold border-b border-gray-700 whitespace-nowrap">
                    <TypingEffect text={highlightSymbols(addEmojis(`**${header}**`))} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formatTableData(tableContent).data.map((row, i) => (
                <tr key={i} className="even:bg-gray-900 odd:bg-black">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1 sm:px-3 sm:py-2 border-b border-gray-700 break-words">
                      <TypingEffect text={highlightSymbols(addEmojis(cell))} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {afterText && (
        <div className="mt-4 text-gray-300">
          {afterText.split("\n").map((line, index) => (
            <div key={index} className="mt-1">
              <TypingEffect text={highlightSymbols(addEmojis(line))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const formatTextWithLinks = (text: string) => {
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)\]]+)\)/g;
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  let elements: (string | JSX.Element)[] = [];
  let lastIndex = 0;

  text.replace(markdownLinkRegex, (match, linkText, url, offset) => {
    elements.push(text.slice(lastIndex, offset));
    elements.push(
      <a key={offset} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
        Click here
      </a>
    );
    lastIndex = offset + match.length;
    return match;
  });

  text = text.slice(lastIndex);
  lastIndex = 0;
  
  text.replace(urlRegex, (url, offset) => {
    elements.push(text.slice(lastIndex, offset));
    elements.push(
      <a key={offset} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
        Click here
      </a>
    );
    lastIndex = offset + url.length;
    return url;
  });

  elements.push(text.slice(lastIndex));
  return <>{elements}</>;
};



const isTableQuery = (query: string) => {
  const keywords = ["difference", "and", "between", "table", "vs"]
  return keywords.some((word) => query.toLowerCase().includes(word))
}

const generateTableIfNeeded = (content: string) => {
  if (!isTableQuery(content)) return ""

  const words = content.split(" ")
  const header1 = words[1] || "Topic 1"
  const header2 = words[3] || "Topic 2"

  return `| ${header1} | ${header2} |
|------------|------------|
| Feature 1  | Feature A  |
| Feature 2  | Feature B  |
| Feature 3  | Feature C  |`
}

// Function to format table data
const formatTableData = (tableContent: string) => {
  const rows = tableContent.split("\n").filter((row) => row.trim().length > 0)
  const headers = rows[0]
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)
  const data = rows.slice(1).map((row) =>
    row
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean),
  )
  return { headers, data }
}

// Function to copy table to clipboard
const copyTableToClipboard = (tableContent: string) => {
  const { headers, data } = formatTableData(tableContent)
  const tableText = headers.join("\t") + "\n" + data.map((row) => row.join("\t")).join("\n")
  navigator.clipboard.writeText(tableText)
}

// Function to format text with Markdown-like styles
const formatText = (text: string) => {
  const lines = text.split("\n").map((line, index) => {
    // Headings
    if (line.startsWith("#### ")) {
      return (
        <h4 key={index} className="text-lg font-semibold">
          {line.replace("#### ", "")}
        </h4>
      )
    } else if (line.startsWith("### ")) {
      return (
        <h3 key={index} className="text-xl font-bold">
          {line.replace("### ", "")}
        </h3>
      )
    } else if (line.startsWith("## ")) {
      return (
        <h2 key={index} className="text-2xl font-bold">
          {line.replace("## ", "")}
        </h2>
      )
    }

    // Bullets
    if (line.startsWith("- ")) {
      return (
        <li key={index} className="ml-4 list-disc">
          {line.replace("- ", "")}
        </li>
      )
    }

    // Bold
    const boldText = line.split("**").map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))

    return (
      <p key={index} className="leading-relaxed">
        {boldText}
      </p>
    )
  })

  return <div className="space-y-2">{lines}</div>
}
import { Copy, Pencil, Search, X } from "lucide-react"
// Add this new component for the text selection toolbar
const TextSelectionToolbar = ({
  selectedText,
  position,
  onCopy,
  onEdit,
  onSearch,
  onClose,
}: {
  selectedText: string
  position: { top: number; left: number }
  onCopy: () => void
  onEdit: () => void
  onSearch: () => void
  onClose: () => void
}) => {
  return (
    <div
      className="absolute z-50 bg-gray-800 border border-gray-700 rounded-[30px] shadow-lg p-1 flex items-center gap-1"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <Button variant="ghost" size="sm" onClick={onCopy} className="h-8 w-8 p-0rounded-[30px]" title="Copy">
        <Copy size={14} />
      </Button>
      <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0 rounded-[30px]" title="Edit">
        <Pencil size={14} />
      </Button>
      <Button variant="ghost" size="sm" onClick={onSearch} className="h-8 w-8 p-0 rounded-[30px]" title="Search">
        <Search size={14} />
      </Button>
      <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-[30px]" title="Close">
        <X size={14} />
      </Button>
    </div>
  )
}

// Add this new component for the inline text area
import { useState, useEffect, useRef } from "react";
import { Bold, Italic } from "lucide-react";

const InlineTextArea = ({
  initialText,
  position,
  onSubmit,
  onCancel,
}: {
  initialText: string;
  position: { top: number; left: number };
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) => {
  const [inlineInput, setInlineInput] = useState(initialText);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onCancel]);

  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      textarea.style.width = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.style.width = `${Math.max(300, textarea.scrollWidth)}px`;
    }
  }, [inlineInput]);

  const applyFormatting = (format: "bold" | "italic") => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = inlineInput.substring(start, end);

    if (!selectedText) return;

    const formattedText =
      format === "bold"
        ? inlineInput.substring(0, start) + `**${selectedText}**` + inlineInput.substring(end)
        : inlineInput.substring(0, start) + `*${selectedText}*` + inlineInput.substring(end);

    setInlineInput(formattedText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(inlineInput);
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-gray-800 border border-gray-700 rounded-full shadow-lg flex flex-col gap-2"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: "600px",
      }}
    >
      <div className="flex items-center bg-gray-900 text-white border border-gray-700 rounded-full px-3 py-2">
        <textarea
          ref={textareaRef}
          value={inlineInput}
          onChange={(e) => {
            setInlineInput(e.target.value);
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.width = "auto";
              textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
              textareaRef.current.style.width = `${Math.max(300, textareaRef.current.scrollWidth)}px`;
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask..."
          className="bg-transparent flex-1 px-2 rounded-full outline-none text-sm placeholder-gray-400 resize-none"
          autoFocus
          style={{
            minWidth: "300px",
            maxWidth: "600px",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            scrollbarWidth: "none", // Firefox के लिए
            msOverflowStyle: "none", // IE और Edge के लिए
          }}
        />
        <style>
          {`
            textarea::-webkit-scrollbar {
              display: none;
            }
          `}
        </style>
        <button className="mx-2 text-gray-400 hover:text-white" onClick={() => applyFormatting("bold")}>
          <Bold size={16} />
        </button>
        <button className="text-gray-400 hover:text-white" onClick={() => applyFormatting("italic")}>
          <Italic size={16} />
        </button>
      </div>
    </div>
  );
};
const detectCodeBlocks = (text: string) => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const [fullMatch, language, code] = match
    const preText = text.substring(lastIndex, match.index)

    if (preText) {
      parts.push({ isCode: false, content: preText })
    }

    parts.push({ isCode: true, language: language || "plaintext", content: code.trim() })
    lastIndex = match.index + fullMatch.length
  }

  if (lastIndex < text.length) {
    parts.push({ isCode: false, content: text.substring(lastIndex) })
  }

  return parts
}

// ... (पहले का कोड रहेगा)

import dynamic from "next/dynamic"
import { loader } from "@monaco-editor/react"

// Monaco Editor को डायनामिक इम्पोर्ट करें
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

// Monaco Editor के लिए CDN से लोडर सेट करें
loader.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0/min/vs" } })

// CodeBlock कंपोनेंट को अपडेट करें
import { Download,Pencil, Play, ArrowLeft } from "lucide-react"


const CodeBlock = ({ code: initialCode, language }) => {
  const [isExecuting, setIsExecuting] = useState(false)
  const [output, setOutput] = useState(null)
  const [isOutputVisible, setIsOutputVisible] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState({ html: "", css: "", js: "" })
  const [code, setCode] = useState(initialCode)
  const [isEditing, setIsEditing] = useState(false)
  const [showDownloadOptions, setShowDownloadOptions] = useState(false)
  const [history, setHistory] = useState([initialCode]) // History stack for undo
  const [historyIndex, setHistoryIndex] = useState(0) // Current position in history
  const codeRef = useRef(null)

  // Update code and manage history
  const updateCode = (newCode) => {
    const updatedHistory = history.slice(0, historyIndex + 1) // Remove future states
    setHistory([...updatedHistory, newCode])
    setHistoryIndex(updatedHistory.length)
    setCode(newCode)
  }

  const saveCode = () => {
    // Save the current code to history
    updateCode(code)
    setIsEditing(false)
  }

  const undoCode = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setCode(history[historyIndex - 1])
    }
  }

  const redoCode = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setCode(history[historyIndex + 1])
    }
  }

  // Apply syntax highlighting
  useEffect(() => {
    if (!isEditing && codeRef.current) {
      setTimeout(() => {
        hljs.highlightElement(codeRef.current)
      }, 50)
    }
  }, [isEditing, code])

  // Run code
  const runCode = async () => {
    setIsExecuting(true)
    setIsOutputVisible(true)
    try {
      const detectedLanguage = language || "javascript"

      if (["html", "css", "javascript"].includes(detectedLanguage)) {
        setPreviewContent({
          html: detectedLanguage === "html" ? code : "",
          css: detectedLanguage === "css" ? code : "",
          js: detectedLanguage === "javascript" ? code : "",
        })
        setShowPreview(true)
      } else {
        const result = await executeCode(code, detectedLanguage)
        setOutput(result.stdout || result.stderr || "No output")
      }
    } catch (error) {
      setOutput(`Error: ${error.message}`)
    } finally {
      setIsExecuting(false)
    }
  }

  // Download file
  const downloadFile = (extension) => {
    const blob = new Blob([code], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `code.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowDownloadOptions(false)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault()
        undoCode()
      } else if (e.ctrlKey && e.key === "y") {
        e.preventDefault()
        redoCode()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [historyIndex, history])

  return (
    <div className="relative my-4 w-full max-w-4xl mx-auto rounded-[20px] overflow-hidden">
      {!isOutputVisible ? (
        <div className="transition-all duration-300">
          <div className="sticky top-0 flex items-center border border-gray-700 rounded-t-[20px] justify-between bg-gray-900 px-4 py-2 text-xs text-gray-200 z-10">
            <span>{language || "code"}</span>
            <div className="flex gap-2">
              <Button onClick={() => setIsEditing(!isEditing)} className="h-8 px-2 text-xs flex items-center gap-1">
                <Pencil className="w-4 h-4" /> {isEditing ? "Save" : "Edit"}
              </Button>
              <Button
                onClick={runCode}
                disabled={isExecuting}
                className={`h-8 px-2 text-xs flex items-center gap-1 ${
                  ["html", "css", "javascript", "python"].includes(language) ? "" : "hidden"
                }`}
              >
                {isExecuting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-4 h-4" />}
              </Button>

              <div className="relative">
                <Button
                  onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                  className="h-8 px-2 text-xs flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                </Button>
                {showDownloadOptions && (
                  <div className="absolute right-0 mt-2 w-40 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
                    <button
                      onClick={() => downloadFile(language || "txt")}
                      className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                    >
                      Ex.File
                    </button>
                    <button
                      onClick={() => downloadFile("txt")}
                      className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                    >
                      .txt
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-y-auto">
            {isEditing ? (
              <div className="h-72 rounded-b-[20px] overflow-hidden">
                <MonacoEditor
                  height="100%"
                  language={language || "javascript"}
                  theme="vs-dark"
                  value={code}
                  onChange={(value) => updateCode(value || "")}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    wordWrap: "on",
                    automaticLayout: true,
                    tabSize: 2,
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                />
              </div>
            ) : (
              <pre className="p-0 bg-gray-950 text-white overflow-x-auto text-[clamp(12px,2vw,16px)] leading-[1.4]">
                <code
                  ref={codeRef}
                  className={`language-${language || "plaintext"}`}
                  style={{ color: "#f8f8f2", whiteSpace: "pre-wrap" }}
                >
                  {code}
                </code>
              </pre>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-950 text-white transition-all duration-300">
          <div className="sticky top-0 bg-gray-900 border border-gray-700 rounded-t-[20px] px-4 py-2 text-xs flex justify-between z-10">
            <span>Output</span>
            <Button onClick={() => setIsOutputVisible(false)} className="h-6 px-2 text-xs flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Code
            </Button>
          </div>
          {showPreview ? (
            <div className="bg-white">
              <PreviewBox html={previewContent.html} css={previewContent.css} js={previewContent.js} searchQuery="" />
            </div>
          ) : (
            <pre className="p-4 whitespace-pre-wrap">
              <code className="text-sm">{output}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";

// Function to remove <think> tags and their content
const removeThinkTags = (content) => {
  const thinkRegex = /<think>[\s\S]*?<\/think>/g;
  return content.replace(thinkRegex, "");
};

// Function to detect YouTube links
const detectYouTubeLinks = (content) => {
  const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=|channel\/)|youtu\.be\/)([a-zA-Z0-9_-]{11,})/g;
  return content.match(youtubeRegex);
};

// Function to extract YouTube video ID, playlist ID, or channel ID
const extractYouTubeId = (url) => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|playlist\?list=|channel\/)|youtu\.be\/)([a-zA-Z0-9_-]{11,})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// Function to determine if the link is a playlist or channel
const getYouTubeEmbedUrl = (url) => {
  if (url.includes("playlist")) {
    const playlistId = extractYouTubeId(url);
    return `https://www.youtube.com/embed/videoseries?list=${playlistId}`;
  } else if (url.includes("channel")) {
    const channelId = extractYouTubeId(url);
    return `https://www.youtube.com/embed/?channel=${channelId}`;
  } else {
    const videoId = extractYouTubeId(url);
    return `https://www.youtube.com/embed/${videoId}`;
  }
};

// YouTube Embed Component with API Check
const YouTubeEmbed = ({ url }) => {
  const [isVideoAvailable, setIsVideoAvailable] = useState(true);
  const videoId = extractYouTubeId(url);

  useEffect(() => {
    const checkVideoAvailability = async () => {
      try {
        const apiKey = "AIzaSyDSMntGCDvPhsr2PdvJcHnTR8euhgqvJ8s";
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=status`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        // Check if video is available
        if (data.items.length === 0 || data.items[0].status.embeddable === false) {
          setIsVideoAvailable(false);
        }
      } catch (error) {
        console.error("Error checking video availability:", error);
        setIsVideoAvailable(false);
      }
    };

    if (videoId) {
      checkVideoAvailability();
    }
  }, [videoId]);

  // If video is unavailable, return null (render nothing)
  if (!isVideoAvailable) {
    return null;
  }

  return (
    <div className="youtube-embed-container" style={{ minWidth: '350px', height: '250px', margin: '10px' }}>
      <iframe
        width="100%"
        height="100%"
        src={getYouTubeEmbedUrl(url)}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};


const formatMessage = (content, metadata, attachments, messageIndex) => {
  // Process content to remove <think> tags and their content
  const processedContent = removeThinkTags(content);

  // Detect YouTube links
  const youtubeLinks = detectYouTubeLinks(processedContent);

  // Remove YouTube links from the content to avoid duplicate rendering
  const contentWithoutYouTubeLinks = youtubeLinks
    ? youtubeLinks.reduce((acc, link) => acc.replace(link, ""), processedContent)
    : processedContent;

  // Track unique YouTube links
  const uniqueYouTubeLinks = [];
  const seenLinks = new Set();

  if (youtubeLinks) {
    youtubeLinks.forEach((link) => {
      const videoId = extractYouTubeId(link);
      if (!seenLinks.has(videoId)) {
        seenLinks.add(videoId);
        uniqueYouTubeLinks.push(link);
      }
    });
  }

  return (
    <div className="space-y-4">
      {metadata?.imageUrl && !content.toLowerCase().includes("image analysis") && (
        <div className="mb-4">
          <img
            src={metadata.imageUrl || "/placeholder.svg"}
            alt="Generated image"
            className="max-w-[50%] h-auto rounded-[20px]"
          />
        </div>
      )}

      {attachments?.map((attachment, index) => (
        <div key={`attachment-${index}`} className="mt-2 relative group">
          <img
            src={attachment.url || "/placeholder.svg"}
            alt="Uploaded content"
            className="max-w-[300px] h-auto rounded-lg border border-gray-700"
          />
          <button
            onClick={() => window.open(attachment.url, "_blank")}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            🔗 {/* Replace Maximize icon with a simple emoji or text */}
          </button>
        </div>
      ))}

      <div>
        {/* Render unique YouTube links first */}
        <div className="youtube-links-container">
          {uniqueYouTubeLinks.map((link, index) => (
            <YouTubeEmbed key={index} url={link} />
          ))}
        </div>

        {/* Process content to detect and format code blocks */}
        {detectCodeBlocks(contentWithoutYouTubeLinks).map((part, index) => {
          if (part.isCode) {
            return <CodeBlock key={index} code={part.content} language={part.language} />;
          } else if (part.content.includes("|") && part.content.split("\n").length > 1) {
            // Check if this part contains a table
            return <React.Fragment key={index}>{formatTable(part.content)}</React.Fragment>;
          } else {
            // Regular text formatting
            return (
              <ReactMarkdown
                key={index}
                remarkPlugins={[remarkGfm]}
                components={{
                  // Override the default `a` component to handle YouTube and non-YouTube links
                  a: ({ node, ...props }) => {
                    const href = props.href;
                    // If the link is a YouTube link, skip rendering
                    if (href && href.match(/youtube\.com|youtu\.be/)) {
                      return <>🔗{props.children}</>; // Render only the text, not the link
                    }
                    // Otherwise, render it as a normal link with 🔗 emoji
                    return (
                      <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
                        🔗 {props.children}
                      </a>
                    );
                  },
                  h1: ({ node, ...props }) => (
                    <div>
                      <hr className="border-t border-gray-300 my-4" /> {/* Horizontal line for h1 */}
                      <h1 className="text-2xl font-bold" {...props} />
                    </div>
                  ),
                  h2: ({ node, ...props }) => (
                    <div>
                      <hr className="border-t border-gray-300 my-4" /> {/* Horizontal line for h2 */}
                      <h2 className="text-xl font-bold" {...props} />
                    </div>
                  ),
                  h3: ({ node, ...props }) => (
                    <div>
                      <hr className="border-t border-gray-300 my-4" /> {/* Horizontal line for h3 */}
                      <h3 className="text-lg font-bold" {...props} />
                    </div>
                  ),
                  strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                  em: ({ node, ...props }) => <em className="italic" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc pl-5" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal pl-5" {...props} />,
                  li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                }}
              >
                {part.content}
              </ReactMarkdown>
            );
          }
        })}
      </div>
    </div>
  );
};



// Add some CSS to make the YouTube embed responsive
const styles = `
  .youtube-embed-container {
    position: relative;
    width: 870px; /* Fixed width for larger screens */
    height: 450px; /* Fixed height for larger screens */
    margin: 0 auto; /* Center the container */
    overflow: hidden;
    border-radius: 20px; /* Add border radius */
    border: 2px solid silver; /* Add border color and size */
  }

  .youtube-embed-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none; /* Remove iframe border */
  }

  /* Responsive styles for tablets */
  @media (max-width: 1024px) {
    .youtube-embed-container {
      width: 90%; /* Adjust width for tablets */
      height: 400px; /* Adjust height for tablets */
    }
  }
  /* Responsive styles for mobile devices */
  @media (max-width: 768px) {
    .youtube-embed-container {
      width: 100%; /* Full width for mobile */
      height: 300px; /* Adjust height for mobile */
    }
  }
  /* Responsive styles for mobile devices */
  @media (max-width: 768px) {
    .youtube-links-container {
    flex-direction: column; /* Stack videos vertically */
    overflow-y: auto; /* Enable vertical scrolling */
    overflow-x: hidden; /* Disable horizontal scrolling */
    gap: 20px;
    
  }

  }
  /* For Laptop/Tablet (Horizontal Layout) */
/* For Laptop/Tablet (Horizontal Layout) */
.youtube-links-container {
  display: flex;
  overflow-x: auto; /* Enable horizontal scrolling */
  gap: 10px; /* Space between videos */
  padding-bottom: 10px; /* Add some padding at the bottom */
  scrollbar-width: none; /* Hide scrollbar in Firefox */
}

/* Hide scrollbar in WebKit browsers (Chrome, Safari, Edge) */
.youtube-links-container::-webkit-scrollbar {
  display: none; /* Hide scrollbar */
}

/* For Mobile (Vertical Layout) */
@media (max-width: 768px) {
  .youtube-links-container {
    flex-direction: column; /* Stack videos vertically */
    overflow-y: auto; /* Enable vertical scrolling */
    overflow-x: hidden; /* Disable horizontal scrolling */
    gap: 20px;
    padding-right:17px; /* Space between videos */
  }
}

  /* Responsive styles for very small mobile devices */
  @media (max-width: 480px) {
    .youtube-embed-container {
      height: 200px; /* Adjust height for very small screens */
    }
  }
`;
// Inject the styles into the document head
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

   
const Chat: React.FC = () => {
  // State and hooks
  const [input, setInput] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const {
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
    setMessages,
  } = useChat()
  const { theme, setTheme } = useTheme()
  const [selectedLanguage, setSelectedLanguage] = useState("english")
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [codeOutput, setCodeOutput] = useState<string>("")
  const [isExecutingCode, setIsExecutingCode] = useState(false)

  // यहां showPreview और previewContent स्टेट को अपडेट करें
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState({ html: "", css: "", js: "", searchQuery: "" })

  const [executionError, setExecutionError] = useState<string | null>(null)

  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [previewWidth, setPreviewWidth] = useState(400)
  const [previewHeight, setPreviewHeight] = useState(300)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [isRecording, setIsRecording] = useState(false)
  const recognition = useRef<SpeechRecognition | null>(null)

  // Add these new state variables inside the Chat component:
  const [showInlineTextArea, setShowInlineTextArea] = useState(false)
  const [inlineInput, setInlineInput] = useState("")
  const [inlinePosition, setInlinePosition] = useState({ top: 0, left: 0 })

  // Add these state variables inside the Chat component
  const [selectedText, setSelectedText] = useState("")
  const [selectionPosition, setSelectionPosition] = useState({ top: 0, left: 0 })
  const [showSelectionToolbar, setShowSelectionToolbar] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editedText, setEditedText] = useState("")
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window !== "") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        recognition.current = new SpeechRecognition()
        recognition.current.continuous = false
        recognition.current.interimResults = false
        recognition.current.lang = selectedLanguage === "english" ? "en-US" : "hi-IN"

        recognition.current.onresult = async (event) => {
          const transcript = event.results[0][0].transcript
          // Don't set input, directly send the message
          setIsThinking(true)
          if (selectedModel === "flux-ai") {
            setIsGeneratingImage(true)
          }
          await addMessage(transcript, "user", selectedLanguage)
          setIsThinking(false)
          setIsGeneratingImage(false)
        }

        recognition.current.onerror = (event) => {
          console.error("Speech recognition error:", event.error)
          setIsRecording(false)
          toast({
            description: "Error with speech recognition. Please try again.",
            duration: 3000,
          })
        }

        recognition.current.onend = () => {
          setIsRecording(false)
        }
      }
    }
  }, [selectedLanguage, toast, addMessage, selectedModel])

  const toggleRecording = () => {
    if (!recognition.current) {
      toast({
        description: "Speech recognition is not supported in your browser.",
        duration: 3000,
      })
      return
    }

    if (isRecording) {
      recognition.current.stop()
    } else {
      recognition.current.start()
      setIsRecording(true)
    }
  }

  const languages = [
    { value: "english", label: "English" },
    { value: "hindi", label: "हिन्दी" },
    { value: "japanese", label: "日本語" },
    { value: "chinese", label: "中文" },
    { value: "french", label: "Français" },
  ]

  // Handlers and utility functions
  const handleSend = async () => {
    if (!input.trim() && !uploadedFile) return

    const messageToSend = input
    const attachments = uploadedFile
      ? [
          {
            type: "image" as const,
            url: URL.createObjectURL(uploadedFile),
          },
        ]
      : undefined

    setInput("")
    setIsThinking(true)
    if (selectedModel === "flux-ai") {
      setIsGeneratingImage(true)
    }

    // Add message with attachment
    await addMessage(messageToSend, "user", selectedLanguage, uploadedFile, attachments)

    setIsThinking(false)
    setIsGeneratingImage(false)

    // Clear the uploaded file after sending
    setUploadedFile(null)
    setPreviewUrl(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        description: "Copied to clipboard",
        duration: 2000,
      })
      return true
    } catch (err) {
      console.error("Failed to copy: ", err)
      toast({
        description: "Failed to copy to clipboard",
        duration: 4096,
      })
      return false
    }
  }

  const models: Record<ModelType, string> = {
    gemini: "Gemini Pro",
    llama: "Llama 3.2 1B",
    "gpt-4": "GPT-4",
    Deepdeek: "Deepdeek-90B-vision",
    "flux-ai": "flux (image)",
    mistral: "Mistral 7B",
    "gpt-4o-mini": "GPT-4O Mini",
  }

  const handleFileUpload = useCallback(
    (file: File) => {
      uploadFile(file)
    },
    [uploadFile],
  )

  const codeBlockClass = cn(
    "font-mono text-left",
    "text-blue-300",
    "[&_.hljs-keyword]:text-pink-500",
    "[&_.hljs-built_in]:text-cyan-300",
    "[&_.hljs-type]:text-yellow-300",
    "[&_.hljs-literal]:text-cyan-300",
    "[&_.hljs-number]:text-green-400",
    "[&_.hljs-regexp]:text-red-400",
    "[&_.hljs-string]:text-green-300",
    "[&_.hljs-subst]:text-yellow-300",
    "[&_.hljs-symbol]:text-blue-400",
    "[&_.hljs-class]:text-purple-400",
    "[&_.hljs-function]:text-blue-400",
    "[&_.hljs-title]:text-white",
    "[&_.hljs-params]:text-yellow-300",
    "[&_.hljs-comment]:text-gray-500",
    "[&_.hljs-doctag]:text-gray-500",
    "[&_.hljs-meta]:text-gray-500",
    "[&_.hljs-section]:text-white",
    "[&_.hljs-tag]:text-red-400",
    "[&_.hljs-name]:text-red-400",
    "[&_.hljs-attr]:text-purple-300",
    "[&_.hljs-attribute]:text-blue-300",
    "[&_.hljs-variable]:text-orange-300",
  )

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    hljs.highlightAll()
  }, [])

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      setAvailableVoices(voices)
      if (voices.length > 0 && !selectedVoice) {
        setSelectedVoice(voices.find((voice) => voice.lang.startsWith("hi-")) || voices[0])
      }
    }

    loadVoices()
    if (typeof window !== "undefined" && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [selectedVoice])

  const speakMessage = (text: string) => {
    if (!("speechSynthesis" in window)) {
      console.error("Speech synthesis not supported")
      toast({
        description: "Speech synthesis is not supported in your browser.",
        duration: 3000,
      })
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()
    setIsSpeaking(true)

    const chunks = chunkText(text)
    let currentChunk = 0

    const speakNextChunk = () => {
      if (currentChunk < chunks.length) {
        const utterance = new SpeechSynthesisUtterance(chunks[currentChunk])
        utterance.voice = selectedVoice
        utterance.onend = () => {
          currentChunk++
          if (currentChunk < chunks.length) {
            speakNextChunk()
          } else {
            setIsSpeaking(false)
          }
        }
        utterance.onerror = (event) => {
          console.error("SpeechSynthesis Error:", event)
          setIsSpeaking(false)
          toast({
            description: "Error occurred during speech synthesis.",
            duration: 3000,
          })
        }

        window.speechSynthesis.speak(utterance)
      }
    }

    speakNextChunk()
  }

  // Component JSX
  const handlePreviewResize = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, direction: "width" | "height") => {
      const startX = e.clientX
      const startY = e.clientY
      const startWidth = previewWidth
      const startHeight = previewHeight

      const doDrag = (e: MouseEvent) => {
        if (direction === "width") {
          setPreviewWidth(startWidth + e.clientX - startX)
        } else {
          setPreviewHeight(startHeight + e.clientY - startY)
        }
      }

      const stopDrag = () => {
        document.removeEventListener("mousemove", doDrag)
        document.removeEventListener("mouseup", stopDrag)
      }

      document.addEventListener("mousemove", doDrag)
      document.addEventListener("mouseup", stopDrag)
    },
    [previewWidth, previewHeight],
  )

  // यह फंक्शन जोड़ें जो CodeBlock से प्रीव्यू कंटेंट को अपडेट करेगा
  const updatePreviewContent = useCallback(
    (content: { html: string; css: string; js: string; searchQuery: string }) => {
      setPreviewContent(content)
      setShowPreview(true)
    },
    [],
  )

  useLayoutEffect(() => {
    if (showPreview && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [showPreview])

  // Add this near other useEffect hooks
  useEffect(() => {
    const textarea = document.querySelector("textarea")
    if (textarea) {
      const adjustHeight = () => {
        textarea.style.height = "auto"
        textarea.style.height = `${textarea.scrollHeight}px`
      }

      textarea.addEventListener("input", adjustHeight)
      return () => textarea.removeEventListener("input", adjustHeight)
    }
  }, [input])

  // Handle text selection in AI messages
  const handleTextSelection = useCallback(
    (e: React.MouseEvent, messageIndex: number) => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim().length > 0) {
        const selectedText = selection.toString().trim()
        setSelectedText(selectedText)

        // Get position for the toolbar
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()

        setSelectionPosition({
          top: rect.bottom + window.scrollY + 10,
          left: rect.left + window.scrollX,
        })

        setShowSelectionToolbar(true)
        setEditingMessageIndex(messageIndex)
      } else {
        // Don't hide immediately to allow clicking the buttons
        setTimeout(() => {
          if (!showSelectionToolbar) return
          setShowSelectionToolbar(false)
        }, 100)
      }
    },
    [setSelectedText, setSelectionPosition, setShowSelectionToolbar, setEditingMessageIndex, showSelectionToolbar],
  )

  const handleEditSelectedText = (messageIndex: number) => {
    setEditedText(messages[messageIndex].content)
    setEditingMessageIndex(messageIndex)
    setIsEditDialogOpen(true)
    setShowSelectionToolbar(false)
  }

  // Handle copying the selected text
  const handleCopySelectedText = () => {
    navigator.clipboard.writeText(selectedText)
    toast({
      description: "Text copied to clipboard",
      duration: 2000,
    })
    setShowSelectionToolbar(false)
  }

  // Handle searching with the selected text
  const handleSearchSelectedText = () => {
    setInlineInput(selectedText)
    setInlinePosition(selectionPosition)
    setShowInlineTextArea(true)
    setShowSelectionToolbar(false)
  }

  // Handle sending the inline query
  const handleSendInlineQuery = async (text: string) => {
    if (!text.trim()) return

    setShowInlineTextArea(false)
    setIsThinking(true)

    // Add message with the tagged text
    await addMessage(text, "user", selectedLanguage)

    setIsThinking(false)
  }

  return (
    <div className="flex h-screen bg-[#0B0D0E] text-gray-300">
      {/* Menu Button */}
      <button
        className="fixed top-3 left-4 z-50 p-2 bg-gray-800 rounded-md hover:border hover:border-white md:absolute"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu size={20} />
      </button>

      {/* Left Sidebar */}
      {/* Sidebar Menu */}
      <div
        aria-label="Sidebar Menu"
        className={`w-64 md:w-72 lg:w-80 border-r border-gray-800 flex-shrink-0 flex flex-col h-screen bg-[#0B0D0E] transition-all duration-300 ease-in-out fixed top-0 left-0 z-40 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar content */}
        <div className="flex flex-col h-full">
          <div className="p-2 border-b border-gray-800">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 hover:bg-transparent hover:border hover:border-white"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu size={20} />
              Menu
            </Button>
          </div>
          <div className="p-2 border-b border-gray-800">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 hover:bg-transparent hover:border hover:border-white"
              onClick={clearChat}
            >
              <MessageSquare size={20} />
              New Chat
            </Button>
          </div>

          <ScrollArea className="flex-grow">
            <div className="p-2 space-y-2">
              {messages.map((message, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start text-left px-2 py-1 hover:bg-transparent hover:border hover:border-white"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium text-xs">{message.role === "user" ? "You" : "AI"}</span>
                    <span className="text-xs text-gray-500 truncate flex-grow">
                      {message.content.substring(0, 20)}...
                    </span>
                    <span className="text-xs text-gray-500">{message.metadata?.tokens || 0} tokens</span>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>

          <div className="p-2 border-t border-gray-800 mt-auto">
            <div className="text-sm font-medium mb-2">Chat History</div>
            <ScrollArea className="h-32 mb-4">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left hover:bg-transparent hover:border hover:border-white"
                >
                  <span className="truncate">Previous Chat 1</span>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left hover:bg-transparent hover:border hover:border-white"
                >
                  <span className="truncate">Previous Chat 2</span>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left hover:bg-transparent hover:border hover:border-white"
                >
                  <span className="truncate">Previous Chat 3</span>
                </Button>
              </div>
            </ScrollArea>
            <Button variant="outline" className="w-full gap-2" onClick={() => (window.location.href = "/login")}>
              <LogIn size={16} />
              Login to Sync History
            </Button>
          </div>
        </div>
      </div>

      {/* Overlay for small screens when sidebar is open */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Main Content */}
      <div className="flex-grow flex flex-col h-screen overflow-hidden w-full pl-0 md:pl-0">
        {/* Top Bar */}
        <div className="border-b border-gray-800 p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span></span>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-gray-900 hover:bg-gray-900 hover:border-white">
                  <span>{models[selectedModel]}</span>
                  <ChevronDown size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {Object.entries(models).map(([key, name]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setSelectedModel(key as ModelType)}
                    className="hover:bg-gray-700"
                  >
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-transparent hover:border hover:border-white">
                  <Settings size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[540px]">
                <SettingsMenu
                  theme={theme}
                  setTheme={setTheme}
                  selectedLanguage={selectedLanguage}
                  setSelectedLanguage={setSelectedLanguage}
                  selectedVoice={selectedVoice}
                  setSelectedVoice={setSelectedVoice}
                  availableVoices={availableVoices}
                  languages={languages}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex overflow-hidden">
          <ScrollArea className={`flex-1 p-2 ${showPreview ? "w-1/2" : "w-full"}`} ref={scrollAreaRef}>
            <div className="max-w-4xl mx-auto space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-md">Error: {error}</div>
              )}
              {messages.map((message, index) => (
                <div key={index} className="space-y-2" onMouseUp={(e) => handleTextSelection(e, index)}>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{message.role === "user" ? "You" : "Assistant"}</div>
                    {message.role === "assistant" && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-800">
                        {models[message.model as ModelType]}
                      </span>
                    )}
                  </div>
                  {message.role === "assistant" && message.model === "flux-ai" && !message.metadata?.imageUrl ? (
                    <AnimatedImageBox />
                  ) : (
                    <div>{formatMessage(message.content, message.metadata, message.attachments, index)}</div>
                  )}
                  {message.role === "assistant" && message.metadata && !message.metadata.imageUrl && (
                    <>
                      <div className="text-xs text-gray-500">
                        {message.metadata.tokensPerSecond?.toFixed(2)} tok/sec • {message.metadata.tokens} tokens •
                        {message.metadata.timeToFirstToken?.toFixed(2)}s to first token • Stop:{" "}
                        {message.metadata.stopReason}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => regenerateLastResponse()}
                          className="hover:bg-transparent hover:border hover:border-white"
                        >
                          <RotateCcw size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (isSpeaking) {
                              window.speechSynthesis.cancel()
                              setIsSpeaking(false)
                            } else {
                              speakMessage(message.content)
                            }
                          }}
                          className={`hover:bg-transparent hover:border hover:border-white ${
                            isSpeaking ? "bg-blue-500" : ""
                          }`}
                        >
                          <Volume2 size={16} className={isSpeaking ? "animate-pulse" : ""} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-transparent hover:border hover:border-white"
                        >
                          <Download size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(message.content)}
                          className="hover:bg-transparent hover:border hover:border-white"
                        >
                          <Copy size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-transparent hover:border hover:border-white"
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-transparent hover:border hover:border-white"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </>
                  )}
                  {message.role === "assistant" && message.metadata?.imageUrl && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-transparent hover:border hover:border-white"
                      >
                        <ThumbsUp size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-transparent hover:border hover:border-white"
                      >
                        <ThumbsDown size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(message.metadata?.imageUrl, "_blank")}
                        className="hover:bg-transparent hover:border hover:border-white"
                      >
                        <Maximize size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const link = document.createElement("a")
                          link.href = message.metadata?.imageUrl
                          link.download = "generated-image.png"
                          link.click()
                        }}
                        className="hover:bg-transparent hover:border hover:border-white"
                      >
                        <Download size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {isThinking && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">Assistant</div>
                    <span className="text-xs px-2 py-1 rounded bg-gray-800 animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              {isLoading && streamingMessage && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">Assistant</div>
                    <span className="text-xs px-2 py-1 rounded bg-gray-800">{models[selectedModel]}</span>
                  </div>
                  <div>{formatMessage(streamingMessage, undefined, message.attachments)}</div>
                  <div className="text-xs text-gray-500">Typing...</div>
                </div>
              )}
              {isGeneratingImage && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">Assistant</div>
                    <span className="text-xs px-2 py-1 rounded bg-gray-800">Flux AI</span>
                  </div>
                  <AnimatedImageBox />
                  <div className="text-xs text-gray-500">Generating image...</div>
                </div>
              )}
            </div>
          </ScrollArea>

          {showPreview && (
            <div className="w-1/2 border-l border-gray-800 flex flex-col" style={{ width: `${previewWidth}px` }}>
              <div className="p-2 border-b border-gray-800 flex justify-between items-center">
                <span className="font-semibold">
                  {isWebLanguage(getLanguageFromCode(previewContent.html || previewContent.css || previewContent.js))
                    ? "Preview"
                    : "Code Output"}
                </span>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-4 mr-2 cursor-ew-resize"
                    onMouseDown={(e) => handlePreviewResize(e, "width")}
                  >
                    ↔
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(false)}
                    className="hover:bg-transparent hover:border hover:border-white"
                  >
                    Close
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 p-4" style={{ height: `${previewHeight}px` }}>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-0 right-0 cursor-ns-resize"
                    onMouseDown={(e) => handlePreviewResize(e, "height")}
                  >
                    ↕
                  </Button>
                  {executionError ? (
                    <div className="text-red-500">{executionError}</div>
                  ) : isWebLanguage(
                      getLanguageFromCode(previewContent.html || previewContent.css || previewContent.js),
                    ) ? (
                    <PreviewBox {...previewContent} searchQuery={input} />
                  ) : (
                    <OutputBox output={codeOutput} />
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 p-4">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gray-900 border-gray-800 text-card-foreground">
              <div className="p-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={
                    uploadedFile
                      ? "Add a description for the image..."
                      : selectedModel === "flux-ai"
                        ? "Describe the image you want to generate..."
                        : "Type a message and press Enter to send ..."
                  }
                  className="w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-white placeholder-gray-500 resize-none overflow-hidden"
                  disabled={isLoading || isGeneratingImage}
                  rows={1}
                  style={{ minHeight: "40px", height: "auto" }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto"
                      el.style.height = `${el.scrollHeight}px`
                    }
                  }}
                />
              </div>
              <div className="border-t border-t border-gray-800 p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-transparent hover:border hover:border-white"
                    title="Insert code block"
                  >
                    <Code size={16} />
                  </Button>
                  <FileUploadButton onUpload={handleFileUpload} setInput={setInput} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleRecording}
                    className={cn(
                      "hover:bg-transparent hover:border hover:border-white",
                      isRecording && "border-red-500 text-red-500 animate-pulse",
                    )}
                  >
                    {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Insert (Ctrl + I)</span>
                  <Button
                    className="gap-2 hover:bg-gray-800 hover:border-white"
                    onClick={handleSend}
                    disabled={isLoading || isGeneratingImage || (!input.trim() && !uploadedFile)}
                  >
                    {isLoading || isGeneratingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {selectedModel === "flux-ai" ? "Generating..." : "Sending..."}
                      </>
                    ) : (
                      <>
                        {selectedModel === "flux-ai" ? (
                          <>
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Generate Image
                          </>
                        ) : (
                          "Send"
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      {showSelectionToolbar && (
        <TextSelectionToolbar
          selectedText={selectedText}
          position={selectionPosition}
          onCopy={handleCopySelectedText}
          onEdit={() => editingMessageIndex !== null && handleEditSelectedText(editingMessageIndex)}
          onSearch={handleSearchSelectedText}
          onClose={() => setShowSelectionToolbar(false)}
        />
      )}
      {showInlineTextArea && (
        <InlineTextArea
          initialText={inlineInput}
          position={inlinePosition}
          onSubmit={handleSendInlineQuery}
          onCancel={() => setShowInlineTextArea(false)}
        />
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full h-32 bg-gray-800 text-white border border-gray-700 rounded-md p-2 resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingMessageIndex !== null) {
                  setMessages((prevMessages) => {
                    const newMessages = [...prevMessages]
                    newMessages[editingMessageIndex] = {
                      ...newMessages[editingMessageIndex],
                      content: editedText,
                    }
                    return newMessages
                  })
                  setIsEditDialogOpen(false)
                  setEditingMessageIndex(null)
                  toast({
                    description: "Message updated successfully",
                    duration: 2000,
                  })
                }
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Chat

