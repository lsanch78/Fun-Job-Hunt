import { PRO_PRICE_LABEL } from '@/config/pricing'

export interface TutorialStep {
  id: string
  title: string
  subtitle: string
  body: string[]
}

export const JOB_LOG_STEPS: TutorialStep[] = [
  {
    id: 'navbar',
    title: 'WELCOME',
    subtitle: 'new user detected',
    body: [
      "Welcome to Fun Job Hunt! Press Space Bar to go through this short tutorial. It's designed to get you up to speed quickly, so you can start tracking your job applications and career progress with ease. Let's dive in!",
    ],
  },
  {
    id: 'quickcast-links',
    title: 'QUICK LINKS',
    subtitle: 'one click · instant copy',
    body: [
      'Add anything you paste constantly into job applications — LinkedIn profile, GitHub, portfolio, personal site, cover letter doc, references sheet. Click a slot to instantly copy its URL. Never hunt for the same link twice.',
      'Right-click any slot to edit or delete it. You can add up to 8 links. Hit the + button to get started.',
    ],
  },
  {
    id: 'ai-assistant',
    title: 'AI ASSISTANT',
    subtitle: 'the most powerful time saver',
    body: [
      'Once your resume is uploaded, the AI will always reference your skills and experience — writing cover letters, first reach outs, and more. Right-click the AI button to instantly paste a job description and quickly generate common deliverables while you continue filling out applications.',
      `Everyone gets 30 uses a month. Pro users unlock unlimited usage for ${PRO_PRICE_LABEL}. Tech savvy? Bring your own API key in Settings.`,
    ],
  },
  {
    id: 'music-player',
    title: 'MUSIC',
    subtitle: 'youtube player',
    body: [
      'Built-in YouTube player to stay in the zone. Hover to open the panel, paste any YouTube URL to queue it up.',
      'NOTE: Playlist URLs are stored in the database. Remove them anytime if you prefer.',
    ],
  },
  {
    id: 'workday-bar',
    title: 'WORKDAY',
    subtitle: 'application time tracking',
    body: [
      'Workday only tracks time spent submitting job applications — nothing else on the app counts. Each time you log a new application, active time is recorded toward your workday.',
      'The bar shows TRACKING while active and IDLE after 15 minutes without a new submission. No punching in or out required.',
    ],
  },
  {
    id: 'job-rows',
    title: 'JOB LOG',
    subtitle: 'tracking rows',
    body: [
      'Tab through fields fast. Only Company + Title are required to submit — URL, Salary, Rating, Date, and Status are all optional. Columns are fully customizable — show, hide, and reorder them to match exactly how you like to track jobs.',
      'Use the [■] console icon on a row to open the full detail view. Enable DELETE MODE in the toolbar to remove entries.',
    ],
  },
  {
    id: 'journal',
    title: 'JOURNAL',
    subtitle: 'notes · daily checklist',
    body: [
      'A persistent workspace at the bottom of the screen. The NOTES tab is a free-form journal for thoughts, prep notes, and reminders. The CHECKLIST tab is a drag-to-reorder daily task list — add items, check them off, and clear completed ones anytime.',
      'NOTE: Drag the handle to resize the panel. Your notes and checklist sync automatically to your account.',
    ],
  },
  {
    id: 'navbar',
    title: 'NAVIGATION',
    subtitle: 'pages · settings',
    body: [
      'JOBS = The page you\'re on now, track all of your job applications\nNETWORK = Where all of your contacts live\nSTORY = Fun narratives and unlocks\nSTATS = Well... stats!\nCREDITS = Developer information and note',
      'Theme switcher and account settings are in the avatar menu (top right). Press ? anytime to replay this tutorial.',
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

export const STORY_STEPS: TutorialStep[] = [
  {
    id: 'navbar',
    title: 'STORY',
    subtitle: 'dramatic spice for your hunt',
    body: [
      'The Story page adds some flair to your job hunt. As you log applications and earn XP, rank nodes unlock. Some of which are hiding cutscenes and secret surprises!',
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
