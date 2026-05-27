import { Routes, Route, Navigate } from "react-router"
import { AuthProvider } from "@/lib/auth-context"
import Layout from "@/components/layout/Layout"
import DashboardLayout from "@/components/layout/DashboardLayout"
import LandingPage from "@/pages/LandingPage"
import HomePage from "@/pages/HomePage"
import SoftwareDetailPage from "@/pages/SoftwareDetailPage"
import ArticleListPage from "@/pages/ArticleListPage"
import ArticleDetailPage from "@/pages/ArticleDetailPage"
import ReviewPage from "@/pages/ReviewPage"
import ReturnWorkflowPage from "@/pages/ReturnWorkflowPage"
import DashboardPage from "@/pages/DashboardPage"
import InternalAdminPage from "@/pages/InternalAdminPage"
import PermissionsPage from "@/pages/PermissionsPage"
import ArticleManagePage from "@/pages/ArticleManagePage"
import RegisterPage from "@/pages/RegisterPage"
import ChangelogPage from "@/pages/ChangelogPage"
import PptPage from "@/pages/PptPage"
import AboutPage from "@/pages/AboutPage"
import FuturePage from "@/pages/FuturePage"
import TikTokShopTestPage from "@/pages/TikTokShopTestPage"
import LoginPage from "@/pages/LoginPage"
import ShopeeAnalyzePage from "@/pages/ShopeeAnalyzePage"
import ShopeeDashboardPage from "@/pages/ShopeeDashboardPage"
import AgentTestPage from "@/pages/AgentTestPage"

export default function App() {
  return (
    <AuthProvider>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="catalog" element={<HomePage />} />
        <Route path="software/:id" element={<SoftwareDetailPage />} />
        <Route path="articles" element={<ArticleListPage />} />
        <Route path="articles/:id" element={<ArticleDetailPage />} />
        <Route path="changelog" element={<ChangelogPage />} />
        <Route path="return-workflow" element={<ReturnWorkflowPage />} />
        <Route path="ppt/:id" element={<PptPage />} />
        <Route path="ppt" element={<PptPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="tiktok-shop-test" element={<TikTokShopTestPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="shopee" element={<ShopeeAnalyzePage />} />
        <Route path="shopee/dashboard" element={<ShopeeDashboardPage />} />
        <Route path="agent-test" element={<AgentTestPage />} />
      </Route>

      {/* Dashboard — 侧边栏布局 */}
      <Route path="dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="admin" element={<InternalAdminPage />} />
        <Route path="permission" element={<PermissionsPage />} />
        <Route path="articles" element={<ArticleManagePage />} />
      </Route>

      <Route path="future" element={<FuturePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AuthProvider>
  )
}
