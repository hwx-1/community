import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ToolsPage from './pages/ToolsPage'
import MessagesPage from './pages/MessagesPage'
import ProfilePage from './pages/ProfilePage'
import ComposePage from './pages/ComposePage'
import SearchPage from './pages/SearchPage'
import AuthPage from './pages/AuthPage'
import PostDetailPage from './pages/PostDetailPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import ChatPage from './pages/ChatPage'
import AIPage from './pages/AIPage'
import MapPage from './pages/MapPage'
import LinksPage from './pages/LinksPage'
import EditProfilePage from './pages/EditProfilePage'
import VerificationPage from './pages/VerificationPage'
import AccountSettingsPage from './pages/AccountSettingsPage'
import PublicProfilePage from './pages/PublicProfilePage'
import OnboardingPage from './pages/OnboardingPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/me" element={<ProfilePage />} />
        <Route path="/compose" element={<ComposePage />} />
        <Route path="/compose/:postId" element={<ComposePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/posts/:postId" element={<PostDetailPage />} />
        <Route path="/users/:userId" element={<PublicProfilePage />} />
        <Route path="/messages/:conversationId" element={<ChatPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/announcements/:announcementId" element={<AnnouncementsPage />} />
        <Route path="/tools/ai" element={<AIPage />} />
        <Route path="/tools/map" element={<MapPage />} />
        <Route path="/tools/links" element={<LinksPage />} />
        <Route path="/me/edit" element={<EditProfilePage />} />
        <Route path="/me/verification" element={<VerificationPage />} />
        <Route path="/me/settings" element={<AccountSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
