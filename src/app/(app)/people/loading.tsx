export default function PeopleLoading() {
  const skeletonClass = "bg-surface-border/50 rounded-md animate-pulse";
  
  return (
    <div className="p-8 max-w-[1500px] mx-auto space-y-8 animate-pulse pb-24">
      
      {/* Header Area */}
      <div className="flex justify-end mb-8">


        <div className="flex flex-col items-end gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-32 rounded-xl ${skeletonClass}`} />
            <div className={`h-9 w-64 rounded-xl ${skeletonClass}`} />
            <div className={`h-9 w-24 rounded-xl ${skeletonClass}`} />
            <div className={`h-9 w-24 rounded-xl ${skeletonClass}`} />
          </div>
          <div className={`h-9 w-20 rounded-xl ${skeletonClass}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface-elevated border border-surface-border rounded-3xl p-6 relative flex flex-col">
            
            {/* Top Section */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${skeletonClass}`} />
                <div className="space-y-2">
                  <div className={`h-4 w-32 ${skeletonClass}`} />
                  <div className={`h-3 w-20 ${skeletonClass}`} />
                </div>
              </div>
              <div className={`w-8 h-8 rounded-xl ${skeletonClass}`} />
            </div>

            <div className={`h-px w-full mb-4 ${skeletonClass}`}></div>

            {/* Stats Section */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="flex flex-col items-center">
                <div className={`h-5 w-8 mb-2 ${skeletonClass}`} />
                <div className={`h-3 w-12 ${skeletonClass}`} />
              </div>
              <div className="flex flex-col items-center border-l border-surface-border">
                <div className={`h-5 w-8 mb-2 ${skeletonClass}`} />
                <div className={`h-3 w-12 ${skeletonClass}`} />
              </div>
              <div className="flex flex-col items-center border-l border-surface-border">
                <div className={`h-5 w-10 mb-2 ${skeletonClass}`} />
                <div className={`h-3 w-16 ${skeletonClass}`} />
              </div>
            </div>

            <div className={`h-px w-full mb-4 ${skeletonClass}`}></div>

            {/* Last Active */}
            <div className="flex items-center justify-between mt-auto">
              <div className={`h-3 w-20 ${skeletonClass}`} />
              <div className={`h-3 w-16 ${skeletonClass}`} />
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
