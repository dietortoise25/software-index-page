import { Routes, Route, Navigate } from "react-router"
import Layout from "@/components/layout/Layout"
import LandingPage from "@/pages/LandingPage"
import HomePage from "@/pages/HomePage"
import SoftwareDetailPage from "@/pages/SoftwareDetailPage"
import ArticleListPage from "@/pages/ArticleListPage"
import ArticleDetailPage from "@/pages/ArticleDetailPage"
import ReviewPage from "@/pages/ReviewPage"
import ReturnWorkflowPage from "@/pages/ReturnWorkflowPage"
import DashboardPage from "@/pages/DashboardPage"
import InternalAdminPage from "@/pages/InternalAdminPage"
import ChangelogPage from "@/pages/ChangelogPage"
import PptPage from "@/pages/PptPage"
import AboutPage from "@/pages/AboutPage"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="catalog" element={<HomePage />} />
        <Route path="software/:id" element={<SoftwareDetailPage />} />
        <Route path="articles" element={<ArticleListPage />} />
        <Route path="articles/:id" element={<ArticleDetailPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="changelog" element={<ChangelogPage />} />
        <Route path="return-workflow" element={<ReturnWorkflowPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="internal/admin" element={<InternalAdminPage />} />
        <Route path="ppt/:id" element={<PptPage />} />
        <Route path="ppt" element={<PptPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
