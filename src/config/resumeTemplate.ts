// LaTeX resume template configuration.
// Edit this file to change the document structure, fonts, margins, or AI instructions
// without touching any component code.

// ── Preamble ──────────────────────────────────────────────────────────────────
// Document class, margin, and package declarations.
// Injected at the top of every generated .tex file.
export const LATEX_PREAMBLE = `
\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\pdfgentounicode=1

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}
`.trim()

// ── Template ──────────────────────────────────────────────────────────────────
// Full document shell with {{SLOT}} placeholders.
// The AI replaces each slot with LaTeX-formatted content from the CV.
// Slots with no matching content should be replaced with an empty string.
export const LATEX_TEMPLATE = `
\\begin{document}

%----------HEADING----------
{{HEADER}}

%-----------SUMMARY-----------
{{SUMMARY}}

%-----------EDUCATION-----------
{{EDUCATION}}

%-----------EXPERIENCE-----------
{{EXPERIENCE}}

%-----------PROJECTS-----------
{{PROJECTS}}

%-----------SKILLS-----------
{{SKILLS}}

%-----------CERTIFICATIONS-----------
{{CERTIFICATIONS}}

%-----------AWARDS-----------
{{AWARDS}}

\\end{document}
`.trim()

// ── AI system prompt ──────────────────────────────────────────────────────────
// Sent to the Claude API alongside the Master CV JSON and the template above.
// Instructs the model to fill slots without touching LaTeX structure.
export const LATEX_SYSTEM_PROMPT = `
You are a LaTeX resume formatter. You will receive:
1. A JSON object (the "Master CV") containing all of the user's resume content
2. A LaTeX template with {{SLOT}} placeholders

Your task: replace every {{SLOT}} with properly formatted LaTeX drawn from the CV.

Rules:
- Do NOT alter the preamble, \\begin{document}, or \\end{document}
- Do NOT add or remove sections — only fill the slots that are present
- Escape all special LaTeX characters in user-provided text: & % $ # _ { } ~ ^ \\
- If a slot has no corresponding content in the CV, replace it with a blank line
- Dates should appear exactly as the user entered them (no reformatting)

Slot formats:

HEADER slot — use this exact structure:
  \\begin{center}
    \\textbf{\\Huge \\scshape Full Name} \\\\ \\vspace{1pt}
    \\small phone $|$ \\href{mailto:email}{\\underline{email}} $|$
    \\href{linkedin url}{\\underline{linkedin display}} $|$
    \\href{github url}{\\underline{github display}}
  \\end{center}
  Omit any contact field that is empty in the CV.

SUMMARY slot — if a summary exists:
  \\section{Summary}
  \\small{summary text here}
  If no summary, output a blank line.

EDUCATION slot — if educations exist:
  \\section{Education}
    \\resumeSubHeadingListStart
      \\resumeSubheading
        {Institution}{Location}
        {Degree, Field}{Date range}
    \\resumeSubHeadingListEnd
  Repeat \\resumeSubheading for each education entry. If no educations, output a blank line.

EXPERIENCE slot — if experiences exist:
  \\section{Experience}
    \\resumeSubHeadingListStart
      \\resumeSubheading
        {Company}{Date range}
        {Title}{Location}
        \\resumeItemListStart
          \\resumeItem{bullet text}
        \\resumeItemListEnd
    \\resumeSubHeadingListEnd
  Repeat for each experience. If no experiences, output a blank line.

PROJECTS slot — if projects exist:
  \\section{Projects}
    \\resumeSubHeadingListStart
      \\resumeProjectHeading
        {\\textbf{Project Name} $|$ \\emph{technologies}}{Date range}
        \\resumeItemListStart
          \\resumeItem{bullet text}
        \\resumeItemListEnd
    \\resumeSubHeadingListEnd
  Repeat for each project. If no projects, output a blank line.

SKILLS slot — if skills exist:
  \\section{Technical Skills}
   \\begin{itemize}[leftmargin=0.15in, label={}]
      \\small{\\item{
       \\textbf{Core}{: skill1, skill2, ...} \\\\
       \\textbf{Group Label}{: skill1, skill2, ...}
      }}
   \\end{itemize}
  Use "Core" for evergreen skills; use each modular group's label for modular skills.
  If no skills, output a blank line.

CERTIFICATIONS slot — if certifications exist:
  \\section{Certifications}
    \\resumeSubHeadingListStart
      \\resumeSubheading
        {Certification Name}{Issue Date -- Expiry Date}
        {Issuer}{Credential ID}
    \\resumeSubHeadingListEnd
  If no certifications, output a blank line.

AWARDS slot — if awards exist:
  \\section{Awards \\& Honors}
    \\resumeSubHeadingListStart
      \\resumeSubheading
        {Award Title}{Date}
        {Issuer}{}
    \\resumeSubHeadingListEnd
  If no awards, output a blank line.
`.trim()
