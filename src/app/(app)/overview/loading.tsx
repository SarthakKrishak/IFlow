export default function OverviewLoading() {
  const skeletonClass = "bg-surface-border/50 rounded-md animate-pulse";

  return (
    <div className="p-8 pb-20 max-w-[1500px] mx-auto space-y-6 animate-pulse">
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col justify-between h-[160px]">
            <div className="flex items-start justify-between mb-2">
              <div className={`w-12 h-12 rounded-2xl ${skeletonClass}`} />
              <div className={`w-20 h-8 rounded-lg ${skeletonClass}`} />
            </div>
            <div>
              <div className={`h-3 w-24 mb-3 ${skeletonClass}`} />
              <div className={`h-8 w-16 mb-3 ${skeletonClass}`} />
              <div className={`h-3 w-32 ${skeletonClass}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Activity Overview Chart */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm xl:col-span-2 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between mb-6">
            <div className={`h-5 w-36 ${skeletonClass}`} />
            <div className={`h-8 w-32 rounded-xl ${skeletonClass}`} />
          </div>
          <div className={`flex-1 w-full rounded-2xl ${skeletonClass}`} />
        </div>

        {/* Projects List */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col h-[420px]">
          <div className={`h-5 w-24 mb-6 ${skeletonClass}`} />
          <div className="grid grid-cols-12 mb-4 px-2">
             <div className={`col-span-5 h-3 ${skeletonClass}`} />
             <div className={`col-span-2 mx-2 h-3 ${skeletonClass}`} />
             <div className={`col-span-2 mx-2 h-3 ${skeletonClass}`} />
             <div className={`col-span-3 h-3 ${skeletonClass}`} />
          </div>
          <div className="flex-1 space-y-4 pr-2">
            {[...Array(5)].map((_, i) => (
               <div key={i} className="grid grid-cols-12 items-center p-2">
                  <div className="col-span-5 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl ${skeletonClass}`} />
                    <div className={`h-3 w-16 ${skeletonClass}`} />
                  </div>
                  <div className={`col-span-2 mx-4 h-3 ${skeletonClass}`} />
                  <div className={`col-span-2 mx-4 h-3 ${skeletonClass}`} />
                  <div className={`col-span-3 h-3 ${skeletonClass}`} />
               </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Activity */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
          <div className={`h-5 w-32 mb-6 ${skeletonClass}`} />
          <div className="flex-1 space-y-6">
             {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 ${skeletonClass}`} />
                  <div className="flex-1 space-y-2 pt-1">
                     <div className={`h-3 w-full ${skeletonClass}`} />
                     <div className={`h-2.5 w-24 ${skeletonClass}`} />
                  </div>
                </div>
             ))}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
          <div className={`h-5 w-40 mb-6 ${skeletonClass}`} />
          <div className="flex-1 space-y-4">
             {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex-shrink-0 ${skeletonClass}`} />
                  <div className="flex-1 space-y-2">
                     <div className={`h-3.5 w-full max-w-[150px] ${skeletonClass}`} />
                     <div className={`h-2.5 w-32 ${skeletonClass}`} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     <div className={`h-3 w-16 ${skeletonClass}`} />
                     <div className={`w-6 h-6 rounded-md ${skeletonClass}`} />
                  </div>
                </div>
             ))}
          </div>
        </div>

        {/* Team Overview */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
          <div className={`h-5 w-32 mb-6 ${skeletonClass}`} />
          
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
               <div className={`h-3 w-24 ${skeletonClass}`} />
               <div className={`h-8 w-16 ${skeletonClass}`} />
            </div>
            <div className="flex -space-x-3">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className={`w-8 h-8 rounded-full border-2 border-surface-elevated ${skeletonClass}`} />
               ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
               <div className={`h-3 w-20 ${skeletonClass}`} />
               <div className={`h-3 w-28 ${skeletonClass}`} />
            </div>
            <div className="flex -space-x-3">
               {[...Array(4)].map((_, i) => (
                 <div key={i} className={`w-8 h-8 rounded-full border-2 border-surface-elevated ${skeletonClass}`} />
               ))}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-surface-border pt-6">
             <div className="space-y-2">
                <div className={`h-3.5 w-32 ${skeletonClass}`} />
                <div className={`h-2.5 w-40 ${skeletonClass}`} />
             </div>
             <div className={`w-16 h-16 rounded-full ${skeletonClass}`} />
          </div>
        </div>

      </div>
    </div>
  );
}
