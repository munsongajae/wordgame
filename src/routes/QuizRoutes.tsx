import React from 'react';

import { Routes, Route, useNavigate } from 'react-router-dom';
import ImageQuiz from '../components/ImageQuiz';
import SpellingQuiz from '../components/SpellingQuiz';
import MeaningQuiz from '../components/MeaningQuiz';
import CombinedQuiz from '../components/CombinedQuiz';
import ListeningQuiz from '../components/ListeningQuiz';
import SpellingGame from '../components/SpellingGame';
import FillBlankGame from '../components/FillBlankGame';
import { useWords } from '../contexts/WordsContext';

import QuizSelectionPage from '../pages/QuizSelectionPage';

// CombinedQuiz wrapper to use Context
const CombinedQuizWrapper = () => {
    const { words } = useWords();
    const navigate = useNavigate();
    return <CombinedQuiz words={words} onBack={() => navigate(-1)} />;
};

// ListeningQuiz wrapper to use Context
const ListeningQuizWrapper = () => {
    const { words } = useWords();
    const navigate = useNavigate();
    return <ListeningQuiz words={words} onBack={() => navigate(-1)} />;
};

export const QuizRoutes: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<QuizSelectionPage />} />
            <Route path="/image" element={<ImageQuiz />} />
            <Route path="/spelling" element={<SpellingQuiz />} />
            <Route path="/meaning" element={<MeaningQuiz />} />
            <Route path="/listening" element={<ListeningQuizWrapper />} />
            <Route path="/combined" element={<CombinedQuizWrapper />} />
            <Route path="/spelling-game" element={<SpellingGame />} />
            <Route path="/fill-blank" element={<FillBlankGame />} />
        </Routes>
    );
};
