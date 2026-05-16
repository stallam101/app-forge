"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

interface FieldDef {
  key: string
  label: string
  hint: string
}

const FIELDS: FieldDef[] = [
  { key: "GITHUB_TOKEN", label: "GITHUB_TOKEN", hint: "GitHub PAT — repo creation and push access for Generation" },
  { key: "VERCEL_TOKEN", label: "VERCEL_TOKEN", hint: "Vercel token — deployment for Generation and Maintain" },
]

export function SettingsForm() {
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null)

  useEffect(() => {
    fetch("/api/secrets")
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((d) => setConfigured(d.data ?? {}))
      .catch(() => {})
  }, [])

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setToast(null)
    const payload: Record<string, string> = {}
    for (const [k, v] of Object.entries(values)) {
      const trimmed = v.trim()
      if (trimmed.length > 0) payload[k] = trimmed
    }
    if (Object.keys(payload).length === 0) {
      setSaving(false)
      setToast({ kind: "err", msg: "Nothing to save — enter at least one key." })
      return
    }
    try {
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setToast({ kind: "err", msg: "Save failed." })
      } else {
        setConfigured((prev) => ({
          ...prev,
          ...Object.fromEntries(Object.keys(payload).map((k) => [k, true])),
        }))
        setValues({})
        setToast({ kind: "ok", msg: "Saved." })
        setTimeout(() => setToast(null), 3000)
      }
    } catch {
      setToast({ kind: "err", msg: "Network error." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {FIELDS.map((f) => {
        const isConfigured = !!configured[f.key]
        const isRevealed = !!revealed[f.key]
        return (
          <div key={f.key} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label htmlFor={f.key} className="text-white text-[13px] font-medium">
                {f.label}
              </label>
              {isConfigured && (
                <span className="text-[#22c55e] text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  configured
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id={f.key}
                type={isRevealed ? "text" : "password"}
                autoComplete="off"
                placeholder={isConfigured ? "•••••••• (replace)" : "Enter value"}
                value={values[f.key] ?? ""}
                onChange={(e) => update(f.key, e.target.value)}
                className="w-full h-9 px-3 pr-10 bg-[#0a0a0a] border border-[#1a1a1a] rounded-md text-white text-[13px] placeholder:text-[#555] focus:outline-none focus:border-[#333]"
              />
              <button
                type="button"
                onClick={() =>
                  setRevealed((prev) => ({ ...prev, [f.key]: !prev[f.key] }))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
                aria-label={isRevealed ? "Hide" : "Show"}
              >
                {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[#555] text-[11px]">{f.hint}</p>
          </div>
        )
      })}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="h-8 px-4 rounded-md text-[12px] font-medium text-black bg-white hover:bg-[#ddd] disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {toast && (
          <span
            className={
              toast.kind === "ok"
                ? "text-[#22c55e] text-[12px]"
                : "text-[#ef4444] text-[12px]"
            }
          >
            {toast.msg}
          </span>
        )}
      </div>
    </form>
  )
}
