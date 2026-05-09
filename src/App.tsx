import { Routes, Route, Navigate } from "react-router"
import Layout from "@/components/layout/Layout"
import HomePage from "@/pages/HomePage"
import SoftwareDetailPage from "@/pages/SoftwareDetailPage"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="software/:id" element={<SoftwareDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
