"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Save } from "lucide-react"

interface SecretField {
  key: string
  label: string
  placeholder: string
  value: string
  isVisible: boolean
}

const SECRET_FIELDS: Omit<SecretField, "value" | "isVisible">[] = [
  { key: "GITHUB_TOKEN", label: "GitHub Token", placeholder: "ghp_..." },
  { key: "VERCEL_TOKEN", label: "Vercel Token", placeholder: "..." },
  { key: "X_API_KEY", label: "X API Key", placeholder: "..." },
  { key: "NVIDIA_API_KEY", label: "NVIDIA API Key", placeholder: "nvapi-..." },
]

export default function SettingsPage() {
  const [secrets, setSecrets] = useState<SecretField[]>(
    SECRET_FIELDS.map((f) => ({ ...f, value: "", isVisible: false }))
  )
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  useEffect(() => {
    fetchSecrets()
  }, [])

  async function fetchSecrets() {
    const res = await fetch("/api/secrets")
    const json = await res.json()
    if (json.success) {
      setSecrets((prev) =>
        prev.map((s) => ({
          ...s,
          value: json.data[s.key] ? "••••••••" : "",
        }))
      )
    }
  }

  function updateSecret(key: string, value: string) {
    setSecrets((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    )
  }

  function toggleVisibility(key: string) {
    setSecrets((prev) =>
      prev.map((s) => (s.key === key ? { ...s, isVisible: !s.isVisible } : s))
    )
  }

  async function handleSave() {
    const toSave = secrets
      .filter((s) => s.value && s.value !== "••••••••")
      .reduce<Record<string, string>>((acc, s) => {
        acc[s.key] = s.value
        return acc
      }, {})

    if (Object.keys(toSave).length === 0) return

    const res = await fetch("/api/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSave),
    })

    if (res.ok) {
      setSaveStatus("Saved!")
      setTimeout(() => setSaveStatus(null), 2000)
      await fetchSecrets()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage API keys and tokens used by agents
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-lg space-y-6">
          <div className="rounded-lg border p-4">
            <h2 className="mb-4 text-sm font-medium">API Keys & Tokens</h2>
            <div className="space-y-4">
              {secrets.map((secret) => (
                <div key={secret.key} className="space-y-1.5">
                  <Label htmlFor={secret.key} className="text-xs">
                    {secret.label}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={secret.key}
                      type={secret.isVisible ? "text" : "password"}
                      placeholder={secret.placeholder}
                      value={secret.value}
                      onChange={(e) => updateSecret(secret.key, e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleVisibility(secret.key)}
                    >
                      {secret.isVisible ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={handleSave} size="sm">
                <Save className="size-3.5" data-icon="inline-start" />
                Save All
              </Button>
              {saveStatus && (
                <span className="text-xs text-green-600">{saveStatus}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
