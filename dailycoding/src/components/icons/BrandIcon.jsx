import {
  SiAngular,
  SiC,
  SiCplusplus,
  SiDjango,
  SiDocker,
  SiExpress,
  SiFastapi,
  SiFlutter,
  SiGit,
  SiGo,
  SiGooglegemini,
  SiGooglecloud,
  SiInstagram,
  SiJavascript,
  SiKotlin,
  SiKubernetes,
  SiMongodb,
  SiMysql,
  SiNextdotjs,
  SiNodedotjs,
  SiOpenjdk,
  SiPostgresql,
  SiPython,
  SiReact,
  SiRedis,
  SiRust,
  SiSpring,
  SiSwift,
  SiTistory,
  SiTypescript,
  SiVelog,
  SiVuedotjs,
  SiX,
} from 'react-icons/si';
import { FaAws, FaGithub, FaInstagram, FaLinkedin, FaMicrosoft } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

export const TECH_STACK_OPTIONS = [
  'JavaScript','TypeScript','Python','Java','C++','C','Go','Rust','Kotlin','Swift',
  'React','Vue','Angular','Next.js','Node.js','Express','Spring','Django','FastAPI','Flutter',
  'MySQL','PostgreSQL','MongoDB','Redis','Docker','Kubernetes','AWS','GCP','Azure','Git',
];

export const MAIN_TECH_STACK = ['React', 'Node.js', 'MySQL', 'Redis', 'Docker', 'Gemini AI'];

