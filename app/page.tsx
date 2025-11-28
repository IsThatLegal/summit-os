'use client'; // This directive is crucial for using ssr: false

import dynamic from 'next/dynamic';

// Dynamically import the DashboardPage component with SSR turned off.
const DashboardPage = dynamic(() => import('@/components/dashboard-page'), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Loading Dashboard...</div>,
});

export default function Page() {
  return <DashboardPage />;
}