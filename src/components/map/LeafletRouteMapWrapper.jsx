
'use client';

import dynamic from 'next/dynamic';

// Dynamically import LeafletRouteMap with no SSR
const LeafletRouteMap = dynamic(
  () => import('./LeafletRouteMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }
);

export default LeafletRouteMap;