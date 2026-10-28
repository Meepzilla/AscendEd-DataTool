'use client';

import { Suspense } from 'react';
import StudentProfileView from './StudentProfileView';

// The student id is passed as a query parameter (?id=...) rather than a dynamic route segment,
// so the page can be exported statically for the Android build.
export default function StudentProfilePage() {
  return (
    <Suspense fallback={null}>
      <StudentProfileView />
    </Suspense>
  );
}
