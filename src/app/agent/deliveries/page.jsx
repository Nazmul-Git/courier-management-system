'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AgentDeliveries() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState([]);

  useEffect(() => {
    const token = document.cookie.split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];
    
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role !== 'agent') {
      router.push('/unauthorized');
      return;
    }

    // Fetch agent's deliveries
    const fetchDeliveries = async () => {
      try {
        const res = await fetch('/api/agent/deliveries', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setDeliveries(data);
      } catch (error) {
        console.error('Failed to fetch deliveries:', error);
      }
    };

    fetchDeliveries();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">My Deliveries</h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-gray-200">
              {deliveries.map((delivery) => (
                <li key={delivery.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{delivery.trackingNumber}</p>
                      <p className="text-sm text-gray-500">{delivery.status}</p>
                    </div>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      onClick={() => router.push(`/agent/deliveries/${delivery.id}`)}
                    >
                      View
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}