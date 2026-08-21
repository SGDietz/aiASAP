import { BackToPreviousButton } from "../../src/components/BackToPreviousButton";

const sections: Array<{
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}> = [
  {
    title: "1. Acceptance Of Terms",
    paragraphs: [
      "By using aiASAP, you agree to these terms. If you do not agree, do not use the service.",
    ],
  },
  {
    title: "2. What aiASAP Does",
    paragraphs: [
      "aiASAP is a voice-first AI assistant designed to help users remember important tasks, create lists, set reminders, and make everyday life easier.",
      "aiASAP may help collect information such as names, phone numbers, email addresses, reminder details, dates, times, and notification preferences when users voluntarily provide them.",
    ],
  },
  {
    title: "3. No Professional Advice",
    paragraphs: [
      "aiASAP provides general information and assistance only. It does not provide legal, medical, financial, emergency, or other regulated professional advice.",
      "You are responsible for your decisions, actions, and verification of important information.",
    ],
  },
  {
    title: "4. Reminders And Notifications",
    paragraphs: [
      "aiASAP may offer reminders by text message, email, phone call, Telegram, Messenger, WhatsApp, Signal, app notifications, or other channels as the product develops.",
      "Reminders are provided as a convenience and are not guaranteed. You remain responsible for important deadlines, appointments, birthdays, obligations, and tasks.",
    ],
  },
  {
    title: "5. Accounts And Memory",
    paragraphs: [
      "Some features may require an account so aiASAP can remember you across sessions.",
      "Information you provide may be stored so aiASAP can personalize help, maintain reminders, improve the product, and support requested services.",
    ],
  },
  {
    title: "6. Data Use",
    paragraphs: [
      "Conversations and interactions with aiASAP may be recorded, transcribed, stored, analyzed, and used to operate, secure, improve, and train the service.",
      "Do not provide passwords, financial account numbers, social security numbers, private medical details, or other highly sensitive information unless a future feature explicitly supports it with appropriate protections.",
    ],
  },
  // Added 2026-08-21. G asked whether the footer Terms link was enough for a
  // product where the whole conversation is transcribed. It is not on its own —
  // somebody using this in the car never sees the bottom of a page — so 6 now
  // says a short version out loud before the first real question. This section
  // is the written half of that same promise, in plain English rather than
  // legal English, and it states the commitments we actually make.
  {
    title: "7. Your Voice Conversation, In Plain English",
    bullets: [
      "We write down the voice conversation so we can build your brand and your website.",
      "People on the team do not read your full transcript. They work from short AI summaries.",
      "Your words and your photos go on a public page only after you say yes.",
      "You can tell 6 to stop at any time, and you can ask us to archive and remove your live data.",
      "6 says a short version of this out loud before the first real question, so you do not have to find this page to know it.",
    ],
  },
  {
    title: "8. Third-Party Services",
    paragraphs: [
      "aiASAP may rely on third-party services for AI, voice, avatars, messaging, email, phone calls, hosting, analytics, storage, authentication, and payments.",
      "Those services may have their own terms and privacy practices.",
    ],
  },
  {
    title: "9. Intellectual Property",
    paragraphs: [
      "aiASAP, its branding, software, workflows, AI systems, interface, and related content are owned by aiASAP or the Creator/Builder/Founder/Financier/CEO aiASAP unless otherwise stated.",
      "aiASAP is a trademark of DietzX.",
      "You may not copy, scrape, reverse engineer, exploit, or redistribute the service without permission.",
    ],
  },
  {
    title: "10. Service Changes",
    paragraphs: [
      "aiASAP is early-stage software. Features may change, break, pause, be limited, or be discontinued at any time.",
    ],
  },
  {
    title: "11. Limitation Of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, aiASAP is provided as-is and without warranties.",
      "aiASAP is not liable for missed reminders, incorrect information, service outages, user decisions, third-party service failures, or any direct or indirect damages arising from use of the service.",
    ],
  },
  {
    title: "12. Governing Law",
    paragraphs: ["These terms are governed by the laws of the State of Maryland."],
  },
  {
    title: "13. Contact",
    paragraphs: [
      "For legal, privacy, or bug-report inquiries, contact aiASAP@pm.me.",
    ],
  },
];

export default function LegalPage() {
  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <BackToPreviousButton />
      <article className="mx-auto w-full max-w-4xl rounded-xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur sm:p-8">
        <h1 className="text-3xl font-bold tracking-normal text-white sm:text-4xl">
          aiASAP Terms
        </h1>
        <p className="mt-3 text-sm text-zinc-300 sm:text-base">
          Effective Date: April 24, 2026
        </p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-200 sm:text-base">
          <p>
            Welcome to aiASAP. These terms apply to this website, avatar
            experience, and related services.
          </p>
        </div>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-white sm:text-xl">
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 text-sm leading-relaxed text-zinc-200 sm:text-base"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-1 pl-6 text-sm leading-relaxed text-zinc-200 sm:text-base">
                  {section.bullets.map((bullet) => (
                    <li key={`${section.title}-${bullet}`}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <section className="mt-10 border-t border-white/10 pt-6">
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            Final Note
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-200 sm:text-base">
            aiASAP is built to help, but it is not a substitute for your own
            judgment or responsibility.
          </p>
        </section>
      </article>
    </div>
  );
}
