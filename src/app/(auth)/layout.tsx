import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { TopLoader } from "@/components/shared/TopLoader";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <TopLoader />
      {children}
    </ThemeProvider>
  );
}
