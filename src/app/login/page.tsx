"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Zap } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    setLoading(false)

    if (res.ok) {
      router.push("/")
    } else {
      const data = await res.json()
      setError(data.error ?? "Login failed")
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-[120px] pointer-events-none" />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-white p-3 rounded-xl">
            <Zap size={24} className="text-black" fill="black" />
          </div>
        </div>
        <h1 className="text-white text-2xl font-bold text-center mb-2">AppForge</h1>
        <p className="text-zinc-400 text-center text-sm mb-8">AI-powered software factory</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#09090b] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/[0.12] focus:ring-1 focus:ring-white/10 transition-colors duration-200"
            />
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#09090b] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/[0.12] focus:ring-1 focus:ring-white/10 transition-colors duration-200"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-medium px-4 py-2 rounded-xl hover:bg-zinc-200 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
