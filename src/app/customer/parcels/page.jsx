'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerParcels() {
  const router = useRouter();
  const [parcels, setParcels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Remove all authentication checks - middleware already handled it
    const fetchParcels = async () => {
      try {
        const res = await fetch('/api/customer/parcels', {
          credentials: 'include' // Send cookies automatically
        });
        
        if (res.status === 401 || res.status === 403) {
          // If API returns unauthorized, redirect to login
          router.push('/auth/login');
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          setParcels(data);
        } else {
          console.error('Failed to fetch parcels');
        }
      } catch (error) {
        console.error('Failed to fetch parcels:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchParcels();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">My Parcels</h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-gray-200">
              {parcels.map((parcel) => (
                <li key={parcel.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{parcel.trackingNumber}</p>
                      <p className="text-sm text-gray-500">
                        Status: {parcel.status} | 
                        Estimated Delivery: {parcel.estimatedDelivery}
                      </p>
                    </div>
                    <button
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      onClick={() => router.push(`/customer/parcels/${parcel.id}`)}
                    >
                      Track
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {parcels.length === 0 && !isLoading && (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-500">No parcels found.</p>
                <p className="text-sm text-gray-400 mt-2">Create your first shipment to get started.</p>
              </div>
            )}
            <div className="px-6 py-4 bg-gray-50 text-right">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={() => router.push('/customer/parcels/new')}
              >
                New Shipment
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}