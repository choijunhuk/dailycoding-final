# PRD: Shard 4 - AI Interviewer Mode

## Problem Statement
After successfully solving a coding problem, users often lack feedback on their algorithmic choices, time/space complexity, and handling of edge cases. To bridge the gap between solving a problem and mastering it for real-world technical interviews, an "AI Interviewer Mode" is needed to challenge the user's solution, prompting them to explain their reasoning, optimize their code, or handle extreme constraints.

## Scope
**In-Scope:**
- A post-solve transition into "AI Interviewer Mode" for accepted solutions.
- Backend API endpoints to initialize the interview and handle conversational replies using Google Gemini AI.
- A chat-like frontend UI integrated into the problem-solving or post-submission view.
- A prompt engineering strategy to enforce a strict but educational persona focused on time/space complexity and edge cases.
- Conversation history tracking per interview session.

**Non-Goals (Out of Scope):**
- Voice-based interviewing or real-time audio chat.
- Interviewing for incorrect or incomplete solutions (only triggers on 'Accepted' submissions).
- Replacing the primary code execution sandbox.
- Allowing users to write new code during the interview (it is a Q&A chat about the submitted code).
- Long-term persistent history of all past interviews (only recent or current session needs to be active).

## User Flow
1. **Trigger**: User submits code for a problem. The judge evaluates it and returns "Accepted".
2. **Prompt**: The UI presents a "Challenge: AI Interviewer" button or automatically slides into the interview mode depending on user settings/tier.
3. **Initialization**: The frontend calls `/api/ai/interview/start` with the problem ID and the user's submitted code.
4. **First Question**: The AI Interviewer analyzes the code and generates the first question (e.g., "Why did you choose this data structure?", "What is the time complexity?").
5. **Interaction**: The user types their response in a chat interface and sends it via `/api/ai/interview/reply`.
6. **Feedback Loop**: The AI evaluates the response, provides feedback (correcting misconceptions if necessary), and asks a follow-up or concludes the interview.
7. **Conclusion**: After 2-3 exchanges, the AI concludes the interview, summarizes the feedback, and awards any relevant points or badges (if applicable).

## Technical Requirements

### API Endpoints
- **`POST /api/ai/interview/start`**
  - **Payload**: `{ submissionId: string, problemId: string, code: string, language: string }`
  - **Response**: `{ interviewId: string, message: string }`
  - **Behavior**: Initializes a new interview session in the database/Redis, builds the initial prompt with the problem description and user code, calls Gemini AI, and returns the first question.
- **`POST /api/ai/interview/reply`**
  - **Payload**: `{ interviewId: string, message: string }`
  - **Response**: `{ message: string, isCompleted: boolean }`
  - **Behavior**: Appends the user's message to the session history, queries Gemini AI with the updated context, and returns the AI's response. Sets `isCompleted: true` if the AI decides the interview is over or the max turn limit (e.g., 3 turns) is reached.

### Prompt Engineering Strategy
**System Prompt Context:**
"You are a strict but educational Senior Software Engineer conducting a technical interview. The candidate has just successfully solved a coding problem. Your goal is to probe their understanding of their own code. Focus strictly on algorithmic time/space complexity, data structure choices, and edge cases (e.g., constraints up to 10^9, empty inputs, negative numbers). Do not be overly polite; be direct, professional, and rigorous. Ask only ONE question at a time. Do not write code for them unless demonstrating a critical optimization after they have attempted to answer. Keep responses concise."

**Initialization Prompt:**
"Problem: {Problem Description}. Candidate's Code: {Code}. The code passed all tests. Ask the first question to challenge their approach, complexity, or edge case handling."

### Frontend UI/UX
- **Component**: A sliding drawer, modal, or side-panel chat interface labeled "AI Interviewer".
- **Design**: Minimalist chat UI (similar to standard LLM chats) with distinct user and AI message bubbles.
- **Interaction**:
  - Input text area with "Send" button (Enter to send, Shift+Enter for newline).
  - Loading skeleton or typing indicator while waiting for the AI's response.
  - Markdown rendering for code snippets in the AI's responses.
- **State Management**: React state or Context to manage the active `interviewId` and `messages` array.

## Acceptance Criteria
- [ ] Users can enter AI Interviewer Mode only after a successful "Accepted" code submission.
- [ ] The `/api/ai/interview/start` endpoint successfully returns a context-aware question from Gemini based on the submitted code.
- [ ] The `/api/ai/interview/reply` endpoint correctly maintains conversation history and responds appropriately.
- [ ] The frontend displays a functional chat interface that renders markdown and handles loading states.
- [ ] The AI naturally concludes the interview after a maximum of 3-4 conversational turns.
- [ ] The prompt effectively prevents the AI from deviating from technical topics (algorithmic complexity and edge cases).

## Constraints and Dependencies
- **Dependencies**: Relies on the Google Gemini API for generation. Depends on the existing `Submission` and `Problem` models.
- **Constraints**: 
  - **Cost control**: Limit to 3-4 turns per interview to minimize Gemini API token usage.
  - **Latency**: AI responses must be reasonably fast (under 3-5 seconds); consider streaming responses via Server-Sent Events (SSE) or WebSockets if standard HTTP is too slow, though HTTP is acceptable for MVP.
  - **Rate Limiting**: Strict rate limiting on the API endpoints to prevent abuse.

## Risks and Mitigations
- **API Costs**: 
  - *Risk*: High token usage from lengthy conversations.
  - *Mitigation*: Hard cap the conversation at 3 turns. Summarize history if context window gets too large. Limit feature to premium tiers if necessary.
- **Hallucination / Irrelevant Questions**:
  - *Risk*: AI asks about features not in the code or hallucinates language features.
  - *Mitigation*: Strong system prompts binding the AI strictly to the provided code and problem text. Use a lower temperature setting (e.g., 0.2 - 0.4) for more deterministic and focused output.
- **User Frustration**:
  - *Risk*: The AI is too strict or fails to understand correct user explanations.
  - *Mitigation*: Tune the prompt to be "strict but educational" (Socratic method). Ensure the UI allows users to clearly end or skip the interview at any time without penalty.

## Handoff Checklist
- [ ] PRD reviewed and approved.
- [ ] API payload contracts confirmed between frontend and backend teams.
- [ ] Gemini API keys and rate limits verified for production environment.
- [ ] UI designs/wireframes for the chat interface finalized.
