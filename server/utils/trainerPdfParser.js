const fs = require('fs').promises;
const { PDFParse } = require('pdf-parse');

const TOPIC_KEYWORDS = {
  'Core Java': ['core java', 'java fundamentals'],
  'Java FSD': ['java fsd', 'full stack java', 'java full stack'],
  'MERN Stack': ['mern', 'mongodb express react node'],
  'MEAN Stack': ['mean', 'mongodb express angular node'],
  'Python': ['python', 'flask', 'fastapi'],
  'AWS Cloud': ['aws', 'ec2', 's3', 'lambda', 'rds', 'cloudformation'],
  'Azure Cloud': ['azure', 'arm', 'azure devops'],
  'Frontend Development': ['react', 'next.js', 'nextjs', 'angular', 'tailwind', 'material ui', 'frontend'],
  'Backend Development': ['node.js', 'nodejs', 'express', 'spring boot', 'backend', 'microservices'],
  'Database': ['mongodb', 'postgresql', 'mysql', 'database', 'sql'],
  'Linux & Shell Scripting': ['linux', 'unix', 'shell scripting', 'bash'],
  'DevOps': ['devops', 'jenkins', 'docker', 'kubernetes', 'ci/cd'],
  'GenAI & LLM': ['genai', 'llm', 'langchain', 'rag', 'vector database', 'prompt engineering'],
  'Telecom': ['telecom', 'pstn', 'oss', 'bss', '2g', '3g', '4g', '5g'],
  'Interview Preparation': ['interview', 'fresher readiness', 'technical mentor']
};

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function extractName(lines) {
  return (
    lines.find((line) => {
      if (!line) return false;
      if (line.length < 4 || line.length > 60) return false;
      if (/[@\d]|linkedin|github|summary|experience|skills|education|certifications/i.test(line)) return false;
      return /^[A-Za-z][A-Za-z\s.]+$/.test(line);
    }) || ''
  );
}

function extractEmail(text) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
}

function extractPhone(text) {
  const match = text.match(/(?:\+91[-\s]?)?[6-9]\d{9}/);
  return match ? match[0].replace(/\s+/g, '') : '';
}

function extractYearsOfExperience(text) {
  const match = text.match(/(\d+)\+?\s+years?\s+of\s+experience/i) || text.match(/experience\s*[:\-]?\s*(\d+)\+?\s+years?/i);
  return match ? Number(match[1]) : 0;
}

function extractTopics(text) {
  const normalized = text.toLowerCase();
  return unique(
    Object.entries(TOPIC_KEYWORDS)
      .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))
      .map(([label]) => label)
  );
}

async function extractTrainerProfileFromPdf(filePath) {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = (parsed.text || '').replace(/\r/g, '\n');
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const fullName = extractName(lines);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const yearsOfExperience = extractYearsOfExperience(text);
  const topics = extractTopics(text);

  return {
    fullName,
    email,
    phone,
    yearsOfExperience,
    specialization: topics.join(', '),
    topics,
    rawText: text.slice(0, 6000)
  };
}

module.exports = {
  extractTrainerProfileFromPdf
};