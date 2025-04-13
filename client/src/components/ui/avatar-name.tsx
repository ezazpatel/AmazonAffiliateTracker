import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AvatarNameProps {
  name: string;
  email: string;
}

export default function AvatarName({ name, email }: AvatarNameProps) {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center">
      <Avatar className="h-8 w-8 bg-primary text-white">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="ml-3">
        <p className="text-sm font-medium text-neutral-800">{name}</p>
        <p className="text-xs text-neutral-600">{email}</p>
      </div>
    </div>
  );
}
