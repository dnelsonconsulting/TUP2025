// app/page.tsx or pages/index.tsx
import MultiStepForm from '../components/MultiStepForm';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-300 to-green-200 flex items-center justify-center">
      <MultiStepForm />
    </div>
  );
}
