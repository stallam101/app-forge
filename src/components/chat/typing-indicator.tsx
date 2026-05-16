"use client"

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg w-fit">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#555] animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}
