import { Routes, Route, Navigate } from "react-router"
import Layout from "@/components/layout/Layout"
import LandingPage from "@/pages/LandingPage"
import HomePage from "@/pages/HomePage"
import SoftwareDetailPage from "@/pages/SoftwareDetailPage"
import ArticleListPage from "@/pages/ArticleListPage"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="catalog" element={<HomePage />} />
        <Route path="software/:id" element={<SoftwareDetailPage />} />
        <Route path="articles" element={<ArticleListPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
