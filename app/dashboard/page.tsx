// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useUser } from './layout';

export default function DashboardPage() {
  const user = useUser();
  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour < 12) setGreeting('Buenos días');
    else if (hour < 18) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');

    setCurrentDate(
      new Date().toLocaleDateString('es-CR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  return (
    <div className="w-full">
      <div className="w-full rounded-2xl bg-gradient-to-r from-slate-800 to-indigo-900 p-5 sm:p-6 lg:p-8 shadow-lg">
        <h1 className="text-xl font-bold leading-snug text-white sm:text-2xl lg:text-3xl">
          {greeting}
          {user ? `, ${user.nombre}` : ''} 👋
        </h1>

        <p className="mt-2 text-sm capitalize text-gray-300 sm:text-base">
          {currentDate}
        </p>
      </div>
    </div>
  );
}