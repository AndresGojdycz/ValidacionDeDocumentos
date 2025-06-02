"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogInIcon, LogOutIcon } from "lucide-react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Button variant="outline" size="sm" disabled>Cargando...</Button>;
  }

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-brou-white hidden md:inline">
          {session.user?.email || session.user?.name}
        </span>
        <Button variant="outline" size="sm" onClick={() => signOut()} className="bg-brou-yellow text-brou-blue hover:bg-brou-yellow/90 border-brou-yellow">
          <LogOutIcon className="mr-2 h-4 w-4" />
          Salir
        </Button>
      </div>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={() => signIn("google")} className="bg-brou-yellow text-brou-blue hover:bg-brou-yellow/90 border-brou-yellow">
      <LogInIcon className="mr-2 h-4 w-4" />
      Ingresar con Google
    </Button>
  );
} 