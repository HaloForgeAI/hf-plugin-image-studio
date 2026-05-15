import { Sparkles } from "lucide-react";

export function StudioHero() {
  return (
    <section className="hfis-hero">
      <div>
        <p className="hfis-kicker"><Sparkles size={14} /> Professional image generation</p>
        <h2>Create icons, concepts, and production-ready visual assets.</h2>
        <p>Use enterprise-managed OpenAI-compatible image models without exposing upstream API keys to the plugin.</p>
      </div>
    </section>
  );
}
