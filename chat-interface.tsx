"use client"

import React from "react"

import { useState, useRef, type KeyboardEvent, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
  ChevronDown,
  Copy,
  Download,
  FileText,
  MessageSquare,
  PanelLeft,
  RotateCcw,
  Settings,
  Trash2,
  Menu,
  Upload,
  Moon,
  Sun,
  Globe,
} from "lucide-react"
import { useChat } from "./hooks/use-chat"
import type { ModelType } from "./types/chat"
import { useToast } from "@/components/ui/use-toast"
import { useTheme } from "next-themes"

// Add this new component
const FileUploadButton = ({ onUpload }: { onUpload: (file: File) => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onUpload(file)
    }
  }

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} />
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        className="hover:bg-transparent hover:border hover:border-white"
      >
        <Upload size={16} />
      </Button>
    </>
  )
}

const Chat: React.FC = () => {
  const [input, setInput] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isThinking, setIsThinking] = useState(false) // Added state variable
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
    uploadedFiles,
    streamingMessage,
  } = useChat()
  const { setTheme, theme } = useTheme()
  const [selectedLanguage, setSelectedLanguage] = useState("english")

  const languages = [
    { value: "english", label: "English" },
    { value: "hindi", label: "हिन्दी" },
    { value: "japanese", label: "日本語" },
    { value: "chinese", label: "中文" },
    { value: "french", label: "Français" },
  ]

  const handleSend = async () => {
    if (!input.trim()) return

    const message = input
    setInput("")
    setIsThinking(true)
    await addMessage(message, "user", selectedLanguage) // Pass the selected language
    setIsThinking(false)
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast({
      description: "Copied to clipboard",
      duration: 2000,
    })
  }

  const models: Record<ModelType, string> = {
    gemini: "Gemini Pro",
    llama: "Llama 3.2 1B",
    "gpt-4": "GPT-4",
    mixtral: "Deepdeek-90B-vision",
  }

  // Add this function
  const handleFileUpload = useCallback(
    (file: File) => {
      uploadFile(file)
    },
    [uploadFile],
  )

  // Modify the formatMessage function
  const formatMessage = (content: string) => {
    const lines = content.split("\n")
    return lines.map((line, lineIndex) => (
      <React.Fragment key={lineIndex}>
        {lineIndex > 0 && <br />}
        {line.split(" ").map((word, wordIndex, array) => {
          if (word.startsWith("**")) {
            return (
              <React.Fragment key={wordIndex}>
                {wordIndex !== 0 && <br />}
                {word.slice(2)}
                {wordIndex < array.length - 1 && " "}
              </React.Fragment>
            )
          }
          return (
            <React.Fragment key={wordIndex}>
              {word}
              {wordIndex < array.length - 1 && " "}
            </React.Fragment>
          )
        })}
      </React.Fragment>
    ))
  }

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex h-screen bg-[#0B0D0E] text-gray-300">
      {/* Sidebar toggle button for small screens */}
      <button
        className="md:hidden fixed top-2 left-2 z-50 p-2 bg-gray-800 rounded-md hover:border hover:border-white"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu size={20} />
      </button>

      {/* Left Sidebar */}
      <div
        className={`w-64 md:w-72 lg:w-80 border-r border-gray-800 flex-shrink-0 flex flex-col h-screen bg-[#0B0D0E] transition-all duration-300 ease-in-out fixed top-0 left-0 z-50 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:translate-x-0`}
      >
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
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {/* This is a placeholder. You'll need to implement actual chat history logic */}
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
          </div>
        </div>
      </div>

      {/* Overlay for small screens when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <div className="flex-grow flex flex-col h-screen overflow-hidden w-full">
        {/* Top Bar */}
        <div className="border-b border-gray-800 p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Chat</span>
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-transparent hover:border hover:border-white">
                  <Settings size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Globe className="mr-2 h-4 w-4" />
                    Language: {languages.find((lang) => lang.value === selectedLanguage)?.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {languages.map((lang) => (
                      <DropdownMenuItem key={lang.value} onClick={() => setSelectedLanguage(lang.value)}>
                        {lang.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {/*<div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="hover:bg-transparent hover:border hover:border-white">
                <Settings size={20} />
              </Button>
              <Button variant="ghost" size="icon" className="hover:bg-transparent hover:border hover:border-white">
                <Beaker size={20} />
              </Button>
            </div>*/}
          </div>
        </div>

        {/* Chat Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="max-w-4xl mx-auto space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-md">Error: {error}</div>
            )}
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{message.role === "user" ? "You" : "Assistant"}</div>
                  {message.role === "assistant" && (
                    <span className="text-xs px-2 py-1 rounded bg-gray-800">{models[message.model as ModelType]}</span>
                  )}
                </div>
                <div>{formatMessage(message.content)}</div>
                {message.role === "assistant" && message.metadata && (
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
                        className="hover:bg-transparent hover:border hover:border-white"
                      >
                        <PanelLeft size={16} />
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
                        <FileText size={16} />
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
              </div>
            ))}
            {isThinking && ( // Added thinking indicator
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
                <div>{formatMessage(streamingMessage)}</div>
                <div className="text-xs text-gray-500">Typing...</div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-gray-800 p-4">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gray-900 border-gray-800 text-card-foreground">
              <div className="p-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message and press Enter to send ..."
                  className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-white placeholder-gray-500"
                  disabled={isLoading}
                />
              </div>
              <div className="border-t border-gray-800 p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:bg-transparent hover:border hover:border-white"
                  >
                    User (Ctrl + U)
                  </Button>
                  <FileUploadButton onUpload={handleFileUpload} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Insert (Ctrl + I)</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="gap-2 hover:bg-gray-800 hover:border-white"
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                      >
                        {isLoading ? "Sending..." : "Send"}
                        <ChevronDown size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={handleSend} className="hover:bg-gray-700">
                        Send as User
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addMessage(input, "system")} className="hover:bg-gray-700">
                        Send as System
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
            <div className="text-xs text-gray-500 text-right mt-1">
              Context is {((messages.length / 100) * 100).toFixed(1)}% full
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chat