const normalizeIconKey = (value = '') => String(value).trim().toLowerCase().replace(/[#.+\s_-]/g, '');

export const TECH_ICON_META = {
  javascript: { label: 'JavaScript', Icon: SiJavascript, color: '#f7df1e' },
  js: { alias: 'javascript' },
  typescript: { label: 'TypeScript', Icon: SiTypescript, color: '#3178c6' },
  ts: { alias: 'typescript' },
  python: { label: 'Python', Icon: SiPython, color: '#3776ab' },
  py: { alias: 'python' },
  java: { label: 'Java', Icon: SiOpenjdk, color: '#f89820' },
  openjdk: { alias: 'java' },
  cplusplus: { label: 'C++', Icon: SiCplusplus, color: '#00599c' },
  cpp: { alias: 'cplusplus' },
  c: { label: 'C', Icon: SiC, color: '#a8b9cc' },
  go: { label: 'Go', Icon: SiGo, color: '#00add8' },
  golang: { alias: 'go' },
  rust: { label: 'Rust', Icon: SiRust, color: '#dea584' },
  kotlin: { label: 'Kotlin', Icon: SiKotlin, color: '#7f52ff' },
  swift: { label: 'Swift', Icon: SiSwift, color: '#f05138' },
  react: { label: 'React', Icon: SiReact, color: '#61dafb' },
  vue: { label: 'Vue', Icon: SiVuedotjs, color: '#4fc08d' },
  vuejs: { alias: 'vue' },
  angular: { label: 'Angular', Icon: SiAngular, color: '#dd0031' },
  nextjs: { label: 'Next.js', Icon: SiNextdotjs, color: 'currentColor' },
  next: { alias: 'nextjs' },
  nodejs: { label: 'Node.js', Icon: SiNodedotjs, color: '#5fa04e' },
  node: { alias: 'nodejs' },
  express: { label: 'Express', Icon: SiExpress, color: 'currentColor' },
  expressjs: { alias: 'express' },
  spring: { label: 'Spring', Icon: SiSpring, color: '#6db33f' },
  springboot: { alias: 'spring' },
  django: { label: 'Django', Icon: SiDjango, color: '#44b78b' },
  fastapi: { label: 'FastAPI', Icon: SiFastapi, color: '#009688' },
  flutter: { label: 'Flutter', Icon: SiFlutter, color: '#02569b' },
  mysql: { label: 'MySQL', Icon: SiMysql, color: '#4479a1' },
  postgresql: { label: 'PostgreSQL', Icon: SiPostgresql, color: '#4169e1' },
  postgres: { alias: 'postgresql' },
  mongodb: { label: 'MongoDB', Icon: SiMongodb, color: '#47a248' },
  mongo: { alias: 'mongodb' },
  redis: { label: 'Redis', Icon: SiRedis, color: '#ff4438' },
  docker: { label: 'Docker', Icon: SiDocker, color: '#2496ed' },
  kubernetes: { label: 'Kubernetes', Icon: SiKubernetes, color: '#326ce5' },
  k8s: { alias: 'kubernetes' },
  aws: { label: 'AWS', Icon: FaAws, color: '#ff9900' },
  amazonwebservices: { alias: 'aws' },
  gcp: { label: 'GCP', Icon: SiGooglecloud, color: '#4285f4' },
  googlecloud: { alias: 'gcp' },
  azure: { label: 'Azure', Icon: FaMicrosoft, color: '#0078d4' },
  microsoftazure: { alias: 'azure' },
  git: { label: 'Git', Icon: SiGit, color: '#f05032' },
  geminiai: { label: 'Gemini AI', Icon: SiGooglegemini, color: '#8e75ff' },
  gemini: { alias: 'geminiai' },
  googlegemini: { alias: 'geminiai' },
};

export const SOCIAL_ICON_META = {
  github: { label: 'GitHub', Icon: FaGithub, color: 'var(--text2)' },
  instagram: { label: 'Instagram', Icon: FaInstagram, color: '#e1306c' },
  x: { label: 'X', Icon: FaXTwitter, color: 'var(--text2)' },
  twitter: { label: 'X', Icon: FaXTwitter, color: 'var(--text2)' },
  linkedin: { label: 'LinkedIn', Icon: FaLinkedin, color: '#0a66c2' },
  velog: { label: 'Velog', Icon: SiVelog, color: '#20c997' },
  tistory: { label: 'Tistory', Icon: SiTistory, color: '#ff5a00' },
  siinstagram: { label: 'Instagram', Icon: SiInstagram, color: '#e1306c' },
  six: { label: 'X', Icon: SiX, color: 'var(--text2)' },
};

export function getTechIconMeta(name) {
  let key = normalizeIconKey(name);
  let meta = TECH_ICON_META[key];
  if (meta?.alias) meta = TECH_ICON_META[meta.alias];
  return meta || { label: name || 'Tech', Icon: null, color: 'var(--text3)' };
}

export function getSocialIconMeta(name) {
  const key = normalizeIconKey(name);
  return SOCIAL_ICON_META[key] || { label: name || 'Link', Icon: null, color: 'var(--text3)' };
}

function FallbackBadge({ label, size = 16, className = '', style = {} }) {
  const text = String(label || '?').replace(/[^a-z0-9+#]/gi, '').slice(0, 3).toUpperCase() || '?';
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: Math.max(4, Math.round(size * 0.28)),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--border)',
        background: 'var(--bg3)',
        color: 'var(--text2)',
        fontSize: Math.max(8, Math.round(size * 0.42)),
        fontWeight: 900,
        lineHeight: 1,
        ...style,
      }}
    >
      {text}
    </span>
  );
}

export function TechIcon({ name, size = 16, className = '', title, decorative = true, style = {} }) {
  const meta = getTechIconMeta(name);
  const label = title || meta.label || name;
  if (!meta.Icon) return <FallbackBadge label={label} size={size} className={className} style={style} />;
  return (
    <meta.Icon
      className={className}
      size={size}
      color={meta.color}
      title={decorative ? undefined : label}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
      style={{ flexShrink: 0, ...style }}
    />
  );
}

export function SocialIcon({ name, size = 16, className = '', title, decorative = true, style = {} }) {
  const meta = getSocialIconMeta(name);
  const label = title || meta.label || name;
  if (!meta.Icon) return <FallbackBadge label={label} size={size} className={className} style={style} />;
  return (
    <meta.Icon
      className={className}
      size={size}
      color={meta.color}
      title={decorative ? undefined : label}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
      style={{ flexShrink: 0, ...style }}
    />
  );
}
