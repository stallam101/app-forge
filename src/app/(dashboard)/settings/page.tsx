import { SettingsForm } from "@/components/dashboard/settings-form"

export default function SettingsPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-white text-[18px] font-medium mb-2">Settings</h1>
      <p className="text-[#555] text-sm mb-6">
        API keys are encrypted at rest (AES-256-GCM). Values are never sent back from the server.
      </p>
      <SettingsForm />
    </div>
  )
}
