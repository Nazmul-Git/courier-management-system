'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerParcels() {
  const router = useRouter();
  const [parcels, setParcels] = useState([]);

  useEffect(() => {
    const token = document.cookie.split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];
    
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role !== 'customer') {
      router.push('/unauthorized');
      return;
    }

    // Fetch customer's parcels
    const fetchParcels = async () => {
      try {
        const res = await fetch('/api/customer/parcels', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setParcels(data);
      } catch (error) {
        console.error('Failed to fetch parcels:', error);
      }
    };

    fetchParcels();
  }, [router]);

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