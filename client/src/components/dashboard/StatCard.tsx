import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change: {
    value: string;
    isPositive: boolean;
    text: string;
  };
  color: "primary" | "accent" | "secondary" | "destructive";
}

export default function StatCard({ title, value, icon: Icon, change, color }: StatCardProps) {
  const getColorClass = () => {
    switch (color) {
      case "primary":
        return "bg-primary-light bg-opacity-20 text-primary";
      case "accent":
        return "bg-accent-light bg-opacity-20 text-accent";
      case "secondary":
        return "bg-secondary-light bg-opacity-20 text-secondary";
      case "destructive":
        return "bg-destructive bg-opacity-20 text-destructive";
      default:
        return "bg-primary-light bg-opacity-20 text-primary";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-600">{title}</p>
          <h3 className="text-2xl font-bold text-neutral-800 mt-1">{value}</h3>
        </div>
        <div className={`p-3 rounded-full ${getColorClass()}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-center mt-4">
        <span className={`text-sm flex items-center ${change.isPositive ? 'text-success' : 'text-destructive'}`}>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            {change.isPositive ? (
              <path 
                fillRule="evenodd" 
                d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" 
                clipRule="evenodd" 
              />
            ) : (
              <path 
                fillRule="evenodd" 
                d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            )}
          </svg>
          {change.value}
        </span>
        <span className="text-xs text-neutral-600 ml-2">{change.text}</span>
      </div>
    </div>
  );
}
