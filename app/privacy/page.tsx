import { BackToPreviousButton } from "../../src/components/BackToPreviousButton";

const sections: Array<{
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}> = [
  {
    title: "1. What This Policy Covers",
    paragraphs: [
      "This Privacy Policy explains how aiASAP collects, uses, stores, and shares information when you use the aiASAP website, avatar experience, voice features, lists, notes, and related services.",
      "aiASAP is an early beta product. Features, providers, retention periods, and account options may change as the product develops. When they do, this policy may be updated.",
    ],
  },
  {
    title: "2. Voice And Transcript Capture",
    paragraphs: [
      "aiASAP is voice-first. When you talk to 6, your speech may be processed, transcribed, stored, reviewed, and used so the service can work.",
      "Every word you say to 6 and every word 6 says to you may be captured in a text transcript. This can include partial phrases, corrected phrases, interruptions, list commands, product feedback, and app-generated replies.",
      "If you do not want your spoken words or 6's replies captured in transcripts, do not use the voice/avatar experience.",
    ],
  },
  {
    title: "3. Information We May Collect",
    bullets: [
      "Voice input, generated speech, text transcripts, chat messages, and avatar session information.",
      "Lists, sticky notes, reminders, goals, names, contact details, preferences, and other information you choose to provide.",
      "Product feedback, bug reports, app events, list state, prompt selections, page route, browser or device information, timestamps, and usage logs.",
      "Account information if account features are enabled, such as name, email address, phone number, authentication state, and saved settings.",
      "Information processed by third-party services that help provide AI, voice, avatar, transcription, hosting, storage, logging, messaging, authentication, payments, or security features.",
    ],
  },
  {
    title: "4. How We Use Information",
    bullets: [
      "Operate the voice assistant, avatar, lists, notes, prompts, accounts, and other requested features.",
      "Store transcripts and app events so aiASAP can debug problems, understand what happened, and improve the product.",
      "Review real conversations and product feedback to make 6 better, fix failures, improve prompts, improve list behavior, and train or evaluate the service.",
      "Personalize the experience, remember session context, and support future account and memory features when available.",
      "Secure the service, detect abuse, investigate outages, enforce terms, and comply with legal obligations.",
    ],
  },
  {
    title: "5. Sensitive Information",
    paragraphs: [
      "Do not provide passwords, financial account numbers, social security numbers, government identification numbers, private medical details, private legal details, or other highly sensitive information unless a future feature explicitly supports it with appropriate protections.",
      "If you say sensitive information during a voice session, it may still appear in transcripts or logs. Avoid saying anything you do not want stored or reviewed.",
    ],
  },
  {
    title: "6. Sharing And Third-Party Services",
    paragraphs: [
      "aiASAP may share information with service providers that help run the product, including providers for AI, voice, avatars, transcription, hosting, databases, storage, logging, analytics, messaging, authentication, and payments.",
      "These providers may process information according to their own terms and privacy practices. aiASAP does not sell personal information as a data broker.",
      "aiASAP may also disclose information if required by law, to protect users or the service, to investigate abuse or security issues, or as part of a future business transfer.",
    ],
  },
  {
    title: "7. Storage And Retention",
    paragraphs: [
      "During the beta, transcripts, app events, feedback, list state, and related logs may be stored for product operation, debugging, evaluation, and improvement.",
      "Retention periods are not final yet. Some information may be kept as long as reasonably needed for the product, legal, security, business, or improvement purposes, unless deletion is requested and deletion is legally required or technically feasible.",
    ],
  },
  {
    title: "8. Your Choices",
    bullets: [
      "You can choose not to use the voice/avatar experience if you do not want speech transcribed or stored.",
      "You can avoid providing sensitive information.",
      "You can contact aiASAP to request access, correction, deletion, or other help with your information.",
      "Some requests may be limited by legal, security, technical, backup, abuse-prevention, or product-operation requirements.",
    ],
  },
  {
    title: "9. Children",
    paragraphs: [
      "aiASAP is not directed to children under 13. Children under 13 should not use aiASAP or provide personal information.",
    ],
  },
  {
    title: "10. State And Regional Privacy Rights",
    paragraphs: [
      "Depending on where you live and which laws apply, you may have rights to know, access, correct, delete, or limit certain uses of your personal information. You may also have rights related to sale or sharing of personal information.",
      "To make a privacy request, contact aiASAP using the contact information below.",
    ],
  },
  {
    title: "11. Security",
    paragraphs: [
      "aiASAP uses technical and organizational measures intended to protect information, but no internet service is perfectly secure. Do not provide information that you would not want stored or processed by an early beta product.",
    ],
  },
  {
    title: "12. Changes To This Policy",
    paragraphs: [
      "aiASAP may update this Privacy Policy as the product, providers, features, laws, and business practices change. The effective date above shows when this version took effect.",
    ],
  },
  {
    title: "13. Contact",
    paragraphs: [
      "For privacy requests or questions, contact aiASAP@pm.me.",
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
          Effective Date: May 5, 2026
        </p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-200 sm:text-base">
          <p>
            This policy is written for where aiASAP is today: a voice-first beta
            that stores transcripts and app events so the product can work and
            improve.
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
      </article>
    </div>
  );
}
