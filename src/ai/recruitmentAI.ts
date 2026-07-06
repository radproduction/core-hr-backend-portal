/**
 * recruitmentAI.ts
 * Module 5 — Recruitment AI Decision-Support
 *
 * All outputs are advisory only. No automated decisions are made.
 * Humans review every score and can override.
 * Bias-check ensures protected characteristics are never used as ranking factors.
 */

import { invokeLLM } from "../_core/llm";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ParsedResume {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  totalExperience: string | null;
  skills: string[];
  education: Array<{ degree: string; institution: string; year?: string }>;
  summary: string | null;
  aiNote: string; // Always shown to reviewer
}

export interface ScreeningResult {
  overallScore: number; // 0–100
  scoreBreakdown: Array<{
    criterion: string;
    score: number;
    maxScore: number;
    reason: string;
  }>;
  strengths: string[];
  gaps: string[];
  recommendation: "strong_match" | "good_match" | "partial_match" | "weak_match";
  biasFlags: BiasFlag[];
  aiDisclaimer: string; // Always shown
}

export interface BiasFlag {
  criterion: string;
  concern: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
}

export interface MatchScore {
  score: number; // 0–100
  matchedSkills: string[];
  missingSkills: string[];
  experienceMatch: string;
  summary: string;
  aiDisclaimer: string;
}

export interface GeneratedJobDescription {
  title: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  biasNote: string; // Flags any potentially biased language
}

export interface InterviewQuestions {
  technical: Array<{ question: string; rationale: string }>;
  behavioral: Array<{ question: string; rationale: string }>;
  situational: Array<{ question: string; rationale: string }>;
  aiDisclaimer: string;
}

export interface ScorecardSummary {
  overallSentiment: "positive" | "mixed" | "negative";
  keyStrengths: string[];
  keyWeaknesses: string[];
  consensusRecommendation: string;
  divergentOpinions: string | null;
  narrativeSummary: string;
  aiDisclaimer: string;
}

// ─── BIAS-CHECK HELPER ────────────────────────────────────────────────────────

const PROTECTED_CHARACTERISTICS = [
  "age", "gender", "nationality", "race", "ethnicity", "religion",
  "marital status", "pregnancy", "disability", "sexual orientation",
  "political opinion", "social origin"
];

function checkForBiasInCriteria(criteria: string[]): BiasFlag[] {
  const flags: BiasFlag[] = [];
  for (const criterion of criteria) {
    const lower = criterion.toLowerCase();
    for (const characteristic of PROTECTED_CHARACTERISTICS) {
      if (lower.includes(characteristic)) {
        flags.push({
          criterion,
          concern: `This criterion may correlate with the protected characteristic: "${characteristic}"`,
          severity: "high",
          suggestion: `Remove or rephrase to focus on job-relevant skills and competencies only. Never use ${characteristic} as a ranking factor.`,
        });
      }
    }
    // Check for proxy indicators
    if (lower.includes("native speaker") || lower.includes("mother tongue")) {
      flags.push({
        criterion,
        concern: "Language nativity requirements may correlate with nationality or ethnicity",
        severity: "medium",
        suggestion: "Specify the required proficiency level (e.g., 'Business-level English') rather than native speaker status.",
      });
    }
    if (lower.includes("years of experience") && lower.match(/\b[3-9][0-9]\b/)) {
      flags.push({
        criterion,
        concern: "Very high experience requirements may indirectly screen out younger candidates",
        severity: "low",
        suggestion: "Consider whether the experience threshold is truly necessary for the role.",
      });
    }
  }
  return flags;
}

// ─── 1. RESUME PARSER ─────────────────────────────────────────────────────────

export async function parseResume(resumeText: string): Promise<ParsedResume> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a resume parsing assistant. Extract structured information from the resume text.
CRITICAL RULES:
- Do NOT extract or include age, date of birth, gender, nationality, marital status, religion, or any protected characteristics
- Focus only on professional qualifications, skills, experience, and education
- Return a JSON object with these fields: fullName, email, phone, currentTitle, currentCompany, totalExperience, skills (array), education (array of {degree, institution, year}), summary
- If a field is not found, use null
- skills should be an array of strings`,
        },
        {
          role: "user",
          content: `Parse this resume:\n\n${resumeText.slice(0, 4000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "parsed_resume",
          strict: true,
          schema: {
            type: "object",
            properties: {
              fullName: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              currentTitle: { type: ["string", "null"] },
              currentCompany: { type: ["string", "null"] },
              totalExperience: { type: ["string", "null"] },
              skills: { type: "array", items: { type: "string" } },
              education: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    degree: { type: "string" },
                    institution: { type: "string" },
                    year: { type: "string" },
                  },
                  required: ["degree", "institution"],
                  additionalProperties: false,
                },
              },
              summary: { type: ["string", "null"] },
            },
            required: ["fullName", "email", "phone", "currentTitle", "currentCompany", "totalExperience", "skills", "education", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

    return {
      ...parsed,
      aiNote: "AI-extracted data — please review and correct before saving. Protected characteristics (age, gender, nationality, etc.) have been intentionally excluded.",
    };
  } catch {
    return {
      fullName: null, email: null, phone: null, currentTitle: null,
      currentCompany: null, totalExperience: null, skills: [], education: [],
      summary: null,
      aiNote: "Resume parsing failed. Please enter candidate details manually.",
    };
  }
}

