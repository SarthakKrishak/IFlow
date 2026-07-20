import type { Role, Department } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    username: string;
    displayName: string;
    role: Role;
    department: Department;
    avatarColor: string;
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      displayName: string;
      role: Role;
      department: Department;
      avatarColor: string;
      mustChangePassword: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    displayName: string;
    role: Role;
    department: Department;
    avatarColor: string;
    mustChangePassword: boolean;
  }
}
