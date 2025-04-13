import { Link } from "wouter";
import { LayoutDashboard, Upload, FileText, Clock, Settings, Menu, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AvatarName from "@/components/ui/avatar-name";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentPath: string;
}

export function Sidebar({ isOpen, setIsOpen, currentPath }: SidebarProps) {
  const navItems = [
    { path: "/", label: "Dashboard", icon: <LayoutDashboard className="mr-3 h-5 w-5" /> },
    { path: "/csv-uploader", label: "CSV Uploader", icon: <Upload className="mr-3 h-5 w-5" /> },
    { path: "/generated-content", label: "Generated Content", icon: <FileText className="mr-3 h-5 w-5" /> },
    { path: "/scheduled-posts", label: "Scheduled Posts", icon: <Clock className="mr-3 h-5 w-5" /> },
    { path: "/api-settings", label: "API Settings", icon: <Settings className="mr-3 h-5 w-5" /> },
  ];

  return (
    <aside 
      className={`${isOpen ? 'fixed inset-0 z-50 flex md:hidden' : 'hidden md:flex'} flex-col w-64 bg-white border-r border-neutral-100 shadow-sm`}
    >
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center">
          <div className="bg-primary rounded-md p-1 mr-2">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-neutral-800">AffiliateCraft</h1>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden text-neutral-600 hover:text-neutral-800"
          onClick={() => setIsOpen(false)}
        >
          <XCircle className="h-5 w-5" />
        </Button>
      </div>
      
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <a 
                  className={`flex items-center px-4 py-3 text-sm ${
                    currentPath === item.path 
                      ? "text-primary bg-blue-50" 
                      : "text-neutral-600 hover:bg-blue-50 hover:text-primary"
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-neutral-100">
        <AvatarName name="John Doe" email="john.doe@example.com" />
      </div>
    </aside>
  );
}