// ─── 2. AI SCREENER WITH BIAS-CHECK ──────────────────────────────────────────

export async function screenCandidate(params: {
  jobTitle: string;
  jobDescription: string;
  requirements: string;
  candidateProfile: {
    skills: string[];
    totalExperience: string | null;
    currentTitle: string | null;
    education: Array<{ degree: string; institution: string }>;
    summary: string | null;
  };
  screeningCriteria?: string[];
}): Promise<ScreeningResult> {
  const { jobTitle, jobDescription, requirements, candidateProfile, screeningCriteria = [] } = params;

  // Run bias check on criteria first
  const biasFlags = checkForBiasInCriteria([
    ...screeningCriteria,
    jobTitle,
    requirements,
  ]);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an objective recruitment screening assistant.
CRITICAL RULES:
- Score candidates ONLY on job-relevant skills, experience, and qualifications
- NEVER consider or mention age, gender, nationality, race, ethnicity, religion, marital status, or any protected characteristics
- Always provide specific reasons for each score
- Be balanced — highlight both strengths and gaps
- Return a JSON object with scoreBreakdown, strengths, gaps, and recommendation`,
        },
        {
          role: "user",
          content: `Score this candidate for the role of "${jobTitle}".

Job Description: ${jobDescription.slice(0, 1000)}
Requirements: ${requirements.slice(0, 500)}

Candidate Profile:
- Current Title: ${candidateProfile.currentTitle || "Not specified"}
- Experience: ${candidateProfile.totalExperience || "Not specified"}
- Skills: ${candidateProfile.skills.join(", ") || "Not specified"}
- Education: ${candidateProfile.education.map(e => `${e.degree} from ${e.institution}`).join("; ") || "Not specified"}
- Summary: ${candidateProfile.summary?.slice(0, 300) || "Not specified"}

Provide scores out of 10 for: Skills Match, Experience Level, Education Relevance, Role Alignment.
Recommendation must be one of: strong_match, good_match, partial_match, weak_match`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "screening_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              scoreBreakdown: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    criterion: { type: "string" },
                    score: { type: "number" },
                    maxScore: { type: "number" },
                    reason: { type: "string" },
                  },
                  required: ["criterion", "score", "maxScore", "reason"],
                  additionalProperties: false,
                },
              },
              strengths: { type: "array", items: { type: "string" } },
              gaps: { type: "array", items: { type: "string" } },
              recommendation: { type: "string" },
            },
            required: ["scoreBreakdown", "strengths", "gaps", "recommendation"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    const result = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

    const totalScore = result.scoreBreakdown.reduce(
      (sum: number, item: { score: number; maxScore: number }) =>
        sum + (item.score / item.maxScore) * 25,
      0
    );

    return {
      overallScore: Math.round(Math.min(100, totalScore)),
      scoreBreakdown: result.scoreBreakdown,
      strengths: result.strengths,
      gaps: result.gaps,
      recommendation: result.recommendation as ScreeningResult["recommendation"],
      biasFlags,
      aiDisclaimer:
        "AI screening scores are decision-SUPPORT only. A human recruiter must review every score and can override. Scores are based solely on job-relevant qualifications. Protected characteristics are never used as ranking factors.",
    };
  } catch {
    return {
      overallScore: 0,
      scoreBreakdown: [],
      strengths: [],
      gaps: ["AI screening failed — please review manually"],
      recommendation: "partial_match",
      biasFlags,
      aiDisclaimer: "AI screening failed. Please review this candidate manually.",
    };
  }
}

// ─── 3. CANDIDATE-ROLE MATCH SCORER ──────────────────────────────────────────

export async function scoreCandidateMatch(params: {
  jobTitle: string;
  requiredSkills: string[];
  candidateSkills: string[];
  requiredExperience: string;
  candidateExperience: string | null;
}): Promise<MatchScore> {
  const { jobTitle, requiredSkills, candidateSkills, requiredExperience, candidateExperience } = params;

  const matchedSkills = candidateSkills.filter(s =>
    requiredSkills.some(r => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase()))
  );
  const missingSkills = requiredSkills.filter(r =>
    !candidateSkills.some(s => s.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(s.toLowerCase()))
  );

  const skillScore = requiredSkills.length > 0
    ? Math.round((matchedSkills.length / requiredSkills.length) * 70)
    : 50;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a recruitment match scoring assistant. Assess experience alignment and provide a brief summary. Focus only on professional qualifications.",
        },
        {
          role: "user",
          content: `Role: ${jobTitle}
Required experience: ${requiredExperience}
Candidate experience: ${candidateExperience || "Not specified"}
Matched skills: ${matchedSkills.join(", ") || "None"}
Missing skills: ${missingSkills.join(", ") || "None"}

Provide: experienceMatch (one sentence), summary (2-3 sentences), experienceScore (0-30).
Return JSON: { experienceMatch, summary, experienceScore }`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "match_score",
          strict: true,
          schema: {
            type: "object",
            properties: {
              experienceMatch: { type: "string" },
              summary: { type: "string" },
              experienceScore: { type: "number" },
            },
            required: ["experienceMatch", "summary", "experienceScore"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    const result = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

    return {
      score: Math.min(100, skillScore + Math.round(result.experienceScore)),
      matchedSkills,
      missingSkills,
      experienceMatch: result.experienceMatch,
      summary: result.summary,
      aiDisclaimer: "Match score is AI-generated and advisory only. Human review required before any hiring decision.",
    };
  } catch {
    return {
      score: skillScore,
      matchedSkills,
      missingSkills,
      experienceMatch: "Experience match could not be assessed automatically.",
      summary: "Partial match based on skills. Manual review recommended.",
      aiDisclaimer: "Match score is AI-generated and advisory only. Human review required before any hiring decision.",
    };
  }
}

// ─── 4. JD GENERATOR ─────────────────────────────────────────────────────────

export async function generateJobDescription(params: {
  title: string;
  department: string;
  keySkills: string[];
  experienceLevel: string;
  location: string;
  additionalContext?: string;
}): Promise<GeneratedJobDescription> {
  const { title, department, keySkills, experienceLevel, location, additionalContext } = params;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert HR copywriter. Write inclusive, bias-free job descriptions.
RULES:
- Use gender-neutral language (they/them, not he/she)
- Do not mention age, nationality, or other protected characteristics
- Focus on skills and competencies, not personal attributes
- Use active voice and clear language
- Flag any potentially biased language in biasNote`,
        },
        {
          role: "user",
          content: `Write a job description for:
Title: ${title}
Department: ${department}
Key Skills: ${keySkills.join(", ")}
Experience Level: ${experienceLevel}
Location: ${location}
${additionalContext ? `Additional Context: ${additionalContext}` : ""}

Return JSON with: summary, responsibilities (array), requirements (array), niceToHave (array), biasNote`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "job_description",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              responsibilities: { type: "array", items: { type: "string" } },
              requirements: { type: "array", items: { type: "string" } },
              niceToHave: { type: "array", items: { type: "string" } },
              biasNote: { type: "string" },
            },
            required: ["summary", "responsibilities", "requirements", "niceToHave", "biasNote"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    const result = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

    return { title, ...result };
  } catch {
    return {
      title,
      summary: `We are looking for a ${title} to join our ${department} team.`,
      responsibilities: ["To be defined by the hiring manager"],
      requirements: keySkills.map(s => `Proficiency in ${s}`),
      niceToHave: [],
      biasNote: "AI generation failed. Please review the job description for inclusive language before publishing.",
    };
  }
}

