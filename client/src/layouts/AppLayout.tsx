import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Menu, Bell, HelpCircle } from "lucide-react";
import { useLocation } from "wouter";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const currentPath = location || "/";

  const getPageTitle = () => {
    switch (currentPath) {
      case "/":
        return "Dashboard";
      case "/csv-uploader":
        return "CSV Uploader";
      case "/generated-content":
        return "Generated Content";
      case "/scheduled-posts":
        return "Scheduled Posts";
      case "/api-settings":
        return "API Settings";
      default:
        return "Dashboard";
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} currentPath={currentPath} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden mr-4 text-neutral-600 hover:text-neutral-800"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu />
              </Button>
              <h2 className="text-xl font-semibold text-neutral-800">{getPageTitle()}</h2>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" className="text-neutral-600 hover:text-neutral-800 relative">
                <Bell />
                <span className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full"></span>
              </Button>
              <Button variant="ghost" size="icon" className="text-neutral-600 hover:text-neutral-800">
                <HelpCircle />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-neutral-50">
          {children}
        </main>
      </div>
    </div>
  );
}
