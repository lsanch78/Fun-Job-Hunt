import type { TutorialStep } from '@/types'

export const JOB_LOG_STEPS: TutorialStep[] = [
  {
    id: 'navbar',
    title: 'WELCOME',
    subtitle: 'fun job hunt',
    body: [
      'Press Space to step through. Press ? anytime to replay.',
    ],
  },
  {
    id: 'quickcast-links',
    title: 'QUICK LINKS',
    subtitle: 'one click · instant copy',
    body: [
      'Save links you paste constantly — LinkedIn, GitHub, portfolio. Click to copy. Right-click to edit.',
    ],
  },
  {
    id: 'job-rows',
    title: 'JOB LOG',
    subtitle: 'tracking rows',
    body: [
      'Tab through fields. Only Company + Title required.',
    ],
  },
  {
    id: 'job-row-context',
    title: 'RIGHT-CLICK ANY ROW',
    subtitle: 'ai · details · jd',
    body: [
      'Once you have your CV filled out, right-clicking a job row lets you tailor your resume and generate a cover letter for that specific role — instantly.',
    ],
  },
  {
    id: 'music-player',
    title: 'MUSIC',
    subtitle: 'youtube player',
    body: [
      'Hover to open. Paste any YouTube URL to queue it up.',
    ],
  },
]

export const CV_STEPS: TutorialStep[] = [
  {
    id: 'cv-header',
    title: 'YOUR CV',
    subtitle: 'the engine behind everything',
    body: [
      'Every AI feature reads your CV. Aim for 2-3 pages — the more detail you put in, the smarter your tailored resumes and cover letters will be.',
      'Think of this as your full career dump. Multiple bullet points per role, every skill, every project. When you tailor for a job, the AI automatically trims it to one page — so don\'t worry about length here.',
    ],
  },
  {
    id: 'cv-dropzone',
    title: 'IMPORT',
    subtitle: 'drag · drop · done',
    body: [
      'Drop multiple versions of your resume here — PDF, DOCX, or TXT. The AI will parse each one and help you combine all your bullet points into a single master CV.',
      'Have an old resume, a LinkedIn export, and a skills doc? Drop them all in. The more material you give it, the more complete your CV will be.',
    ],
  },
  {
    id: 'cv-header',
    title: 'BUILD MANUALLY',
    subtitle: 'add section · drag to reorder',
    body: [
      'No resume to import? Use ADD SECTION to build from scratch. Drag the handle on any section to reorder. Hit PREVIEW to see the final output.',
    ],
  },
]

export const NETWORK_STEPS: TutorialStep[] = [
  {
    id: 'navbar',
    title: 'NETWORK',
    subtitle: 'gamified relationship management',
    body: [
      'The Network page turns professional networking into an RPG. Track recruiters, hiring managers, and referrals — and grow your relationship with each one through real interactions.',
      'Every contact has an EXP bar. Successful touch points level it up — the more you engage, the stronger the relationship.',
    ],
  },
  {
    id: 'network-header',
    title: 'ADD CONTACTS',
    subtitle: 'build your network',
    body: [
      'Hit + ADD CONTACT to log a new person. Fill in their name, company, LinkedIn, and any notes. You can also link them to specific job applications.',
      'Use YOUR NETWORK to see an animated map of all your connections and how they relate to your open applications.',
    ],
  },
  {
    id: 'network-toolbar',
    title: 'SORT & FILTER',
    subtitle: 'find who matters',
    body: [
      'Sort by name, company, EXP, or date. Filter by time range to focus on recent connections. Use the search bar to find anyone fast.',
    ],
  },
  {
    id: 'network-list',
    title: 'CONTACT ROWS',
    subtitle: 'interact · detail · link',
    body: [
      'Click any row to open the full detail view — add notes, social links, and attach job applications. Enable DELETE MODE in the toolbar to remove contacts.',
    ],
  },
  {
    id: 'network-comm',
    title: 'COMM BUTTON',
    subtitle: 'mark a touch point',
    body: [
      'Every time you interact with someone — a reply, a call, a coffee chat — hit COMM to record it. Each interaction earns EXP and keeps the relationship warm.',
      'There\'s a cooldown between comms so the EXP reflects real engagement, not button mashing. Build your relationships at your own pace — this is just here to provide a helpful nudge and reminder. You can adjust the cooldown duration in Settings.',
    ],
  },
  {
    id: 'network-draft',
    title: 'DRAFT BUTTON',
    subtitle: 'instant outreach with AI',
    body: [
      'Hit DRAFT to generate a personalized outreach message on the spot. It pulls from your resume, any notes you\'ve added to the contact, and any job descriptions you have linked to this contact.',
      'The result is a concise, human-sounding message ready to send or edit. Right-click DRAFT to customize the prompt to your voice.',
    ],
  },
]


export const MOBILE_JOB_LOG_STEPS: TutorialStep[] = [
  {
    id: 'navbar',
    title: 'WELCOME',
    subtitle: 'mobile companion',
    body: [
      'Welcome to the mobile companion of FJobhunt. Use this to access your job history on the go or quickly log new applications you just applied to.',
      'This is meant to be a companion to the full FJobhunt experience on desktop — for quick reference, jotting down notes for yourself, or tracking applications to edit later.',
    ],
  },
  {
    id: 'job-rows',
    title: 'JOB LOG',
    subtitle: 'tap · add · filter',
    body: [
      'Tap any row to open the full detail view. Use the + button to log a new application fast. The ⋮ menu on each row lets you delete entries.',
      'Use the FILTER button to sort and filter by time range or status. Everything syncs automatically to your account.',
    ],
  },
]
