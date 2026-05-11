import { Outlet } from "react-router"
import Header from "./Header"
import Footer from "./Footer"
import RequirementDialog from "@/components/common/RequirementDialog"

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <RequirementDialog />
    </div>
  )
}
