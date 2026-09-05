type LegalBlock = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const blocks: LegalBlock[] = [
  {
    id: "recording-transcripts-data-use",
    title: "Recording, Transcripts, And Data Use",
    paragraphs: [
      "Conversations and interactions with aiASAP may be recorded, transcribed, stored, analyzed, and used to operate, secure, improve, and train the service.",
      "Do not provide passwords, financial account numbers, social security numbers, private medical details, or other highly sensitive information unless a future feature explicitly supports it with appropriate protections.",
      "When you talk to aiASAP, your audio is sent to third-party AI services for transcription and response generation. Transcripts may be stored to maintain conversation context, support your account, improve the service, and debug issues.",
      "Do not share passwords, financial account numbers, social security numbers, or highly sensitive medical information by voice unless a future feature explicitly supports it with appropriate protections.",
    ],
  },
  {
    id: "voice-conversation",
    title: "Your Voice Conversation, In Plain English",
    bullets: [
      "We write down the voice conversation so we can build your brand and your website.",
      "People on the team do not read your full transcript. They work from short AI summaries.",
      "Your words and your photos go on a public page only after you say yes.",
      "You can tell 6 to stop at any time, and you can ask us to archive and remove your live data.",
      "6 says a short version of this out loud before the first real question, so you do not have to find this page to know it.",
    ],
  },
  {
    id: "privacy-consent",
    title: "Privacy And Your Choices",
    paragraphs: [
      "This Privacy Policy explains how aiASAP collects, uses, stores, and protects information when you use the aiASAP website, avatar experience, voice features, and related services.",
      "aiASAP is early-stage software. This policy reflects current practices and may evolve as the product develops.",
      "Your privacy matters. This policy explains what we collect, how we use it, and the choices you have when using aiASAP.",
    ],
    bullets: [
      "You may use aiASAP without an account, with limited features.",
      "You may request deletion of your account and stored data by contacting us.",
      "You may opt out of optional notifications at any time.",
      "Requesting follow-up about a build is not blanket consent to unrelated marketing.",
      "You control what information you share in conversation; do not share what you do not want stored.",
    ],
  },
  {
    id: "information-we-collect",
    title: "Information We Collect",
    paragraphs: [
      "We collect information you provide voluntarily and information generated through your use of the service.",
    ],
    bullets: [
      "Voice and conversation data: spoken interactions with the avatar are recorded and transcribed so aiASAP can understand and respond.",
      "Account information: name, email address, phone number, time zone, and preferred contact method when you choose to create an account.",
      "Build and follow-up information: a concise project summary and an email address or phone number only when you explicitly request personal follow-up without creating an account.",
      "Reminders, lists, and notes: items you ask aiASAP to remember, including birthdays, tasks, shopping lists, and to-do items.",
      "Notification preferences: how and when you want aiASAP to reach you (text, email, phone, push, etc.).",
      "Device and session information: browser type, device type, IP address, session timestamps, and similar technical data.",
    ],
  },
  {
    id: "how-we-use-information",
    title: "How We Use Your Information",
    paragraphs: ["Information is used to operate, secure, personalize, and improve aiASAP."],
    bullets: [
      "Respond to your voice requests in real time.",
      "Save your lists, reminders, and account memory across sessions.",
      "Send reminders and notifications through your chosen channels.",
      "Improve transcription accuracy, response quality, and feature design.",
      "Detect and prevent abuse, fraud, and security issues.",
      "Prepare and follow up on a brand or website build request you explicitly submit.",
      "When an authenticated client who is authorized to train an avatar uses Training Mode, the conversation may automatically create editable learned preferences, facts, sales language, and business context for that client's avatar. Public visitors cannot use Training Mode to train or rewrite an avatar.",
      "Authorized trainers can review learned items, correct them, disable them, or delete them. Deleting an item stops it from being used going forward; existing conversation records are handled under the applicable account-data controls.",
    ],
  },
  {
    id: "storage-sharing-providers",
    title: "Storage, Sharing, And Service Providers",
    paragraphs: [
      "Account data, lists, reminders, and conversation transcripts are stored in secure cloud databases and storage buckets operated for aiASAP.",
      "We use industry-standard practices to protect this data, but no system is perfectly secure. You provide information at your own risk.",
      "We do not sell your personal information.",
      "We may share data with service providers as needed to operate the product, comply with legal obligations, respond to lawful requests, or protect the rights, safety, and property of aiASAP and its users.",
      "aiASAP relies on third-party providers for AI inference, voice synthesis, the on-screen avatar, hosting, email, messaging, analytics, authentication, and storage.",
      "These providers process data on our behalf under their own terms and privacy practices. By using aiASAP you accept that data may flow through these providers as required to operate the service.",
    ],
  },
  {
    id: "ownership",
    title: "Your Rights: Paid Project Ownership",
    paragraphs: [
      "The team at aiASAP considers this a simple fee for service. This is a legally binding electronic agreement. You have the opportunity to review the terms, then accept them by affirmatively clicking ‘I Agree’ and submitting payment. Once aiASAP completes the agreed services and receives the full agreed price in cleared funds, the written assignment electronically executed by aiASAP transfers to you every right aiASAP owns and can convey in the client-specific material identified for that deliverable. aiASAP is paid for the service and keeps no ownership stake, royalty, profit share, equity, revenue share, or claim on your business, brand, or future success.",
      "Definitions for the electronically accepted agreement: Deliverable means a final item or completed project phase identified by a durable unique reference in the applicable order, statement of work, or delivery manifest. Client-Specific Material means material created specifically for that client, expressly identified for that Deliverable, and excludes Background Materials and Third-Party Materials. Background Materials means aiASAP's pre-existing or reusable platform, software, tools, templates, methods, workflows, systems, and know-how, including the aiASAP brand and digit 6 character and brand assets. Third-Party Materials means client-supplied, open-source, or other material owned or licensed by someone other than aiASAP. AI-only material that may not qualify for copyright is not represented as exclusively owned Client-Specific Material.",
      "Each paid commissioned project uses a clickwrap agreement electronically accepted by the customer and electronically executed by aiASAP or its authorized signatory. Before assent, the full terms must be presented or clearly linked, and the affirmative acceptance control must start unchecked and require the customer's intentional click on ‘I Agree.’ The system must retain an accessible, accurately reproducible record tying together the exact terms, version and hash, assent date and time, customer or account identity, payment and order reference, delivery manifest, and aiASAP authorized countersignature. The evidence record must avoid personal data that is not reasonably necessary for attribution and enforcement.",
      "The customer's clickwrap assent does not by itself execute a transfer under 17 U.S.C. §204. The rights owner must execute the written assignment. aiASAP forms or countersigns the agreement through an attributable electronic signature of an authorized signatory, and the system retains that execution record with the accepted agreement.",
      "Each electronically executed client agreement must identify the Client-Specific Material for each Deliverable by its order, statement of work, or delivery-manifest reference and include this springing written assignment: Effective automatically only when aiASAP has completed the agreed services and received the full agreed price for that specific Deliverable in settled, cleared funds, aiASAP hereby assigns to Client all right, title, and interest that aiASAP owns in the Client-Specific Material identified for that Deliverable, including the assignable copyrights and exclusive rights under 17 U.S.C. §106, subject to nonwaivable statutory rights.",
      "If payment reverses, is charged back, is refunded, or otherwise remains unpaid before the assignment vests, the assignment never vests for that affected unpaid Deliverable. Until vesting, the client receives only a limited, nonexclusive, nontransferable license to review and evaluate that Deliverable internally and may not publish, distribute, exploit, or use it in production. This does not reach the client's pre-existing business, client-supplied materials, unrelated work, or any other Deliverable whose assignment has vested.",
      "Work planned for an unpaid future project phase is not included in a completed paid Deliverable and is not assigned. Each phase must be separately identified in its order, statement of work, or delivery manifest before its assignment can vest.",
      "Once an assignment has vested, a later payment reversal is a payment breach and remedies issue under the electronically executed agreement and applicable law; it does not automatically suspend, rescind, or claw back the transferred ownership. Any remedy preserves nonwaivable consumer dispute rights and must be reviewed by qualified intellectual-property and consumer counsel before deployment.",
      "The electronically executed agreement must also include this fallback: To the extent any Client-Specific Material validly qualifies as a work made for hire under 17 U.S.C. §§101 and 201(b), the parties expressly agree that it is commissioned as such; otherwise, the foregoing assignment controls. Work-made-for-hire status is not the sole transfer mechanism.",
      "Before aiASAP treats contributed material as assignable, each human employee, contractor, or subcontractor in the contribution chain must have assigned the relevant rights to aiASAP in a signed writing. If that chain is not secured, aiASAP must not represent that it can assign those rights.",
      "Payment or file delivery by itself does not automatically transfer every possible copyright or other intellectual-property right. Delivery of editable or source files is separate from copyright ownership, and the electronically executed agreement must list which files and formats are included. If another executed document is legally required to complete an assignment, aiASAP will provide it.",
      "Background Materials, the aiASAP name and marks, and the digit 6 character and brand are not Client-Specific Material and are not assigned. When Background Materials are embedded and necessary to use a Deliverable, the electronically executed agreement must grant the client a worldwide, nonexclusive, royalty-free license to use, reproduce, display, distribute, modify, and permit service providers to maintain those embedded materials solely as part of or as necessary to use the Deliverable, subject to the agreement and nonwaivable law.",
      "Third-Party Materials remain subject to their licenses and existing owners' rights, and the electronically executed agreement must list the applicable licenses. aiASAP can assign only rights it actually owns and can legally convey. AI-generated elements may be uncopyrightable or nonexclusive without sufficient human authorship, and no agreement can create rights that the law does not recognize.",
      "The paid-service relationship carries no aiASAP equity, royalty, revenue share, profit share, success fee, or claim on the client's business, brand, or future success. This does not guarantee revenue, customers, profit, valuation, investment, or any other business result.",
      "The assignment language is drafted for review by qualified U.S. intellectual-property counsel before use as a final client agreement. This public summary is not a legal opinion or a substitute for reviewing and electronically accepting the project-specific agreement.",
      "aiASAP, its software, platform, reusable tools, workflows, interface, brand, and digit 6 character remain protected. You may not copy, scrape, reverse engineer, exploit, or redistribute them without permission. aiASAP is a trademark of DietzX.",
    ],
  },
  {
    id: "terms",
    title: "Terms Of Use",
    paragraphs: [
      "Welcome to aiASAP. These terms apply to this website, avatar experience, and related services.",
      "By using aiASAP, you agree to these terms. If you do not agree, do not use the service.",
      "aiASAP is a voice-first AI assistant designed to help users remember important tasks, create lists, set reminders, and make everyday life easier.",
      "aiASAP may help collect information such as names, phone numbers, email addresses, reminder details, dates, times, and notification preferences when users voluntarily provide them.",
      "Some features may require an account so aiASAP can remember you across sessions.",
      "Information you provide may be stored so aiASAP can personalize help, maintain reminders, improve the product, and support requested services.",
      "aiASAP is early-stage software. Features may change, break, pause, be limited, or be discontinued at any time.",
    ],
  },
  {
    id: "reminders-notifications",
    title: "Reminders And Notifications",
    paragraphs: [
      "aiASAP may offer reminders by text message, email, phone call, Telegram, Messenger, WhatsApp, Signal, app notifications, or other channels as the product develops.",
      "Reminders are provided as a convenience and are not guaranteed. You remain responsible for important deadlines, appointments, birthdays, obligations, and tasks.",
    ],
  },
  {
    id: "third-party-terms",
    title: "Third-Party Terms",
    paragraphs: [
      "aiASAP may rely on third-party services for AI, voice, avatars, messaging, email, phone calls, hosting, analytics, storage, authentication, and payments.",
      "Those services may have their own terms and privacy practices.",
    ],
  },
  {
    id: "professional-advice",
    title: "No Professional Advice",
    paragraphs: [
      "aiASAP provides general information and assistance only. It does not provide legal, medical, financial, emergency, or other regulated professional advice.",
      "You are responsible for your decisions, actions, and verification of important information.",
    ],
  },
  {
    id: "disclaimer-liability",
    title: "Disclaimer And Limitation Of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, aiASAP is provided as-is and without warranties.",
      "aiASAP is not liable for missed reminders, incorrect information, service outages, user decisions, third-party service failures, or any direct or indirect damages arising from use of the service.",
      "aiASAP is built to help, but it is not a substitute for your own judgment or responsibility.",
      "aiASAP is built to help, but it is your responsibility to decide what to share and to verify important information.",
    ],
  },
  {
    id: "children",
    title: "Children",
    paragraphs: [
      "aiASAP is not intended for use by children under 13. If you believe a child has provided personal information to aiASAP, contact us and we will take reasonable steps to delete it.",
    ],
  },
  {
    id: "changes-governing-law",
    title: "Changes And Governing Law",
    paragraphs: [
      "We may update this Privacy Policy as aiASAP evolves. Material changes will be reflected by updating the Effective Date above and, where appropriate, providing notice in the product.",
      "These terms are governed by the laws of the State of Wyoming, except where non-waivable federal law or other mandatory law applies.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "For legal, privacy, or bug-report inquiries, contact aiASAP@pm.me.",
      "For privacy questions, data requests, or to report a concern, contact aiASAP@pm.me.",
    ],
  },
];

