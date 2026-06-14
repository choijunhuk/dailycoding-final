import { lazy } from 'react'
import { Navigate } from 'react-router-dom'
import AuthPage from '../pages/AuthPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import ResetPasswordPage from '../pages/ResetPasswordPage'
import VerifyEmailPage from '../pages/VerifyEmailPage'
import LandingPage from '../pages/LandingPage'
import TermsPage from '../pages/TermsPage'
import PrivacyPage from '../pages/PrivacyPage'
import NotFoundPage from '../pages/NotFoundPage'

const Dashboard = lazy(() => import('../pages/Dashboard'))
const ProblemsPage = lazy(() => import('../pages/ProblemsPage'))
const JudgePage = lazy(() => import('../pages/JudgePage'))
const ContestPage = lazy(() => import('../pages/ContestPage'))
const RankingPage = lazy(() => import('../pages/RankingPage'))
const AiPage = lazy(() => import('../pages/AiPage'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))
const SubmissionsPage = lazy(() => import('../pages/SubmissionsPage'))
const AdminPage = lazy(() => import('../pages/AdminPage'))
const BattlePage = lazy(() => import('../pages/BattlePage'))
const AlgorithmBattlePage = lazy(() => import('../pages/AlgorithmBattlePage'))
const ReviewsPage = lazy(() => import('../pages/ReviewsPage'))
const PricingPage = lazy(() => import('../pages/PricingPage'))
const TeamDashboard = lazy(() => import('../pages/TeamDashboard'))
const JoinTeamPage = lazy(() => import('../pages/JoinTeamPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const CommunityPage = lazy(() => import('../pages/CommunityPage'))
const PublicProfilePage = lazy(() => import('../pages/PublicProfilePage'))
const SharedSubmissionPage = lazy(() => import('../pages/SharedSubmissionPage'))
const SharedBattleReplayPage = lazy(() => import('../pages/SharedBattleReplayPage'))
const ExamListPage = lazy(() => import('../pages/ExamListPage'))
const ExamPage = lazy(() => import('../pages/ExamPage'))
const SheetsPage = lazy(() => import('../pages/SheetsPage'))
const SheetDetailPage = lazy(() => import('../pages/SheetDetailPage'))
const LearningPathPage = lazy(() => import('../pages/LearningPathPage'))
const SubmitProblemPage = lazy(() => import('../pages/SubmitProblemPage'))
const ProblemSetsPage = lazy(() => import('../pages/ProblemSetsPage'))
const GameHubPage = lazy(() => import('../pages/GameHubPage'))
const ArcadePage = lazy(() => import('../pages/ArcadePage'))
const ArcadeGamePage = lazy(() => import('../pages/ArcadeGamePage'))
const TournamentPage = lazy(() => import('../pages/TournamentPage'))
const BadgesPage = lazy(() => import('../pages/BadgesPage'))
const CompetePage = lazy(() => import('../pages/CompetePage'))
const WorkshopPage = lazy(() => import('../pages/WorkshopPage'))
const WorkshopGalleryPage = lazy(() => import('../pages/WorkshopGalleryPage'))
const RecoveryPage = lazy(() => import('../pages/RecoveryPage'))

export const PUBLIC_ROUTES = [
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/share/:slug', element: <SharedSubmissionPage /> },
  { path: '/share/battle/:slug', element: <SharedBattleReplayPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/pricing', element: <PricingPage /> },
  { path: '/battle/:id/replay', element: <BattlePage /> },
  { path: '/login', element: <AuthPage /> },
  {
    path: '/',
    makeElement: ({ navigate }) => (
      <LandingPage
        onLogin={() => navigate('/login')}
        onSignup={() => navigate('/login', { state: { mode: 'register' } })}
        onPricing={() => navigate('/pricing')}
      />
    ),
  },
  { path: '*', element: <AuthPage /> },
]

export const AUTHENTICATED_ROUTES = [
  { path: '/', element: <Dashboard /> },
  { path: '/problems', element: <ProblemsPage /> },
  { path: '/judge', redirectTo: '/problems' },
  { path: '/problems/:id', element: <JudgePage /> },
  { path: '/compete', element: <CompetePage /> },
  { path: '/contest', element: <ContestPage /> },
  { path: '/tournaments', element: <TournamentPage /> },
  { path: '/ranking', element: <RankingPage /> },
  { path: '/community', element: <CommunityPage /> },
  { path: '/community/:board', element: <CommunityPage /> },
  { path: '/community/:board/:id', element: <CommunityPage /> },
  { path: '/ai', element: <AiPage /> },
  { path: '/exams', element: <ExamListPage /> },
  { path: '/exams/:id', element: <ExamPage /> },
  { path: '/sheets', element: <SheetsPage /> },
  { path: '/sheets/:id', element: <SheetDetailPage /> },
  { path: '/learning', element: <LearningPathPage /> },
  { path: '/learning/:id', element: <LearningPathPage /> },
  { path: '/growth', redirectTo: '/learning' },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/rewards', element: <BadgesPage /> },
  { path: '/badges', element: <BadgesPage /> },
  { path: '/user/:id', element: <PublicProfilePage /> },
  { path: '/submissions', element: <SubmissionsPage /> },
  { path: '/submit-problem', element: <SubmitProblemPage /> },
  { path: '/problem-sets', element: <ProblemSetsPage /> },
  { path: '/problem-sets/shared/:token', element: <ProblemSetsPage /> },
  { path: '/reviews', element: <ReviewsPage /> },
  { path: '/reviews/:id', element: <ReviewsPage /> },
  { path: '/battle', element: <AlgorithmBattlePage /> },
  { path: '/recovery', element: <RecoveryPage /> },
  { path: '/workshop', element: <WorkshopPage /> },
  { path: '/workshop/:id', element: <WorkshopPage /> },
  { path: '/workshop-gallery', element: <WorkshopGalleryPage /> },
  { path: '/game', element: <GameHubPage /> },
  { path: '/arcade', element: <ArcadePage /> },
  { path: '/arcade/:key', element: <ArcadeGamePage /> },
  { path: '/battle/:id/replay', element: <BattlePage /> },
  { path: '/battle/:roomId', element: <AlgorithmBattlePage /> },
  { path: '/battles/history', element: <BattlePage /> },
  { path: '/battle/watch/:roomId', element: <BattlePage /> },
  { path: '/share/:slug', element: <SharedSubmissionPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/pricing', element: <PricingPage /> },
  { path: '/team', element: <TeamDashboard /> },
  { path: '/join/team/:token', element: <JoinTeamPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/admin', element: <AdminPage />, requiresAdmin: true },
  { path: '*', element: <NotFoundPage /> },
]

export function getRoutePaths(routes) {
  return routes.map((route) => route.path)
}

export function renderRouteElement(route, { navigate, isAdmin }) {
  if (route.redirectTo) return <Navigate to={route.redirectTo} replace />
  if (route.requiresAdmin && !isAdmin) return <Navigate to="/" replace />
  if (route.makeElement) return route.makeElement({ navigate, isAdmin })
  return route.element
}
