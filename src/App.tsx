import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WordsProvider } from './contexts/WordsContext';
import { UserProvider } from './contexts/UserContext';
import HomePage from './pages/HomePage';
import WordListPage from './pages/WordListPage';
import DashboardPage from './pages/DashboardPage';
import RankingPage from './pages/RankingPage';
import BoardPage from './pages/BoardPage';
import { QuizRoutes } from './routes/QuizRoutes';
import { GameRoutes } from './routes/GameRoutes';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <WordsProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/words" element={<WordListPage />} />
            <Route path="/quiz/*" element={<QuizRoutes />} />
            <Route path="/game/*" element={<GameRoutes />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/board" element={<BoardPage />} />
          </Routes>
        </WordsProvider>
      </UserProvider>
    </BrowserRouter>
  );
}

export default App;