const priorityLinks = [
  ["recording-transcripts-data-use", "Recording & data use"],
  ["privacy-consent", "Privacy & consent"],
  ["ownership", "Ownership"],
  ["terms", "Terms"],
  ["professional-advice", "Disclaimers"],
] as const;

const backClass =
  "inline-flex min-h-11 items-center rounded border-2 border-black px-4 py-2 text-base font-bold text-black underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black dark:border-white dark:text-white dark:focus-visible:outline-white";

export default function LegalPage() {
  return (
    <main className="min-h-screen w-full bg-white px-4 py-6 text-black [color-scheme:light] dark:bg-black dark:text-white dark:[color-scheme:dark] sm:px-6 sm:py-10">
      <article className="mx-auto max-w-3xl">
        <a href="/" className={backClass}>← Back to aiASAP</a>

        <header className="mt-7 border-b-2 border-black pb-6 dark:border-white">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">aiASAP Terms / Legal</h1>
          <p className="mt-3 text-base leading-7">
            Terms effective April 24, 2026. Privacy Policy effective May 17, 2026.
          </p>
          <nav aria-label="Legal page sections" className="mt-5">
            <p className="font-bold">Important sections</p>
            <ul className="mt-2 grid gap-2 text-base leading-7 sm:grid-cols-2">
              {priorityLinks.map(([id, label]) => (
                <li key={id}>
                  <a className="underline decoration-2 underline-offset-4" href={`#${id}`}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <div className="space-y-10 py-8 text-base leading-7 sm:text-[17px] sm:leading-8">
          {blocks.map((block) => (
            <section id={block.id} key={block.id} className="scroll-mt-4" tabIndex={-1}>
              <h2 className="text-2xl font-bold leading-tight">{block.title}</h2>
              {block.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-4">{paragraph}</p>
              ))}
              {block.bullets && (
                <ul className="mt-4 list-disc space-y-2 pl-6">
                  {block.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <a href="/" className={`${backClass} mb-8`}>← Back to aiASAP</a>
      </article>
    </main>
  );
}
