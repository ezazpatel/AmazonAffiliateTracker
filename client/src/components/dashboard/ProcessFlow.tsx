import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, ShoppingCart, Brain, FileText, Clock } from "lucide-react";

interface ProcessStepProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  isLast?: boolean;
}

function ProcessStep({ icon, title, description, isLast = false }: ProcessStepProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-neutral-800">{title}</p>
      <p className="text-xs text-neutral-600 text-center mt-1 max-w-[150px]">{description}</p>
      
      {!isLast && (
        <div className="hidden md:block absolute right-0 top-8 translate-x-1/2 text-neutral-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function ProcessFlow() {
  const steps = [
    {
      icon: <Upload className="h-6 w-6 text-white" />,
      title: "Upload CSV",
      description: "Import keywords with schedule",
    },
    {
      icon: <ShoppingCart className="h-6 w-6 text-white" />,
      title: "Fetch Products",
      description: "Amazon API product search",
    },
    {
      icon: <Brain className="h-6 w-6 text-white" />,
      title: "Generate Content",
      description: "Anthropic AI content creation",
    },
    {
      icon: <FileText className="h-6 w-6 text-white" />,
      title: "Format Article",
      description: "Structure with headings & images",
    },
    {
      icon: <Clock className="h-6 w-6 text-white" />,
      title: "Schedule Post",
      description: "Publish at set date & time",
    },
  ];

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-neutral-800">Content Generation Process</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          {steps.map((step, index) => (
            <div key={index} className="relative mb-6 md:mb-0 w-full md:w-auto">
              <ProcessStep
                icon={step.icon}
                title={step.title}
                description={step.description}
                isLast={index === steps.length - 1}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
