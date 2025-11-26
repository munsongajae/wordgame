import React from 'react';

interface QuestionCountProps {
    options?: number[];
    onSelect: (count: number | 'infinite') => void;
}

export const QuestionCount: React.FC<QuestionCountProps> = ({
    options = [10, 20, 30],
    onSelect,
}) => {
    return (
        <div style={{ textAlign: 'center', marginTop: 40 }}>
            <h3 style={{ color: '#333', fontSize: '24px', marginBottom: '30px' }}>
                문제 수를 선택하세요
            </h3>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '20px',
                    maxWidth: '400px',
                    margin: '0 auto',
                    padding: '0 20px',
                }}
            >
                {options.map((cnt) => (
                    <button
                        key={cnt}
                        onClick={() => onSelect(cnt)}
                        style={{
                            padding: '24px 20px',
                            backgroundColor: '#1976d2',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 16,
                            cursor: 'pointer',
                            fontSize: '20px',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 12px rgba(25,118,210,0.3)',
                            transition: 'all 0.3s ease',
                            minHeight: '80px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(25,118,210,0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(25,118,210,0.3)';
                        }}
                    >
                        {cnt}문제
                    </button>
                ))}

                <button
                    onClick={() => onSelect('infinite')}
                    style={{
                        padding: '24px 20px',
                        backgroundColor: '#4CAF50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 16,
                        cursor: 'pointer',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
                        transition: 'all 0.3s ease',
                        minHeight: '80px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(76,175,80,0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(76,175,80,0.3)';
                    }}
                >
                    무제한
                </button>
            </div>
        </div>
    );
};
