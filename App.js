import React, { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Search,
  Star,
  Mail,
  Phone,
  Check,
  AlertCircle,
  Settings,
  X,
  User,
  Eye,
  BarChart3,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const ResumeAnalyzer = () => {
  const [jobDescription, setJobDescription] = useState("");
  const [resumes, setResumes] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shouldStopProcessing, setShouldStopProcessing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [showGradeSummary, setShowGradeSummary] = useState(null);
  const [processingStatus, setProcessingStatus] = useState("");
  const [criteriaWeights, setCriteriaWeights] = useState({
    skills: 0.4,
    experience: 0.3,
    education: 0.2,
    keywords: 0.1,
  });
  const fileInputRef = useRef(null);

  // Real PDF text extraction using PDF.js
  const extractTextFromPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => item.str)
          .join(" ")
          .replace(/\s+/g, " ");
        fullText += pageText + "\n";
      }

      return fullText.trim();
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      throw new Error(
        "Failed to extract text from PDF. Please ensure the file is a valid PDF."
      );
    }
  };

  // Extract contact information using regex patterns
  const extractContactInfo = (text) => {
    const contact = {
      name: "",
      email: "",
      phone: "",
    };

    // Email extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails && emails.length > 0) {
      contact.email = emails[0];
    }

    // Phone extraction - multiple formats
    const phoneRegex =
      /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch && phoneMatch.length > 0) {
      contact.phone = phoneMatch[0];
    }

    // Name extraction - look for patterns at the beginning
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();

      // Skip common resume headers
      if (
        line.toLowerCase().includes("resume") ||
        line.toLowerCase().includes("curriculum") ||
        line.toLowerCase().includes("cv")
      ) {
        continue;
      }

      // Look for name patterns (2-4 words, mostly letters)
      const words = line.split(/\s+/).filter((word) => word.length > 1);
      if (words.length >= 2 && words.length <= 4) {
        const isLikelyName = words.every(
          (word) => /^[A-Za-z][A-Za-z.,'-]*$/.test(word) && word.length <= 20
        );

        if (isLikelyName && !contact.name) {
          contact.name = words.join(" ");
          break;
        }
      }
    }

    return contact;
  };

  // Skills extraction with comprehensive database
  const extractSkills = (text) => {
    const skillsDatabase = {
      programming: [
        "JavaScript",
        "Python",
        "Java",
        "C++",
        "C#",
        "PHP",
        "Ruby",
        "Go",
        "Rust",
        "Swift",
        "Kotlin",
        "Scala",
        "TypeScript",
        "R",
        "MATLAB",
        "SQL",
        "HTML",
        "CSS",
        "Perl",
      ],
      frameworks: [
        "React",
        "Angular",
        "Vue.js",
        "Node.js",
        "Express",
        "Django",
        "Flask",
        "Spring",
        "Laravel",
        "Rails",
        "Bootstrap",
        "jQuery",
        "Svelte",
        "Next.js",
        "Nuxt.js",
      ],
      databases: [
        "MySQL",
        "PostgreSQL",
        "MongoDB",
        "Redis",
        "Elasticsearch",
        "Oracle",
        "SQLite",
        "Cassandra",
        "DynamoDB",
        "Neo4j",
        "MariaDB",
      ],
      cloud: [
        "AWS",
        "Azure",
        "GCP",
        "Docker",
        "Kubernetes",
        "Jenkins",
        "GitLab CI",
        "CircleCI",
        "Terraform",
        "Ansible",
        "Heroku",
        "Vercel",
        "Netlify",
      ],
      tools: [
        "Git",
        "GitHub",
        "GitLab",
        "Jira",
        "Confluence",
        "Slack",
        "VS Code",
        "IntelliJ",
        "Eclipse",
        "Postman",
        "Figma",
        "Adobe Creative Suite",
      ],
      methodologies: [
        "Agile",
        "Scrum",
        "Kanban",
        "DevOps",
        "CI/CD",
        "TDD",
        "Microservices",
        "REST",
        "GraphQL",
        "Machine Learning",
        "AI",
        "Data Science",
        "Blockchain",
      ],
    };

    const allSkills = Object.values(skillsDatabase).flat();
    const textLower = text.toLowerCase();
    const foundSkills = [];

    allSkills.forEach((skill) => {
      const skillVariations = [
        skill.toLowerCase(),
        skill.toLowerCase().replace(/\./g, ""),
        skill.toLowerCase().replace(/\s/g, ""),
        skill.toLowerCase().replace(/-/g, " "),
      ];

      if (skillVariations.some((variation) => textLower.includes(variation))) {
        foundSkills.push(skill);
      }
    });

    return [...new Set(foundSkills)];
  };

  // Experience years extraction
  const extractExperienceYears = (text) => {
    const patterns = [
      /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
      /(\d+)\+?\s*years?\s+(?:in|with)/gi,
      /experience.*?(\d+)\+?\s*years?/gi,
    ];

    const years = [];
    patterns.forEach((pattern) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((match) => {
        const year = parseInt(match[1]);
        if (year > 0 && year <= 50) {
          years.push(year);
        }
      });
    });

    // Also try to calculate from employment dates
    const datePattern = /\b(20\d{2}|19\d{2})\b/g;
    const dates = [...text.matchAll(datePattern)]
      .map((match) => parseInt(match[1]))
      .filter((year) => year >= 1990 && year <= new Date().getFullYear());

    if (dates.length >= 2) {
      const experienceFromDates = Math.max(...dates) - Math.min(...dates);
      if (experienceFromDates > 0 && experienceFromDates <= 50) {
        years.push(experienceFromDates);
      }
    }

    return years.length > 0 ? Math.max(...years) : 0;
  };

  // Education analysis
  const analyzeEducation = (text) => {
    const educationLevels = {
      phd: ["ph.d", "phd", "doctorate", "doctoral", "doctor of philosophy"],
      masters: [
        "master",
        "mba",
        "ms",
        "m.s.",
        "ma",
        "m.a.",
        "msc",
        "m.sc.",
        "med",
        "m.ed.",
      ],
      bachelors: [
        "bachelor",
        "bs",
        "b.s.",
        "ba",
        "b.a.",
        "bsc",
        "b.sc.",
        "undergraduate",
        "beng",
        "b.eng.",
      ],
      associates: ["associate", "aa", "as", "a.s.", "aas"],
      certificate: ["certificate", "certification", "diploma", "cert."],
    };

    const textLower = text.toLowerCase();
    const foundLevels = [];

    Object.entries(educationLevels).forEach(([level, keywords]) => {
      if (keywords.some((keyword) => textLower.includes(keyword))) {
        foundLevels.push(level);
      }
    });

    // Return highest level found
    const priority = [
      "phd",
      "masters",
      "bachelors",
      "associates",
      "certificate",
    ];
    for (const level of priority) {
      if (foundLevels.includes(level)) {
        return { level, hasAdvanced: ["phd", "masters"].includes(level) };
      }
    }

    return { level: "none", hasAdvanced: false };
  };

  // Keyword matching with job description
  const calculateKeywordMatch = (resumeText, jobDesc) => {
    if (!jobDesc) return 0;

    const stopWords = new Set([
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "had",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
    ]);

    const extractKeywords = (text) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.has(word))
        .filter((word) => /^[a-z]+$/.test(word));
    };

    const jobKeywords = new Set(extractKeywords(jobDesc));
    const resumeKeywords = new Set(extractKeywords(resumeText));

    if (jobKeywords.size === 0) return 0;

    const matches = [...jobKeywords].filter((keyword) =>
      resumeKeywords.has(keyword)
    );
    return (matches.length / jobKeywords.size) * 100;
  };

  // Comprehensive resume scoring
  const scoreResume = (resumeText) => {
    if (!jobDescription.trim()) {
      throw new Error("Job description is required for scoring");
    }

    const skills = extractSkills(resumeText);
    const experienceYears = extractExperienceYears(resumeText);
    const education = analyzeEducation(resumeText);
    const keywordMatch = calculateKeywordMatch(resumeText, jobDescription);

    // Skills scoring (0-100)
    const skillsScore = Math.min(skills.length * 8, 100);

    // Experience scoring (0-100)
    let experienceScore = 0;
    if (experienceYears >= 10) experienceScore = 100;
    else if (experienceYears >= 7) experienceScore = 90;
    else if (experienceYears >= 5) experienceScore = 80;
    else if (experienceYears >= 3) experienceScore = 70;
    else if (experienceYears >= 1) experienceScore = 50;
    else experienceScore = 20;

    // Education scoring (0-100)
    const educationScores = {
      phd: 100,
      masters: 85,
      bachelors: 70,
      associates: 50,
      certificate: 40,
      none: 20,
    };
    const educationScore = educationScores[education.level] || 20;

    // Keyword matching score (0-100)
    const keywordScore = Math.min(keywordMatch, 100);

    // Calculate weighted overall score
    const overallScore = Math.round(
      skillsScore * criteriaWeights.skills +
        experienceScore * criteriaWeights.experience +
        educationScore * criteriaWeights.education +
        keywordScore * criteriaWeights.keywords
    );

    // Generate insights
    const strengths = [];
    const weaknesses = [];

    if (skillsScore >= 70) strengths.push("Strong technical skills portfolio");
    if (experienceScore >= 80) strengths.push("Excellent experience level");
    if (education.hasAdvanced)
      strengths.push("Advanced educational background");
    if (keywordScore >= 60)
      strengths.push("Good alignment with job requirements");

    if (skillsScore < 40) weaknesses.push("Limited technical skills mentioned");
    if (experienceScore < 50)
      weaknesses.push("Could benefit from more experience");
    if (educationScore < 50)
      weaknesses.push("Educational background could be stronger");
    if (keywordScore < 40)
      weaknesses.push("Limited alignment with job description");

    const recommendation =
      overallScore >= 85
        ? "Excellent candidate - highly recommended"
        : overallScore >= 75
        ? "Strong candidate - recommend interview"
        : overallScore >= 65
        ? "Good candidate - worth considering"
        : overallScore >= 50
        ? "Average candidate - may need additional screening"
        : "Below requirements - consider only if desperate";

    return {
      overallScore,
      skillsMatch: Math.round(skillsScore),
      experienceMatch: Math.round(experienceScore),
      educationMatch: Math.round(educationScore),
      keywordMatch: Math.round(keywordScore),
      strengths,
      weaknesses,
      recommendation,
      detectedSkills: skills,
      experienceYears,
      educationLevel: education.level,
    };
  };

  // Handle file uploads including ZIP files
  const handleFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    const newResumes = [];

    for (const file of files) {
      if (file.type === "application/pdf") {
        newResumes.push({
          id: Date.now() + Math.random(),
          file,
          name: file.name,
          status: "pending",
          text: "",
          fullText: "",
          score: 0,
          analysis: {},
          contact: {},
        });
      } else if (file.name.toLowerCase().endsWith(".zip")) {
        try {
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(file);

          for (const [filename, zipFile] of Object.entries(zipContent.files)) {
            if (filename.toLowerCase().endsWith(".pdf") && !zipFile.dir) {
              const pdfBlob = await zipFile.async("blob");
              const pdfFile = new File([pdfBlob], filename, {
                type: "application/pdf",
              });

              newResumes.push({
                id: Date.now() + Math.random(),
                file: pdfFile,
                name: filename,
                status: "pending",
                text: "",
                fullText: "",
                score: 0,
                analysis: {},
                contact: {},
              });
            }
          }
        } catch (error) {
          console.error("Error processing ZIP file:", error);
          alert(`Error processing ZIP file: ${file.name}`);
        }
      }
    }

    setResumes((prev) => [...prev, ...newResumes]);

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Process all resumes
  const processResumes = async () => {
    if (!jobDescription.trim()) {
      alert("Please enter a job description first.");
      return;
    }

    setIsProcessing(true);
    setShouldStopProcessing(false);
    setProcessingStatus("Initializing...");

    const updatedResumes = [...resumes];

    for (let i = 0; i < updatedResumes.length; i++) {
      if (shouldStopProcessing) {
        setProcessingStatus("Stopped by user");
        break;
      }

      if (updatedResumes[i].status === "pending") {
        updatedResumes[i].status = "processing";
        setProcessingStatus(`Processing ${updatedResumes[i].name}...`);
        setResumes([...updatedResumes]);

        try {
          // Extract text from PDF
          const text = await extractTextFromPDF(updatedResumes[i].file);
          updatedResumes[i].text = text;
          updatedResumes[i].fullText = text;

          // Extract contact information
          updatedResumes[i].contact = extractContactInfo(text);

          // Analyze and score resume
          const analysis = scoreResume(text);
          updatedResumes[i].analysis = analysis;
          updatedResumes[i].score = analysis.overallScore;
          updatedResumes[i].status = "completed";
        } catch (error) {
          console.error("Error processing resume:", error);
          updatedResumes[i].status = "error";
          updatedResumes[i].error = error.message;
        }

        setResumes([...updatedResumes]);

        // Small delay to prevent overwhelming the browser
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    setIsProcessing(false);
    setProcessingStatus("");

    if (!shouldStopProcessing) {
      setAnalyzed(true);
    }
  };

  const stopProcessing = () => {
    setShouldStopProcessing(true);
    setIsProcessing(false);
    setProcessingStatus("Stopping...");
  };

  const removeResume = (id) => {
    setResumes((prev) => prev.filter((r) => r.id !== id));
  };

  const getScoreColor = (score) => {
    if (score >= 85) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 75) return "bg-blue-100 text-blue-800 border-blue-200";
    if (score >= 65) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (score >= 50) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getScoreIcon = (score) => {
    if (score >= 85) return <Star className="w-4 h-4 fill-current" />;
    if (score >= 75) return <Check className="w-4 h-4" />;
    if (score >= 65) return <BarChart3 className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  const exportResults = () => {
    const completedResumes = resumes.filter((r) => r.status === "completed");
    if (completedResumes.length === 0) {
      alert("No completed analyses to export.");
      return;
    }

    const sortedResumes = [...completedResumes].sort(
      (a, b) => b.score - a.score
    );

    const csvContent = [
      [
        "Rank",
        "Name",
        "Email",
        "Phone",
        "Overall Score",
        "Skills Score",
        "Experience Score",
        "Education Score",
        "Keyword Score",
        "Skills Found",
        "Experience Years",
        "Education Level",
        "Recommendation",
        "Strengths",
        "Weaknesses",
      ],
      ...sortedResumes.map((resume, index) => [
        index + 1,
        resume.contact?.name || "Not found",
        resume.contact?.email || "Not found",
        resume.contact?.phone || "Not found",
        resume.score || 0,
        resume.analysis?.skillsMatch || 0,
        resume.analysis?.experienceMatch || 0,
        resume.analysis?.educationMatch || 0,
        resume.analysis?.keywordMatch || 0,
        resume.analysis?.detectedSkills?.join("; ") || "",
        resume.analysis?.experienceYears || 0,
        resume.analysis?.educationLevel || "none",
        resume.analysis?.recommendation || "",
        resume.analysis?.strengths?.join("; ") || "",
        resume.analysis?.weaknesses?.join("; ") || "",
      ]),
    ]
      .map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `resume_analysis_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort resumes by score when analyzed
  const sortedResumes = analyzed
    ? [...resumes].sort((a, b) => (b.score || 0) - (a.score || 0))
    : resumes;

  // Modal Components
  const GradeSummaryModal = ({ resume, onClose }) => {
    if (!resume || !resume.analysis) return null;

    const { analysis } = resume;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto modal-content">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold text-gray-900">
                Grade Summary: {resume.contact?.name || resume.name}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Overall Score */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-medium text-gray-900">
                  Overall Score
                </h4>
                <span
                  className={`text-3xl font-bold px-6 py-3 rounded-full border-2 ${getScoreColor(
                    analysis.overallScore
                  )}`}
                >
                  {analysis.overallScore}%
                </span>
              </div>
              <p className="text-lg text-gray-600 bg-gray-50 p-4 rounded-lg">
                {analysis.recommendation}
              </p>
            </div>

            {/* Detailed Breakdown */}
            <div className="mb-8">
              <h4 className="text-xl font-medium text-gray-900 mb-6">
                Detailed Score Breakdown
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-medium text-blue-900">
                      Skills Match
                    </span>
                    <span className="text-2xl font-bold text-blue-700">
                      {analysis.skillsMatch}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-3 mb-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full progress-bar"
                      style={{ width: `${analysis.skillsMatch}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-blue-700">
                    {analysis.detectedSkills?.length || 0} skills detected
                  </p>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-medium text-green-900">
                      Experience
                    </span>
                    <span className="text-2xl font-bold text-green-700">
                      {analysis.experienceMatch}%
                    </span>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-3 mb-3">
                    <div
                      className="bg-green-600 h-3 rounded-full progress-bar"
                      style={{ width: `${analysis.experienceMatch}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-green-700">
                    {analysis.experienceYears} years experience
                  </p>
                </div>

                <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-medium text-purple-900">
                      Education
                    </span>
                    <span className="text-2xl font-bold text-purple-700">
                      {analysis.educationMatch}%
                    </span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-3 mb-3">
                    <div
                      className="bg-purple-600 h-3 rounded-full progress-bar"
                      style={{ width: `${analysis.educationMatch}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-purple-700 capitalize">
                    {analysis.educationLevel} level
                  </p>
                </div>

                <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-medium text-orange-900">
                      Keywords
                    </span>
                    <span className="text-2xl font-bold text-orange-700">
                      {analysis.keywordMatch}%
                    </span>
                  </div>
                  <div className="w-full bg-orange-200 rounded-full h-3 mb-3">
                    <div
                      className="bg-orange-600 h-3 rounded-full progress-bar"
                      style={{ width: `${analysis.keywordMatch}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-orange-700">
                    Job description alignment
                  </p>
                </div>
              </div>
            </div>

            {/* Skills Found */}
            {analysis.detectedSkills && analysis.detectedSkills.length > 0 && (
              <div className="mb-8">
                <h5 className="text-lg font-medium text-gray-900 mb-3">
                  Detected Skills
                </h5>
                <div className="flex flex-wrap gap-2">
                  {analysis.detectedSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h5 className="text-lg font-medium text-green-700 mb-4 flex items-center">
                  <Check className="w-5 h-5 mr-2" />
                  Strengths
                </h5>
                <ul className="space-y-3">
                  {analysis.strengths?.map((strength, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{strength}</span>
                    </li>
                  ))}
                  {(!analysis.strengths || analysis.strengths.length === 0) && (
                    <li className="text-gray-500 italic">
                      No specific strengths identified
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h5 className="text-lg font-medium text-red-700 mb-4 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Areas for Improvement
                </h5>
                <ul className="space-y-3">
                  {analysis.weaknesses?.map((weakness, index) => (
                    <li key={index} className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{weakness}</span>
                    </li>
                  ))}
                  {(!analysis.weaknesses ||
                    analysis.weaknesses.length === 0) && (
                    <li className="text-gray-500 italic">
                      No specific weaknesses identified
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ResumeViewerModal = ({ resume, onClose }) => {
    if (!resume) return null;

    const formatResumeText = (text) => {
      if (!text) return "No text available";

      // Enhanced formatting for better readability
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const formattedLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect section headers (all caps, contains common resume sections)
        const sectionHeaders = [
          "EXPERIENCE",
          "EDUCATION",
          "SKILLS",
          "SUMMARY",
          "OBJECTIVE",
          "PROJECTS",
          "CERTIFICATIONS",
          "ACHIEVEMENTS",
        ];
        const isHeader =
          sectionHeaders.some((header) =>
            line.toUpperCase().includes(header)
          ) && line.length < 50;

        // Detect job titles/companies (contains years or common patterns)
        const hasYears = /\d{4}/.test(line);
        const hasJobIndicators =
          /\||•|-/.test(line) ||
          line.includes("present") ||
          line.includes("Present");
        const isJobTitle = hasYears && hasJobIndicators && line.length < 100;

        // Detect contact info (email, phone)
        const isContact = /@/.test(line) || /\(\d{3}\)/.test(line);

        if (isHeader) {
          formattedLines.push("", `### ${line}`, "");
        } else if (isJobTitle) {
          formattedLines.push("", `**${line}**`, "");
        } else if (isContact) {
          formattedLines.push(`**${line}**`);
        } else if (
          line.startsWith("•") ||
          line.startsWith("-") ||
          line.startsWith("*")
        ) {
          formattedLines.push(`  ${line}`);
        } else {
          formattedLines.push(line);
        }
      }

      return formattedLines.join("\n");
    };

    const formattedText = formatResumeText(resume.fullText || resume.text);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden modal-content flex flex-col">
          {/* Fixed Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-white">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">
                {resume.contact?.name || "Resume Viewer"}
              </h3>
              <p className="text-gray-600 mt-1">{resume.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Contact Info Bar */}
          {resume.contact &&
            Object.keys(resume.contact).some((key) => resume.contact[key]) && (
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex flex-wrap gap-6 text-sm">
                  {resume.contact.email && (
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="font-medium">
                        {resume.contact.email}
                      </span>
                    </div>
                  )}
                  {resume.contact.phone && (
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="font-medium">
                        {resume.contact.phone}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Scrollable Resume Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-white">
              <div className="prose max-w-none">
                <div className="whitespace-pre-line font-sans text-sm leading-relaxed text-gray-800 space-y-2">
                  {formattedText.split("\n").map((line, index) => {
                    if (line.startsWith("### ")) {
                      return (
                        <h3
                          key={index}
                          className="text-lg font-semibold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-200"
                        >
                          {line.replace("### ", "")}
                        </h3>
                      );
                    } else if (line.startsWith("**") && line.endsWith("**")) {
                      return (
                        <div
                          key={index}
                          className="font-semibold text-gray-900 mt-4 mb-2"
                        >
                          {line.replace(/\*\*/g, "")}
                        </div>
                      );
                    } else if (line.startsWith("  ")) {
                      return (
                        <div key={index} className="ml-4 text-gray-700">
                          {line}
                        </div>
                      );
                    } else if (line.trim() === "") {
                      return <div key={index} className="h-2"></div>;
                    } else {
                      return (
                        <div key={index} className="text-gray-800">
                          {line}
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>Resume content extracted from PDF</span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Resume Analyzer
              </h1>
              <p className="text-gray-600 mt-2">
                AI-powered bulk resume analysis and candidate ranking system
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
              {analyzed && resumes.some((r) => r.status === "completed") && (
                <button
                  onClick={exportResults}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 btn-primary"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Results
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-6">
              Scoring Criteria Weights
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {Object.entries(criteriaWeights).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                    {key} ({Math.round(value * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={value}
                    onChange={(e) =>
                      setCriteriaWeights((prev) => ({
                        ...prev,
                        [key]: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Tip:</strong> Adjust weights based on role requirements.
                Technical roles should emphasize skills, senior roles should
                emphasize experience.
              </p>
            </div>
          </div>
        )}

        {/* Job Description */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Job Description
          </h2>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the complete job description here. Include required skills, experience level, education requirements, and key responsibilities. The more detailed the description, the more accurate the analysis will be."
            className="w-full h-48 p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
          />
          <div className="mt-2 text-sm text-gray-500">
            Characters: {jobDescription.length} | Words:{" "}
            {jobDescription.trim()
              ? jobDescription.trim().split(/\s+/).length
              : 0}
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Upload Resumes
          </h2>
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="file-upload"
              className="file-upload-zone flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag
                  and drop
                </p>
                <p className="text-xs text-gray-500">
                  PDF files or ZIP archives containing PDFs
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Supports bulk upload of up to 175 resumes
                </p>
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.zip"
                onChange={handleFileUpload}
                ref={fileInputRef}
              />
            </label>
          </div>

          {resumes.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-sm text-gray-600">
                    <strong>{resumes.length}</strong> resume(s) uploaded
                  </p>
                  <p className="text-xs text-gray-500">
                    {resumes.filter((r) => r.status === "completed").length}{" "}
                    completed,{" "}
                    {resumes.filter((r) => r.status === "pending").length}{" "}
                    pending,{" "}
                    {resumes.filter((r) => r.status === "error").length} errors
                  </p>
                </div>
                <div className="flex gap-3">
                  {isProcessing ? (
                    <button
                      onClick={stopProcessing}
                      className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 btn-danger"
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Stop Processing
                    </button>
                  ) : (
                    <button
                      onClick={processResumes}
                      disabled={
                        !jobDescription.trim() ||
                        resumes.filter((r) => r.status === "pending").length ===
                          0
                      }
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed btn-primary"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Analyze Resumes
                    </button>
                  )}
                </div>
              </div>

              {isProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex items-center mb-3">
                    <div className="spinner rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                    <span className="text-sm text-blue-700 font-medium">
                      Processing resumes...{" "}
                      {resumes.filter((r) => r.status === "completed").length}{" "}
                      of {resumes.length} completed
                    </span>
                  </div>
                  {processingStatus && (
                    <p className="text-xs text-blue-600 mb-2">
                      {processingStatus}
                    </p>
                  )}
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full progress-bar"
                      style={{
                        width: `${
                          (resumes.filter((r) => r.status === "completed")
                            .length /
                            resumes.length) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resume Results */}
        {resumes.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Resume Analysis Results
                </h2>
                {analyzed && (
                  <div className="text-sm text-gray-500">
                    Sorted by score (highest first)
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Overall Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Detailed Scores
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedResumes.map((resume, index) => (
                    <tr key={resume.id} className="table-row">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analyzed && resume.status === "completed"
                          ? `#${index + 1}`
                          : "-"}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            <button
                              onClick={() =>
                                resume.fullText
                                  ? setSelectedResumeId(resume.id)
                                  : null
                              }
                              className={`text-sm font-medium ${
                                resume.fullText
                                  ? "text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                  : "text-gray-900 cursor-default"
                              }`}
                            >
                              {resume.contact?.name || "Processing..."}
                            </button>
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {resume.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {resume.contact &&
                        Object.keys(resume.contact).length > 0 ? (
                          <div className="space-y-1">
                            {resume.contact.email && (
                              <div className="flex items-center">
                                <Mail className="w-3 h-3 mr-1 text-gray-400" />
                                <span className="text-xs truncate">
                                  {resume.contact.email}
                                </span>
                              </div>
                            )}
                            {resume.contact.phone && (
                              <div className="flex items-center">
                                <Phone className="w-3 h-3 mr-1 text-gray-400" />
                                <span className="text-xs">
                                  {resume.contact.phone}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {resume.score ? (
                          <button
                            onClick={() => setShowGradeSummary(resume.id)}
                            className={`score-badge inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(
                              resume.score
                            )}`}
                          >
                            {getScoreIcon(resume.score)}
                            <span className="ml-1">{resume.score}%</span>
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {resume.analysis &&
                        Object.keys(resume.analysis).length > 0 ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Skills:</span>
                              <span className="font-medium">
                                {resume.analysis.skillsMatch}%
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Experience:</span>
                              <span className="font-medium">
                                {resume.analysis.experienceMatch}%
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Education:</span>
                              <span className="font-medium">
                                {resume.analysis.educationMatch}%
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Keywords:</span>
                              <span className="font-medium">
                                {resume.analysis.keywordMatch}%
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            resume.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : resume.status === "processing"
                              ? "bg-blue-100 text-blue-800"
                              : resume.status === "error"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {resume.status === "error" && resume.error
                            ? "Error"
                            : resume.status}
                        </span>
                        {resume.status === "error" && resume.error && (
                          <div
                            className="text-xs text-red-600 mt-1 max-w-xs truncate"
                            title={resume.error}
                          >
                            {resume.error}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {resume.fullText && (
                            <button
                              onClick={() => setSelectedResumeId(resume.id)}
                              className="text-blue-600 hover:text-blue-900 p-1"
                              title="View resume"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {resume.analysis && (
                            <button
                              onClick={() => setShowGradeSummary(resume.id)}
                              className="text-green-600 hover:text-green-900 p-1"
                              title="View grade summary"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => removeResume(resume.id)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Remove resume"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {analyzed && resumes.some((r) => r.status === "completed") && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {sortedResumes.filter((r) => r.score >= 85).length}
                    </div>
                    <div className="text-gray-600">Excellent (85%+)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {
                        sortedResumes.filter(
                          (r) => r.score >= 75 && r.score < 85
                        ).length
                      }
                    </div>
                    <div className="text-gray-600">Strong (75-84%)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {
                        sortedResumes.filter(
                          (r) => r.score >= 65 && r.score < 75
                        ).length
                      }
                    </div>
                    <div className="text-gray-600">Good (65-74%)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {Math.round(
                        sortedResumes
                          .filter((r) => r.score > 0)
                          .reduce((sum, r) => sum + r.score, 0) /
                          sortedResumes.filter((r) => r.score > 0).length
                      ) || 0}
                      %
                    </div>
                    <div className="text-gray-600">Average Score</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grade Summary Modal */}
      {showGradeSummary && (
        <GradeSummaryModal
          resume={resumes.find((r) => r.id === showGradeSummary)}
          onClose={() => setShowGradeSummary(null)}
        />
      )}

      {/* Resume Viewer Modal */}
      {selectedResumeId && (
        <ResumeViewerModal
          resume={resumes.find((r) => r.id === selectedResumeId)}
          onClose={() => setSelectedResumeId(null)}
        />
      )}
    </div>
  );
};

export default ResumeAnalyzer;
