import { Banknote } from "lucide-react";

export const metadata = {
  title: "Project Expenses - IFlow",
};

export default function ExpensesPage() {
  return (
    <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="bg-surface-elevated border-2 border-dashed border-surface-border rounded-3xl p-12 max-w-lg w-full text-center relative overflow-hidden group">
          {/* Decorative background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#5B5FEF]/10 blur-[80px] rounded-full pointer-events-none transition-transform group-hover:scale-110 duration-700"></div>
          
          <div className="w-20 h-20 bg-surface-base border border-surface-border rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl relative z-10">
            <Banknote className="text-[#5B5FEF]" size={40} strokeWidth={1.5} />
          </div>
          
          <h2 className="text-3xl font-bold text-text-primary mb-3 relative z-10 tracking-tight">Coming Soon</h2>
          <p className="text-text-secondary text-base leading-relaxed mb-8 relative z-10">
            We are working hard to bring you a comprehensive expense tracker. Soon you'll be able to manage budgets, track project expenditures, and generate financial reports seamlessly.
          </p>
          
          <div className="inline-flex items-center gap-2 bg-[#5B5FEF]/10 text-[#5B5FEF] px-4 py-2 rounded-full font-bold text-sm border border-[#5B5FEF]/20 relative z-10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B5FEF] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5B5FEF]"></span>
            </span>
            In Development
          </div>
        </div>
      </div>
    </div>
  );
}