// ─── 5. INTERVIEW QUESTION SUGGESTER ─────────────────────────────────────────

export async function suggestInterviewQuestions(params: {
  jobTitle: string;
  keySkills: string[];
  experienceLevel: string;
  interviewType: "technical" | "behavioral" | "mixed";
}): Promise<InterviewQuestions> {
  const { jobTitle, keySkills, experienceLevel, interviewType } = params;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert interview coach. Suggest structured interview questions.
RULES:
- Questions must be job-relevant and skills-based
- No questions about age, family, nationality, religion, or other protected characteristics
- Behavioral questions should use the STAR method format
- Include rationale for each question`,
        },
        {
          role: "user",
          content: `Suggest interview questions for: ${jobTitle} (${experienceLevel})
Key Skills: ${keySkills.join(", ")}
Interview Type: ${interviewType}

Provide 3 technical, 3 behavioral, and 3 situational questions with rationale.
Return JSON: { technical: [{question, rationale}], behavioral: [{question, rationale}], situational: [{question, rationale}] }`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "interview_questions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              technical: {
                type: "array",
                items: {
                  type: "object",
                  properties: { question: { type: "string" }, rationale: { type: "string" } },
                  required: ["question", "rationale"],
                  additionalProperties: false,
                },
              },
              behavioral: {
                type: "array",
                items: {
                  type: "object",
                  properties: { question: { type: "string" }, rationale: { type: "string" } },
                  required: ["question", "rationale"],
                  additionalProperties: false,
                },
              },
              situational: {
                type: "array",
                items: {
                  type: "object",
                  properties: { question: { type: "string" }, rationale: { type: "string" } },
                  required: ["question", "rationale"],
                  additionalProperties: false,
                },
              },
            },
            required: ["technical", "behavioral", "situational"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    const result = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

    return {
      ...result,
      aiDisclaimer: "These questions are AI-suggested. The interviewer should adapt them to the specific candidate and context. Avoid questions about protected characteristics.",
    };
  } catch {
    return {
      technical: [{ question: "Describe your experience with the key technologies for this role.", rationale: "Assesses technical depth" }],
      behavioral: [{ question: "Tell me about a challenging project you led.", rationale: "Assesses leadership and problem-solving" }],
      situational: [{ question: "How would you handle a tight deadline with limited resources?", rationale: "Assesses prioritization skills" }],
      aiDisclaimer: "AI question generation failed. Using default questions. Please customize for the specific role.",
    };
  }
}

// ─── 6. SCORECARD SUMMARIZER ──────────────────────────────────────────────────

export async function summarizeScorecards(params: {
  jobTitle: string;
  candidateName: string;
  scorecards: Array<{
    interviewerName: string;
    overallRating: number;
    recommendation: string;
    strengths: string | null;
    weaknesses: string | null;
    notes: string | null;
  }>;
}): Promise<ScorecardSummary> {
  const { jobTitle, candidateName, scorecards } = params;

  if (scorecards.length === 0) {
    return {
      overallSentiment: "mixed",
      keyStrengths: [],
      keyWeaknesses: [],
      consensusRecommendation: "No scorecards available",
      divergentOpinions: null,
      narrativeSummary: "No interview scorecards have been submitted yet.",
      aiDisclaimer: "AI summary is advisory only. The hiring manager makes the final decision.",
    };
  }

  const avgRating = scorecards.reduce((s, c) => s + c.overallRating, 0) / scorecards.length;
  const sentiment: ScorecardSummary["overallSentiment"] =
    avgRating >= 7 ? "positive" : avgRating >= 5 ? "mixed" : "negative";

  try {
    const scorecardsText = scorecards
      .map(s => `Interviewer: ${s.interviewerName}
Rating: ${s.overallRating}/10
Recommendation: ${s.recommendation}
Strengths: ${s.strengths || "None noted"}
Weaknesses: ${s.weaknesses || "None noted"}
Notes: ${s.notes || "None"}`)
      .join("\n\n---\n\n");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an HR analyst summarizing interview feedback.
RULES:
- Summarize objectively based only on job-relevant feedback
- Do NOT include or infer anything about protected characteristics
- Highlight consensus and divergent opinions
- Keep the summary factual and professional`,
        },
        {
          role: "user",
          content: `Summarize interview feedback for ${candidateName} applying for ${jobTitle}.

${scorecardsText}

Return JSON: { keyStrengths (array), keyWeaknesses (array), consensusRecommendation (string), divergentOpinions (string or null), narrativeSummary (2-3 sentences) }`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scorecard_summary",
          strict: true,
          schema: {
            type: "object",
            properties: {
              keyStrengths: { type: "array", items: { type: "string" } },
              keyWeaknesses: { type: "array", items: { type: "string" } },
              consensusRecommendation: { type: "string" },
              divergentOpinions: { type: ["string", "null"] },
              narrativeSummary: { type: "string" },
            },
            required: ["keyStrengths", "keyWeaknesses", "consensusRecommendation", "divergentOpinions", "narrativeSummary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    const result = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

    return {
      overallSentiment: sentiment,
      ...result,
      aiDisclaimer: "AI summary is advisory only. The hiring manager reviews all scorecards and makes the final decision. AI never makes hiring decisions.",
    };
  } catch {
    return {
      overallSentiment: sentiment,
      keyStrengths: [],
      keyWeaknesses: [],
      consensusRecommendation: `Average rating: ${avgRating.toFixed(1)}/10`,
      divergentOpinions: null,
      narrativeSummary: "AI summarization failed. Please review individual scorecards.",
      aiDisclaimer: "AI summary is advisory only. The hiring manager reviews all scorecards and makes the final decision.",
    };
  }
}
