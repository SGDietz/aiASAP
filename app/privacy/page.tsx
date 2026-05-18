import { BackToPreviousButton } from "../../src/components/BackToPreviousButton";

const sections: Array<{
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}> = [
  {
    title: "1. Overview",
    paragraphs: [
      "This Privacy Policy explains how aiASAP collects, uses, stores, and protects information when you use the aiASAP website, avatar experience, voice features, and related services.",
      "aiASAP is early-stage software. This policy reflects current practices and may evolve as the product develops.",
    ],
  },
  {
    title: "2. Information We Collect",
    paragraphs: [
      "We collect information you provide voluntarily and information generated through your use of the service.",
    ],
    bullets: [
      "Voice and conversation data: spoken interactions with the avatar are recorded and transcribed so aiASAP can understand and respond.",
      "Account information: name, email address, phone number, time zone, and preferred contact method when you choose to create an account.",
      "Reminders, lists, and notes: items you ask aiASAP to remember, including birthdays, tasks, shopping lists, and to-do items.",
      "Notification preferences: how and when you want aiASAP to reach you (text, email, phone, push, etc.).",
      "Device and session information: browser type, device type, IP address, session timestamps, and similar technical data.",
    ],
  },
  {
    title: "3. How We Use Your Information",
    paragraphs: [
      "Information is used to operate, secure, personalize, and improve aiASAP.",
    ],
    bullets: [
      "Respond to your voice requests in real time.",
      "Save your lists, reminders, and account memory across sessions.",
      "Send reminders and notifications through your chosen channels.",
      "Improve transcription accuracy, response quality, and feature design.",
      "Detect and prevent abuse, fraud, and security issues.",
    ],
  },
  {
    title: "4. Voice Recording and Transcription",
    paragraphs: [
      "When you talk to aiASAP, your audio is sent to third-party AI services for transcription and response generation. Transcripts may be stored to maintain conversation context, support your account, improve the service, and debug issues.",
      "Do not share passwords, financial account numbers, social security numbers, or highly sensitive medical information by voice unless a future feature explicitly supports it with appropriate protections.",
    ],
  },
  {
    title: "5. Data Storage",
    paragraphs: [
      "Account data, lists, reminders, and conversation transcripts are stored in secure cloud databases and storage buckets operated for aiASAP.",
      "We use industry-standard practices to protect this data, but no system is perfectly secure. You provide information at your own risk.",
    ],
  },
  {
    title: "6. Third-Party Services",
    paragraphs: [
      "aiASAP relies on third-party providers for AI inference, voice synthesis, the on-screen avatar, hosting, email, messaging, analytics, authentication, and storage.",
      "These providers process data on our behalf under their own terms and privacy practices. By using aiASAP you accept that data may flow through these providers as required to operate the service.",
    ],
  },
  {
    title: "7. Data Sharing",
    paragraphs: [
      "We do not sell your personal information.",
      "We may share data with service providers as needed to operate the product, comply with legal obligations, respond to lawful requests, or protect the rights, safety, and property of aiASAP and its users.",
    ],
  },
  {
    title: "8. Your Choices",
    bullets: [
      "You may use aiASAP without an account, with limited features.",
      "You may request deletion of your account and stored data by contacting us.",
      "You may opt out of optional notifications at any time.",
      "You control what information you share in conversation; do not share what you do not want stored.",
    ],
  },
  {
    title: "9. Children",
    paragraphs: [
      "aiASAP is not intended for use by children under 13. If you believe a child has provided personal information to aiASAP, contact us and we will take reasonable steps to delete it.",
    ],
  },
  {
    title: "10. Changes To This Policy",
    paragraphs: [
      "We may update this Privacy Policy as aiASAP evolves. Material changes will be reflected by updating the Effective Date above and, where appropriate, providing notice in the product.",
    ],
  },
  {
    title: "11. Contact",
    paragraphs: [
      "For privacy questions, data requests, or to report a concern, contact sgdietz@pm.me.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <BackToPreviousButton />
      <article className="mx-auto w-full max-w-4xl rounded-xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur sm:p-8">
        <h1 className="text-3xl font-bold tracking-normal text-white sm:text-4xl">
          aiASAP Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-zinc-300 sm:text-base">
          Effective Date: May 17, 2026
        </p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-200 sm:text-base">
          <p>
            Your privacy matters. This policy explains what we collect, how we
            use it, and the choices you have when using aiASAP.
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
            aiASAP is built to help, but it is your responsibility to decide
            what to share and to verify important information.
          </p>
        </section>
      </article>
    </div>
  );
}
