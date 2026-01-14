import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

export default function PageNotFound() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-white/10">404</h1>
        <h2 className="text-2xl font-semibold text-white mt-4">
          Página não encontrada
        </h2>
        <p className="text-gray-400 mt-2 max-w-md mx-auto">
          A página que você está procurando não existe ou foi movida.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="bg-transparent border-white/10 text-white hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button
            onClick={() => navigate(isAuthenticated ? '/' : '/login')}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
          >
            <Home className="w-4 h-4 mr-2" />
            {isAuthenticated ? 'Ir para o início' : 'Fazer login'}
          </Button>
        </div>
      </div>
    </div>
  );
}
