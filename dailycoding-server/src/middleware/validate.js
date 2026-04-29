export function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const val = req.body[field];
      if (rules.required && (val === undefined || val === null || val === '')) {
        errors.push(`${field}은(는) 필수입니다.`);
        continue;
      }
      if (val !== undefined && val !== null && val !== '') {
        if (rules.minLength && String(val).length < rules.minLength)
          errors.push(`${field}은(는) ${rules.minLength}자 이상이어야 합니다.`);
        if (rules.maxLength && String(val).length > rules.maxLength)
          errors.push(`${field}은(는) ${rules.maxLength}자 이하여야 합니다.`);
        if (rules.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))
          errors.push(`올바른 이메일 형식이 아닙니다.`);
        if (rules.type === 'number' && isNaN(Number(val)))
          errors.push(`${field}은(는) 숫자여야 합니다.`);
        if (rules.enum && !rules.enum.includes(val))
          errors.push(`${field}은(는) ${rules.enum.join('/')} 중 하나여야 합니다.`);
        if (rules.regex && !rules.regex.test(val))
          errors.push(rules.message || `${field} 형식이 올바르지 않습니다.`);
      }
    }
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    next();
  };
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_MSG   = '비밀번호는 8자 이상이며, 대문자, 소문자, 숫자, 특수문자(@$!%*?&)를 각각 최소 하나 이상 포함해야 합니다.';

export const registerSchema = {
  email:    { required: true, type: 'email', maxLength: 255 },
  password: { 
    required: true, 
    minLength: 8,  
    maxLength: 100,
    regex: PASSWORD_REGEX,
    message: PASSWORD_MSG
  },
  username: { required: true, minLength: 2,  maxLength: 50  },
};

export const loginSchema = {
  email:    { required: true, type: 'email' },
  password: { required: true },
};

export const updatePasswordSchema = {
  current: { required: true },
  next: { 
    required: true, 
    minLength: 8,  
    maxLength: 100,
    regex: PASSWORD_REGEX,
    message: '새 ' + PASSWORD_MSG
  },
};

export const resetPasswordSchema = {
  token: { required: true },
  newPassword: { 
    required: true, 
    minLength: 8,  
    maxLength: 100,
    regex: PASSWORD_REGEX,
    message: '새 ' + PASSWORD_MSG
  },
};

export const adminResetPasswordSchema = {
  newPassword: { 
    required: true, 
    minLength: 8,  
    maxLength: 100,
    regex: PASSWORD_REGEX,
    message: '새 ' + PASSWORD_MSG
  },
};

export const profileSchema = {
  username: { minLength: 2, maxLength: 20 },
  bio: { maxLength: 200 },
  avatar_color: { enum: ['#cd7f32','#c0c0c0','#ffd700','#00e5cc','#b9f2ff','#79c0ff','#56d364','#f78166','#bc8cff','#e3b341','#ff7b72','#ffffff', null] },
  avatar_emoji: { enum: ['🦊','🐼','🦁','🐯','🐸','🦄','🐉','🦋','🐙','🦀','🐬','⭐','🔥','💎','🎯','🚀', null] },
  default_language: { enum: ['python', 'javascript', 'cpp', 'java', 'c'] },
};

export const problemSchema = {
  title: { required: true, minLength: 1, maxLength: 200 },
  problemType: { enum: ['coding', 'fill-blank', 'bug-fix'] },
  preferredLanguage: { enum: ['python', 'javascript', 'cpp', 'java', 'c', null] },
  tier: { enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'] },
  difficulty: { type: 'number' },
  timeLimit: { type: 'number' },
  memLimit: { type: 'number' },
  desc: { required: true, minLength: 1, maxLength: 50000 },
};

export const commentSchema = {
  text: { required: true, minLength: 1, maxLength: 1000 },
};

export const voteSchema = {
  vote: { required: true, type: 'number' },
};

export const submissionSchema = {
  problemId: { required: true, type: 'number' },
  lang: { required: true },
  code: { required: true, maxLength: 100000 },
};

export const runSchema = {
  problemId: { required: true, type: 'number' },
  lang: { required: true },
  code: { required: true, maxLength: 100000 },
  input: { maxLength: 10000 },
};

export const contestSchema = {
  name: { required: true, minLength: 1, maxLength: 100 },
  duration: { type: 'number' },
  privacy: { enum: ['public', 'private', '공개', '비공개'] },
  joinType: { enum: ['direct', 'approval'] },
  max: { type: 'number' },
};

export const communityPostSchema = {
  title: { required: true, minLength: 1, maxLength: 300 },
  content: { required: true, minLength: 1, maxLength: 10000 },
};
