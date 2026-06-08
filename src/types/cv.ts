export interface MainInfo {
  fullName: string
  jobTitle: string
  email: string
  phone: string
  location: string
  website: string
  linkedin: string
  github: string
}

export interface Experience {
  id: string
  company: string
  title: string
  location: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface Education {
  id: string
  institution: string
  degree: string
  field: string
  location: string
  startDate: string
  endDate: string
  gpa: string
  notes: string
}

export interface Project {
  id: string
  name: string
  role: string
  url: string
  startDate: string
  endDate: string
  technologies: string
  bullets: string[]
}

export interface SkillGroup {
  id: string
  label: string
  skills: string[]
}

export interface SkillsBucket {
  evergreen: string[]
  modular: SkillGroup[]
}

export interface Summary {
  id: string
  label: string
  text: string
}

export interface Certification {
  id: string
  name: string
  issuer: string
  issueDate: string
  expiryDate: string
  credentialId: string
  url: string
}

export interface Award {
  id: string
  title: string
  issuer: string
  date: string
  description: string
}

export interface CVContent {
  mainInfo:       MainInfo
  experiences:    Experience[]
  educations:     Education[]
  projects:       Project[]
  skills:         SkillsBucket | null
  summaries:      Summary[]
  certifications: Certification[]
  awards:         Award[]
}

export type ContentChangeEvent =
  | { type: 'mainInfo';      data: Partial<MainInfo> }
  | { type: 'summary';       id: string; data: Partial<Summary> }
  | { type: 'experience';    id: string; data: Partial<Experience> }
  | { type: 'education';     id: string; data: Partial<Education> }
  | { type: 'project';       id: string; data: Partial<Project> }
  | { type: 'skills';        data: Partial<SkillsBucket> }
  | { type: 'certification'; id: string; data: Partial<Certification> }
  | { type: 'award';         id: string; data: Partial<Award> }

export interface CVRendererHandle {
  getPaperElement: () => HTMLDivElement | null
}

export interface CVState {
  mainInfo:       MainInfo
  experiences:    Experience[]
  educations:     Education[]
  projects:       Project[]
  skills:         SkillsBucket | null
  summaries:      Summary[]
  certifications: Certification[]
  awards:         Award[]
  collapsed:      Record<string, boolean>

  setMainInfo:       (v: MainInfo) => void
  setExperiences:    (v: Experience[]) => void
  setEducations:     (v: Education[]) => void
  setProjects:       (v: Project[]) => void
  setSkills:         (v: SkillsBucket | null) => void
  setSummaries:      (v: Summary[]) => void
  setCertifications: (v: Certification[]) => void
  setAwards:         (v: Award[]) => void
  toggleCollapse:    (id: string) => void

  cvContent:       CVContent
  sectionOrder:    string[]
  setSectionOrder: (v: string[] | ((prev: string[]) => string[])) => void
  loading:         boolean
}
